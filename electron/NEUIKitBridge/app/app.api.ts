/**
 * 应用 Preload API
 * @description 暴露给渲染进程的应用控制相关 API
 */
import { ipcRenderer } from 'electron';

/**
 * 应用 API 接口定义
 */
export interface AppAPI {
  /** 打开开发者工具 */
  openDevTools: () => Promise<void>;
  /** 重启应用 */
  relaunch: () => Promise<void>;
}

/**
 * 创建应用控制相关的 Preload API
 */
export function createAppAPI(): AppAPI {
  return {
    openDevTools: () => {
      return ipcRenderer.invoke('app:open-devtools');
    },
    
    relaunch: () => {
      return ipcRenderer.invoke('app:relaunch');
    },
  };
}
