/**
 * 窗口关闭服务模块
 * @description 窗口关闭相关的业务逻辑实现
 */
import { app, BrowserWindow } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";

// 关闭行为偏好类型
export type ClosePreference = 'default' | 'minimize' | 'quit';

// 配置文件路径
let CONFIG_FILE_PATH: string;

// 模块内部状态
let mainWindow: BrowserWindow | null = null;
let waitingForCloseConfirmation = false;
let isQuitting = false;

/**
 * 读取关闭行为偏好配置
 * @returns 用户保存的关闭行为偏好
 */
export function getClosePreference(): ClosePreference {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
      return config.closePreference || 'default';
    }
  } catch (error) {
    console.error('Error reading close preference:', error);
  }
  return 'default';
}

/**
 * 保存关闭行为偏好配置
 * @param preference 要保存的关闭行为偏好
 */
export function setClosePreference(preference: ClosePreference): void {
  try {
    const config = { closePreference: preference };
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving close preference:', error);
  }
}

/**
 * 处理窗口关闭事件
 * @param event 关闭事件对象
 */
export function handleWindowClose(event: Electron.Event): void {
  if (!isQuitting) {
    if (waitingForCloseConfirmation) {
      return;
    }
    const preference = getClosePreference();
    if (preference === 'minimize') {
      event.preventDefault();
      minimizeToTray();
    } 
    if (preference === 'default') {
      event.preventDefault();
      // 默认：显示确认对话框
      waitingForCloseConfirmation = true;
      mainWindow?.webContents.send('window:request-close-confirmation');
    }
    if (preference === 'quit') {
      // 不需要做任何操作，让 close 事件继续执行即可
    }
  }
}

/**
 * 标记应用正在退出
 * 用于在 app.on('before-quit') 事件中调用
 */
export function markAppQuitting(): void {
  isQuitting = true;
}

/**
 * 初始化窗口关闭管理模块
 * @param win 主窗口实例
 */
export function initWindowClose(win: BrowserWindow): void {
  mainWindow = win;
  
  // 初始化配置文件路径
  CONFIG_FILE_PATH = path.join(app.getPath("userData"), "window-close-config.json");
  
  // 监听窗口关闭事件
  win.on("close", handleWindowClose);
}

/**
 * 设置等待关闭确认标志
 * @param value 是否等待确认
 */
export function setWaitingForCloseConfirmation(value: boolean): void {
  waitingForCloseConfirmation = value;
}

/**
 * 设置应用正在退出标志
 * @param value 是否正在退出
 */
export function setIsQuitting(value: boolean): void {
  isQuitting = value;
}

/**
 * 获取应用是否正在退出
 * @returns 是否正在退出
 */
export function getIsQuitting(): boolean {
  return isQuitting;
}

/**
 * 最小化到托盘
 * @description 隐藏主窗口到系统托盘
 */
export function minimizeToTray(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

/**
 * 退出应用
 * @description 退出应用，渲染进程通过 beforeunload 事件自行清理
 */
export function quitApplication(): void {
  isQuitting = true;
  app.quit();
}

/**
 * 获取主窗口实例
 * @returns 主窗口实例
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}