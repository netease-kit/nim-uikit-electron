/**
 * 版本 IPC 处理器
 * @description 处理版本相关的 IPC 通信
 */
import { ipcMain } from 'electron';
import { getAppVersion } from './version.service';

/**
 * 注册版本相关的 IPC 处理器
 */
export function registerVersionHandlers(): void {
  // 提供应用版本号给渲染进程
  ipcMain.handle('version:get-app-version', async () => {
    return getAppVersion();
  });
}
