import { app, BrowserWindow, protocol, ipcMain } from "electron";
// import { createRequire } from 'node:module'
import { fileURLToPath } from "node:url";
import * as path from "node:path";

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url));


process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let ipcRegistered = false;
let protocolsRegistered = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 855,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools();
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function registerProtocols() {
  if (protocolsRegistered) return;
  protocol.registerFileProtocol("local-file", (request, callback) => {
    const filePath = decodeURI(request.url.replace("local-file://", ""));
    callback({ path: filePath });
  });
  protocolsRegistered = true;
}

function registerIpcHandlers() {
  if (ipcRegistered) return;
  ipcMain.handle("app:relaunch", async () => {
    if (VITE_DEV_SERVER_URL) {
      win?.webContents.reload();
    } else {
      app.relaunch();
      app.exit(0);
    }
  });
  ipcRegistered = true;
}

app.whenReady().then(() => {
  registerProtocols();
  registerIpcHandlers();
  createWindow();
});
