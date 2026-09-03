const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { fork, spawn } = require("child_process");

const net = require("net");

let mainWindow;
let serverProcess;
let pythonDaemon;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, "127.0.0.1");
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function getAppPort() {
  const PREFERRED_PORT = 34567;
  if (await isPortAvailable(PREFERRED_PORT)) {
    return PREFERRED_PORT;
  }
  return getFreePort();
}

async function createWindow() {
  const port = await getAppPort();
  
  // Start Python libtorrent daemon
  const pythonPath = path.join(__dirname, "torrentd.py");
  pythonDaemon = spawn("python3", [pythonPath], {
    stdio: "inherit"
  });

  pythonDaemon.on('error', (err) => {
    console.error('Failed to start python libtorrent daemon:', err);
  });

  // Path to the standalone server
  const serverPath = path.join(__dirname, ".next", "standalone", "desktop-app", "server.js");
  
  // Start the Next.js standalone server using Electron's bundled Node
  serverProcess = fork(serverPath, [], {
    env: { 
      ...process.env, 
      PORT: port,
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start Next.js server:', err);
  });

  // Give the server a couple seconds to boot
  setTimeout(() => {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      icon: path.join(__dirname, "build", "icon.icns"),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("magnet:") || url.startsWith("http:") || url.startsWith("https:")) {
        shell.openExternal(url);
        return { action: "deny" };
      }
      return { action: "allow" };
    });

    mainWindow.webContents.on("will-navigate", (event, url) => {
      if (url.startsWith("magnet:")) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    mainWindow.loadURL(`http://localhost:${port}`);

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }, 2000);
}

app.on("ready", createWindow);

function cleanup() {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (pythonDaemon) {
    pythonDaemon.kill();
  }
}

app.on("window-all-closed", () => {
  cleanup();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  cleanup();
});
