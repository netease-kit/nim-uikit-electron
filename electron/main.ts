import { app, BrowserWindow, Menu } from "electron";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

/**
 * ============================================================================
 * NEUIKitBridge 功能模块导入
 * ============================================================================
 *
 * NEUIKitBridge 是一个可独立拷贝的 Electron 主进程功能模块集合。
 * 开发者可以将整个 NEUIKitBridge 目录拷贝到自己的项目中，然后按需导入所需的模块。
 *
 * 每个模块提供三类导出：
 *   - init*()：初始化函数，在 app.whenReady() 后调用
 *   - register*Handlers()：IPC 处理器注册函数，在渲染进程加载前调用
 *   - 其他工具函数：如 markAppQuitting() 等
 *
 * 可用模块：
 *   - tray：系统托盘功能（图标、菜单、未读数显示）
 *   - window-close：窗口关闭行为管理（隐藏到托盘 vs 真正退出）
 *   - app：应用控制（重启、DevTools）
 *   - version：版本信息获取
 *   - fs：文件系统操作（文件读写、目录管理、本地文件协议）
 *   - navigation：页面导航事件
 *   - i18n：国际化支持
 *
 * 按需引入示例：
 *   // 只需要托盘功能
 *   import { initTray, registerTrayHandlers } from "./NEUIKitBridge/tray";
 *
 *   // 只需要版本信息
 *   import { registerVersionHandlers } from "./NEUIKitBridge/version";
 */
import { initTray, registerTrayHandlers } from "./NEUIKitBridge/tray";
import {
  initWindowClose,
  markAppQuitting,
  registerWindowCloseHandlers,
} from "./NEUIKitBridge/window-close";
import { initApp, registerAppHandlers } from "./NEUIKitBridge/app";
import { registerVersionHandlers } from "./NEUIKitBridge/version";
import {
  initNotificationService,
  registerNotificationHandlers,
} from "./NEUIKitBridge/notification";
import {
  registerFsHandlers,
  registerLocalFileProtocol,
  initLocalFileProtocol,
} from "./NEUIKitBridge/fs";
import { registerStorageHandlers } from "./preload/storage-service";

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

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 855,
    icon: path.join(process.env.VITE_PUBLIC!, "electron-vite.svg"),
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
    autoHideMenuBar: true,
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

// Keep app running to preserve renderer process
app.on("window-all-closed", () => {
  // Do nothing, let the app continue running
  // Use isQuitting flag to control actual quit behavior
  app.quit();
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null || win.isDestroyed()) {
    createWindow();
  } else {
    // 窗口存在且未被销毁，只需显示
    if (!win.isVisible()) {
      win.show();
      win.focus();
    }
  }
});

/**
 * 注册 IPC 处理器
 *
 * ⚠️ 开发者可按需选择注册哪些模块的 handler，不需要的模块可以注释掉或删除。
 *
 * 注意：
 *   1. 注册顺序不影响功能
 *   2. 如果不需要某个功能，直接删除对应的 register*Handlers() 调用即可
 *   3. 同时需要在 preload.ts 中删除对应的 API 创建代码
 *   4. 部分 handler 需要传入回调函数或窗口获取器，请参考各模块的类型定义
 */
function registerIpcHandlers() {
  if (ipcRegistered) return;

  /**
   * 注册各模块的 IPC 处理器
   *
   * 可用的处理器注册函数：
   *   - registerAppHandlers()       - 应用控制（重启、DevTools）
   *   - registerTrayHandlers()      - 托盘功能（需要传入退出回调和窗口获取器）
   *   - registerVersionHandlers()   - 版本信息获取
   *   - registerWindowCloseHandlers() - 窗口关闭行为管理
   *   - registerFsHandlers()        - 文件系统操作
   *
   * 按需注释/删除不需要的模块：
   */
  registerAppHandlers(); // 应用控制
  registerTrayHandlers(markAppQuitting, () => win); // 托盘（需要退出回调和窗口获取器）
  registerVersionHandlers(); // 版本信息
  registerWindowCloseHandlers(); // 窗口关闭行为
  registerNotificationHandlers(); // 桌面通知
  registerFsHandlers(); // 文件系统（含文件选择对话框）
  registerStorageHandlers(); // 统一存储解决方案

  ipcRegistered = true;
}

app.on("before-quit", () => {
  // Mark app as quitting to allow window to actually close
  markAppQuitting();
});

// 注册本地文件协议（必须在 app.whenReady() 之前调用）
registerLocalFileProtocol();

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // 初始化本地文件协议处理器（必须在 app.whenReady() 之后调用）
  initLocalFileProtocol();
  registerIpcHandlers();
  createWindow();

  if (win) {
    // 初始化应用模块
    initApp(win, !!VITE_DEV_SERVER_URL, VITE_DEV_SERVER_URL);
    // 初始化托盘
    initTray(win, markAppQuitting);
    // 初始化窗口关闭管理
    initWindowClose(win);
    // 初始化桌面通知服务
    initNotificationService(win);
  }

  win?.setMenuBarVisibility(false);
});
