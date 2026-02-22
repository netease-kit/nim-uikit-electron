/**
 * 导航 Preload API
 * @description 暴露给渲染进程的导航相关 API
 */
import { ipcRenderer } from 'electron';

/**
 * 导航 API 接口定义
 */
export interface NavigationAPI {
  /** 监听导航到关于页面的事件 */
  onNavigateToAbout: (callback: () => void) => void;
  /** 移除导航到关于页面的监听器 */
  removeNavigateToAboutListener: () => void;
}

/**
 * 创建导航相关的 Preload API
 */
export function createNavigationAPI(): NavigationAPI {
  return {
    onNavigateToAbout: (callback: () => void) => {
      ipcRenderer.on('navigation:to-about', callback);
    },
    
    removeNavigateToAboutListener: () => {
      ipcRenderer.removeAllListeners('navigation:to-about');
    },
  };
}
