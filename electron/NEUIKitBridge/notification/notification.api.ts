/**
 * 通知 Preload API
 * @description 暴露给渲染进程的通知相关 API
 */
import { ipcRenderer } from 'electron';

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
 * 通知点击事件回调类型
 */
export type NotificationClickCallback = (data: { conversationId: string }) => void;

/**
 * 通知 API 接口定义
 */
export interface NotificationAPI {
  /** 显示桌面通知 */
  show: (options: NotificationOptions) => Promise<{ success: boolean; error?: string }>;
  /** 监听通知点击事件 */
  onClicked: (callback: NotificationClickCallback) => void;
  /** 移除通知点击事件监听 */
  offClicked: (callback: NotificationClickCallback) => void;
}

/**
 * 创建通知相关的 Preload API
 */
export function createNotificationAPI(): NotificationAPI {
  // 存储回调函数的包装器，用于正确移除监听
  const callbackMap = new WeakMap<
    NotificationClickCallback,
    (event: Electron.IpcRendererEvent, data: { conversationId: string }) => void
  >();

  return {
    show: async (options: NotificationOptions) => {
      return await ipcRenderer.invoke('notification:show', options);
    },

    onClicked: (callback: NotificationClickCallback) => {
      const wrapper = (
        _event: Electron.IpcRendererEvent,
        data: { conversationId: string }
      ) => {
        callback(data);
      };
      callbackMap.set(callback, wrapper);
      ipcRenderer.on('notification:clicked', wrapper);
    },

    offClicked: (callback: NotificationClickCallback) => {
      const wrapper = callbackMap.get(callback);
      if (wrapper) {
        ipcRenderer.removeListener('notification:clicked', wrapper);
        callbackMap.delete(callback);
      }
    },
  };
}
