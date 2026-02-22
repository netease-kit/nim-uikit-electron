/**
 * 版本 Preload API
 * @description 暴露给渲染进程的版本相关 API
 */
import { ipcRenderer } from 'electron';

/**
 * 版本 API 接口定义
 */
export interface VersionAPI {
  /** 获取应用版本号 */
  getAppVersion: () => Promise<string>;
}

/**
 * 创建版本相关的 Preload API
 */
export function createVersionAPI(): VersionAPI {
  return {
    getAppVersion: () => {
      return ipcRenderer.invoke('version:get-app-version');
    },
  };
}
