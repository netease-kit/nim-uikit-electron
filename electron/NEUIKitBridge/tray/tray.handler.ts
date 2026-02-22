/**
 * 托盘 IPC 处理器
 * @description 处理托盘相关的 IPC 通信
 */
import { ipcMain, app } from 'electron';
import { updateTrayIcon, updateTrayMenu, updateTrayTooltip } from './tray.service';
import { setLanguage, type Language } from '../i18n';

/**
 * 注册托盘相关的 IPC 处理器
 * @param onQuit 退出回调函数
 * @param getMainWindow 获取主窗口实例的函数
 */
export function registerTrayHandlers(
  onQuit: () => void,
  getMainWindow: () => Electron.BrowserWindow | null
): void {
  // 监听渲染进程发送的未读消息数更新
  ipcMain.on('tray:update-unread-count', (_, count: number) => {
    // 更新托盘图标显示未读数 badge
    updateTrayIcon(count);
    
    // macOS Dock 图标显示未读数
    if (process.platform === 'darwin') {
      if (count > 0) {
        app.dock?.setBadge(count.toString());
      } else {
        app.dock?.setBadge('');
      }
    }
  });
  
  // 监听渲染进程发送的语言切换事件
  ipcMain.on('tray:update-language', (_, language: Language) => {
    setLanguage(language);
    // 重新创建托盘 tooltip
    updateTrayTooltip();
    // 重新更新托盘菜单以应用新语言
    updateTrayMenu(onQuit);
    // 重新获取当前未读数并更新图标
    const mainWindow = getMainWindow();
    mainWindow?.webContents.send('tray:request-unread-count');
  });
}
