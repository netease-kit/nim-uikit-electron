/**
 * Electron 相关的工具函数
 */

/**
 * 向主进程发送未读消息数
 * @param count 未读消息数
 */
export function updateUnreadCount(count: number): void {
  try {
    // 检查是否在 Electron 环境中
    if (window.electronAPI) {
      window.electronAPI.tray.updateUnreadCount(count);
    }
  } catch (error) {
    console.warn('Failed to send unread count to main process:', error);
  }
}

/**
 * 向主进程发送语言设置
 * @param language 语言设置
 */
export function updateLanguage(language: string): void {
  try {
    if (window.electronAPI) {
      window.electronAPI.tray.updateLanguage(language);
    }
  } catch (error) {
    console.warn('Failed to send language to main process:', error);
  }
}

/**
 * 检查是否在 Electron 环境中
 */
export function isElectron(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.require;
  } catch {
    return false;
  }
}

/**
 * 通知选项接口
 */
export interface ShowNotificationOptions {
  /** 通知标题 */
  title: string;
  /** 通知内容 */
  body: string;
  /** 会话 ID，用于通知点击后跳转 */
  conversationId?: string;
  /** 自定义图标路径 */
  icon?: string;
}

/**
 * 显示桌面通知
 * @param options 通知选项
 */
export function showNotification(options: ShowNotificationOptions): void {
  try {
    if (window.electronAPI?.notification) {
      window.electronAPI.notification.show({
        title: options.title,
        body: options.body,
        conversationId: options.conversationId,
        icon: options.icon,
      });
    }
  } catch (error) {
    console.warn('Failed to show notification:', error);
  }
}

/**
 * 通知点击事件回调函数类型
 */
export type NotificationClickCallback = (conversationId?: string) => void;

/**
 * 监听通知点击事件
 * @param callback 点击回调函数
 * @returns 取消监听的函数
 */
export function onNotificationClick(
  callback: NotificationClickCallback
): () => void {
  try {
    if (window.electronAPI?.notification) {
      // 包装回调，将 API 层的 {conversationId} 对象转换为简单的 string 参数
      const wrappedCallback = (data: { conversationId: string }) => {
        callback(data.conversationId);
      };
      window.electronAPI.notification.onClicked(wrappedCallback);
      return () => {
        window.electronAPI?.notification?.offClicked(wrappedCallback);
      };
    }
  } catch (error) {
    console.warn('Failed to add notification click listener:', error);
  }
  return () => {};
}

/**
 * 检查系统是否支持通知
 * @description 检查 Electron 环境和通知 API 是否可用
 * @returns boolean 是否支持
 */
export function isNotificationSupported(): boolean {
  try {
    return !!(window.electronAPI?.notification);
  } catch (error) {
    console.warn('Failed to check notification support:', error);
  }
  return false;
}
