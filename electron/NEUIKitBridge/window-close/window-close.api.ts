/**
 * 窗口关闭 Preload API
 * @description 暴露给渲染进程的窗口关闭相关 API
 */
import { ipcRenderer } from 'electron';

/**
 * 窗口关闭 API 接口定义
 */
export interface WindowCloseAPI {
  /** 监听主进程请求显示关闭确认对话框 */
  onRequestCloseConfirmation: (callback: () => void) => void;
  /** 向主进程发送用户选择的关闭行为 */
  sendCloseActionSelected: (action: 'minimize' | 'quit' | 'cancel', remember: boolean) => void;
  /** 获取用户保存的关闭行为偏好 */
  getClosePreference: () => Promise<'default' | 'minimize' | 'quit'>;
  /** 设置用户关闭行为偏好 */
  setClosePreference: (preference: 'default' | 'minimize' | 'quit') => Promise<void>;
  /** 检查应用是否正在退出 */
  isAppQuitting: () => Promise<boolean>;
}

/**
 * 创建窗口关闭相关的 Preload API
 */
export function createWindowCloseAPI(): WindowCloseAPI {
  return {
    onRequestCloseConfirmation: (callback: () => void) => {
      ipcRenderer.on('window:request-close-confirmation', callback);
    },
    
    sendCloseActionSelected: (action: 'minimize' | 'quit' | 'cancel', remember: boolean) => {
      ipcRenderer.send('window:close-action-selected', { action, remember });
    },
    
    getClosePreference: () => {
      return ipcRenderer.invoke('window:get-close-preference');
    },
    
    setClosePreference: (preference: 'default' | 'minimize' | 'quit') => {
      return ipcRenderer.invoke('window:set-close-preference', preference);
    },
    
    isAppQuitting: () => {
      return ipcRenderer.invoke('window:is-app-quitting');
    },
  };
}
