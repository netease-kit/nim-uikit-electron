/**
 * 窗口关闭 IPC 处理器
 * @description 处理窗口关闭相关的 IPC 通信
 */
import { ipcMain } from 'electron';
import {
  getClosePreference,
  setClosePreference,
  setWaitingForCloseConfirmation,
  getIsQuitting,
  minimizeToTray,
  quitApplication,
  type ClosePreference,
} from './window-close.service';

/**
 * 注册窗口关闭相关的 IPC 处理器
 * 必须在 app.whenReady() 之后调用
 */
export function registerWindowCloseHandlers(): void {
  // 监听渲染进程发送的用户选择
  ipcMain.on(
    'window:close-action-selected',
    (
      _event,
      data: { action: 'minimize' | 'quit' | 'cancel'; remember: boolean }
    ) => {
      setWaitingForCloseConfirmation(false);

      // 如果是取消操作，直接返回，不执行任何其他操作
      if (data.action === 'cancel') {
        return;
      }

      if (data.remember) {
        // 保存用户选择
        setClosePreference(data.action);
      }

      if (data.action === 'minimize') {
        minimizeToTray();
      } else if (data.action === 'quit') {
        quitApplication();
      }
    }
  );

  // 处理获取关闭行为偏好的请求
  ipcMain.handle('window:get-close-preference', async () => {
    return getClosePreference();
  });

  // 处理设置关闭行为偏好的请求
  ipcMain.handle(
    'window:set-close-preference',
    async (_event, preference: ClosePreference) => {
      setClosePreference(preference);
    }
  );

  // 处理查询应用是否正在退出的请求
  ipcMain.handle('window:is-app-quitting', async () => {
    return getIsQuitting();
  });
}
