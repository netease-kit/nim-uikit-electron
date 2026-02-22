/**
 * 托盘 Preload API
 * @description 暴露给渲染进程的托盘相关 API
 */
import { ipcRenderer } from 'electron';

/**
 * 托盘 API 接口定义
 */
export interface TrayAPI {
  /** 更新未读消息数 */
  updateUnreadCount: (count: number) => void;
  /** 更新语言设置 */
  updateLanguage: (language: string) => void;
  /** 监听请求未读数事件 */
  onRequestUnreadCount: (callback: () => void) => void;
}

/**
 * 创建托盘相关的 Preload API
 */
export function createTrayAPI(): TrayAPI {
  return {
    updateUnreadCount: (count: number) => {
      ipcRenderer.send('tray:update-unread-count', count);
    },
    
    updateLanguage: (language: string) => {
      ipcRenderer.send('tray:update-language', language);
    },
    
    onRequestUnreadCount: (callback: () => void) => {
      ipcRenderer.on('tray:request-unread-count', callback);
    },
  };
}
