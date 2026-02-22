/**
 * 应用 IPC 处理器
 * @description 处理应用相关的 IPC 通信（重启、开发者工具等）
 */
import { ipcMain, app, BrowserWindow } from 'electron';

// 模块内部状态
let mainWindow: BrowserWindow | null = null;
let devServerUrl: string | undefined;

/**
 * 初始化应用模块
 * @param win 主窗口实例
 * @param isDev 是否为开发模式
 * @param serverUrl 开发服务器 URL
 */
export function initApp(win: BrowserWindow, _isDev: boolean, serverUrl?: string): void {
  mainWindow = win;
  devServerUrl = serverUrl;
}

/**
 * 获取主窗口实例
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * 注册应用相关的 IPC 处理器
 */
export function registerAppHandlers(): void {
  // 应用重启或重载
  ipcMain.handle('app:relaunch', async () => {
    if (devServerUrl) {
      // 开发环境：重载页面
      mainWindow?.webContents.reload();
    } else {
      // 生产环境：重启应用
      app.relaunch();
      app.exit(0);
    }
  });

  // 打开开发者工具
  ipcMain.handle('app:open-devtools', async () => {
    mainWindow?.webContents.openDevTools();
  });
}
