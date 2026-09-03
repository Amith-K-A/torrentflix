import libtorrent as lt
import time
import json
import os
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading
import sys
import select

# Global session and storage
settings = lt.default_settings()
settings = {
    'enable_dht': True,
    'enable_lsd': True,
    'enable_upnp': True,
    'enable_natpmp': True,
    'listen_interfaces': '0.0.0.0:6881'
}
session = lt.session(settings)

torrents = {}
piece_buffers = {}

def alert_loop():
    while True:
        alerts = session.pop_alerts()
        for a in alerts:
            if isinstance(a, lt.read_piece_alert):
                info_hash = str(a.handle.info_hash())
                piece_buffers[(info_hash, a.piece)] = (a.buffer if a.buffer else b'', time.time())
        
        # Sweep old pieces to prevent memory leak (keep for 5 seconds to allow concurrent reads)
        now = time.time()
        for k in list(piece_buffers.keys()):
            if now - piece_buffers[k][1] > 5.0:
                del piece_buffers[k]
                
        time.sleep(0.01)

threading.Thread(target=alert_loop, daemon=True).start()

def get_torrent_status(handle):
    s = handle.status()
    return {
        "infoHash": str(handle.info_hash()),
        "name": handle.torrent_file().name() if handle.status().has_metadata else "",
        "progress": s.progress,
        "peers": s.num_peers,
        "downloadSpeed": s.download_rate,
        "uploadSpeed": s.upload_rate,
        "downloaded": s.total_wanted_done,
        "length": handle.torrent_file().total_size() if handle.status().has_metadata else 0,
        "state": str(s.state)
    }

class TorrentHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/add':
            length = int(self.headers.get('content-length', 0))
            body = self.rfile.read(length).decode('utf-8')
            try:
                data = json.loads(body)
                magnet = data.get('magnet')
                
                params = lt.parse_magnet_uri(magnet)
                save_path = os.path.expanduser('~/Downloads/TorrentFlix')
                os.makedirs(save_path, exist_ok=True)
                params.save_path = save_path
                
                handle = session.add_torrent(params)
                info_hash = str(handle.info_hash())
                torrents[info_hash] = handle
                
                # Wait for metadata
                while not handle.status().has_metadata:
                    time.sleep(0.1)
                
                ti = handle.torrent_file()
                
                files = []
                for idx in range(ti.num_files()):
                    # Use orig_files() or files() based on the libtorrent version available
                    # Assuming ti.files() works but might throw deprecation warnings
                    f = ti.files()
                    files.append({
                        "idx": idx,
                        "name": f.file_path(idx),
                        "size": f.file_size(idx)
                    })
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "infoHash": info_hash,
                    "name": ti.name(),
                    "files": files
                }).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        
        if parsed.path == '/stats':
            info_hash = query.get('infoHash', [''])[0]
            if info_hash in torrents:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(get_torrent_status(torrents[info_hash])).encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
                
        elif parsed.path == '/stream':
            info_hash = query.get('infoHash', [''])[0]
            file_idx = int(query.get('fileIdx', ['0'])[0])
            
            if info_hash not in torrents:
                self.send_response(404)
                self.end_headers()
                return
                
            handle = torrents[info_hash]
            if not handle.status().has_metadata:
                self.send_response(404)
                self.end_headers()
                return
                
            ti = handle.torrent_file()
            f = ti.files()
            
            try:
                handle.prioritize_files([1 if i == file_idx else 0 for i in range(ti.num_files())])
            except AttributeError:
                handle.set_file_priorities([1 if i == file_idx else 0 for i in range(ti.num_files())])
            
            file_size = f.file_size(file_idx)
            file_offset = f.file_offset(file_idx)
            piece_length = ti.piece_length()
            
            range_header = self.headers.get('Range')
            start = 0
            end = file_size - 1
            
            if range_header:
                start_str, end_str = range_header.replace('bytes=', '').split('-')
                start = int(start_str) if start_str else 0
                end = int(end_str) if end_str else file_size - 1
            
            self.send_response(206 if range_header else 200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
            self.send_header('Content-Length', str(end - start + 1))
            self.end_headers()
            
            abs_start = file_offset + start
            abs_end = file_offset + end
            
            start_piece = abs_start // piece_length
            end_piece = abs_end // piece_length
            
            # Reset piece priorities to stop background requests from competing with seek requests
            handle.clear_piece_deadlines()
            
            # Pre-set deadlines for a window of pieces to allow parallel downloading
            readahead = 10
            for i in range(start_piece, min(end_piece + 1, start_piece + readahead)):
                handle.set_piece_deadline(i, (i - start_piece) * 10, 1)
            
            for p in range(start_piece, end_piece + 1):
                # Detect client disconnect
                r, w, e = select.select([self.connection], [], [], 0)
                if r: break
                
                # Keep the readahead window full
                future_p = p + readahead
                if future_p <= end_piece:
                    handle.set_piece_deadline(future_p, 100, 1)
                
                while not handle.have_piece(p):
                    r, w, e = select.select([self.connection], [], [], 0)
                    if r: break
                    time.sleep(0.1)
                if r: break
                
                # Request the piece buffer from libtorrent cache
                handle.read_piece(p)
                piece_key = (info_hash, p)
                
                wait_time = 0
                while piece_key not in piece_buffers:
                    r, w, e = select.select([self.connection], [], [], 0)
                    if r: break
                    time.sleep(0.01)
                    wait_time += 1
                    if wait_time > 100: # 1 second
                        handle.read_piece(p)
                        wait_time = 0
                if r: break
                
                piece_tuple = piece_buffers.get(piece_key)
                if not piece_tuple:
                    break
                piece_data = piece_tuple[0]
                
                if not piece_data:
                    # Failed to read piece, shouldn't happen if have_piece is true, but just in case
                    break
                    
                p_start = p * piece_length
                p_end = p_start + piece_length - 1
                
                slice_start = max(0, abs_start - p_start)
                slice_end = min(piece_length - 1, abs_end - p_start)
                
                chunk_data = piece_data[slice_start:slice_end + 1]
                
                try:
                    self.wfile.write(chunk_data)
                    abs_start += len(chunk_data)
                except Exception as e:
                    print("Stream error:", e)
                    break
            
            # Cleanup deadlines so torrent can resume sequential download
            try:
                handle.clear_piece_deadlines()
            except Exception:
                pass
        else:
            self.send_response(404)
            self.end_headers()

def run(port=8080):
    os.makedirs('./downloads', exist_ok=True)
    server_address = ('', port)
    httpd = HTTPServer(server_address, TorrentHandler)
    print(f'Starting libtorrent daemon on port {port}...')
    httpd.serve_forever()

if __name__ == '__main__':
    run()
