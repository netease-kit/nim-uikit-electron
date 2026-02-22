/**
 * 通知 IPC 处理器
 * @description 处理通知相关的 IPC 通信
 */
import { ipcMain } from 'electron';
import { showNotification, type NotificationOptions } from './notification.service';

/**
 * 注册通知相关的 IPC 处理器
 */
export function registerNotificationHandlers(): void {
  // 监听渲染进程发送的显示通知请求
  ipcMain.handle('notification:show', async (_, options: NotificationOptions) => {
    try {
      showNotification(options);
      return { success: true };
    } catch (error) {
      console.error('[Notification] Failed to show notification:', error);
      return { success: false, error: String(error) };
    }
  });
}
