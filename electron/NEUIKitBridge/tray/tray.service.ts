/**
 * 托盘服务模块
 * @description 托盘相关的业务逻辑实现
 */
import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import * as path from "node:path";
import { t } from "../i18n";

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;

/**
 * 更新托盘标题显示未读数（macOS only）
 * @param count 未读数量
 */
export function updateTrayIcon(count: number): void {
  if (!tray) return;
  
  // 在 macOS 上使用 setTitle 在托盘图标旁显示未读数
  if (process.platform === "darwin") {
    if (count > 0) {
      const displayText = count > 99 ? "99+" : count.toString();
      tray.setTitle(displayText, { fontType: "monospacedDigit" });
    } else {
      // 没有未读消息时清空标题
      tray.setTitle("");
    }
  }
}

/**
 * 初始化托盘管理模块
 * @param win 主窗口实例
 * @param onQuit 退出回调函数
 */
export function initTray(win: BrowserWindow, onQuit: () => void): void {
  mainWindow = win;
  createTray(onQuit);
}

/**
 * 创建系统托盘图标
 * @param onQuit 退出回调函数
 */
function createTray(onQuit: () => void): void {
  // 创建托盘图标 - 使用 main.ts 中设置的环境变量
  const iconPath = path.join(process.env.VITE_PUBLIC!, "logo.png");
  
  // 创建 NativeImage 并调整大小适配 macOS 托盘
  const icon = nativeImage.createFromPath(iconPath);
  const trayIcon = icon.resize({ width: 16, height: 16 });
  
  tray = new Tray(trayIcon);
  tray.setToolTip(t("trayTooltipText"));
  
  // 点击托盘图标显示窗口
  tray.on("click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 只有窗口不可见时才显示
      if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
      // 窗口可见时不做任何操作
    }
  });
  
  // 创建托盘右键菜单
  updateTrayMenu(onQuit);
}

/**
 * 更新托盘菜单
 * @param onQuit 退出回调函数
 */
export function updateTrayMenu(onQuit?: () => void): void {
  if (!tray) return;
  
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: t("trayShowWindowText"),
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      type: "separator",
    },
    {
      label: t("trayAboutText"),
      click: () => {
        // 显示窗口并发送导航事件到关于页面
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send("navigation:to-about");
        }
      },
    },
    {
      label: t("trayQuitText"),
      click: () => {
        if (onQuit) {
          onQuit();
        }
        app.quit();
      },
    },
  ];
  
  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
}

/**
 * 更新托盘提示文本（用于国际化切换）
 */
export function updateTrayTooltip(): void {
  if (tray) {
    tray.setToolTip(t("trayTooltipText"));
  }
}

/**
 * 销毁托盘实例
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
