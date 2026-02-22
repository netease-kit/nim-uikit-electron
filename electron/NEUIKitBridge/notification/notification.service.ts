/**
 * 通知服务模块
 * @description 桌面通知相关的业务逻辑实现
 */
import { BrowserWindow, Notification } from 'electron';
import * as path from 'node:path';

/** 主窗口实例引用 */
let mainWindow: BrowserWindow | null = null;

/**
 * 通知选项接口
 */
export interface NotificationOptions {
  /** 通知标题（发送者名称） */
  title: string;
  /** 通知正文（消息摘要） */
  body: string;
  /** 通知图标路径（可选） */
  icon?: string;
  /** 会话 ID，用于点击跳转 */
  conversationId?: string;
}

/**
 * 初始化通知服务
 * @param win 主窗口实例
 */
export function initNotificationService(win: BrowserWindow): void {
  mainWindow = win;
}

/**
 * 显示桌面通知
 * @param options 通知选项
 */
export function showNotification(options: NotificationOptions): void {
  // 检查系统是否支持通知
  if (!Notification.isSupported()) {
    console.warn('[Notification] System does not support notifications');
    return;
  }

  // 如果窗口当前有焦点，不显示通知
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
    console.log('[Notification] Window is focused, skipping notification');
    return;
  }

  // 构建通知图标路径
  const iconPath = options.icon || path.join(process.env.VITE_PUBLIC!, 'logo.png');

  // 创建通知
  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: iconPath,
    silent: false, // 使用系统默认声音
  });

  console.log('[Notification] Showing notification:', options);

  // 处理通知点击事件
  notification.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 显示并聚焦窗口
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();

      // 发送点击事件到渲染进程，带上 conversationId
      if (options.conversationId) {
        mainWindow.webContents.send('notification:clicked', {
          conversationId: options.conversationId,
        });
      }
    }
  });

  // 显示通知
  notification.show();
}

/**
 * 检查通知是否被支持
 * @returns 是否支持通知
 */
export function isNotificationSupported(): boolean {
  return Notification.isSupported();
}
