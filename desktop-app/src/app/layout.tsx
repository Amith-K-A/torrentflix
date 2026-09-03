import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TorrentFlix — Stream movies & TV from torrents",
  description:
    "Search trending movies and shows, pick a torrent, and stream it instantly. Powered by TMDB and WebTorrent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface text-white">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/10 px-6 py-8 text-xs text-muted">
          <p className="max-w-3xl">
            TorrentFlix is a personal streaming tool for educational use. It does not host
            any content — you are responsible for what you access and the laws of your
            region.
          </p>
        </footer>
      </body>
    </html>
  );
}
