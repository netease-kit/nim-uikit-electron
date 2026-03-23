/**
 * ============================================================================
 * NEUIKitBridge 统一导出文件
 * ============================================================================
 *
 * NEUIKitBridge 是一个可独立拷贝的 Electron 主进程功能模块集合。
 * 本文件提供所有模块的统一导出,方便主进程文件统一引入。
 *
 * 使用方式:
 *   // 在 main.ts 中统一导入所有需要的模块
 *   import {
 *     initTray,
 *     registerTrayHandlers,
 *     initWindowClose,
 *     registerWindowCloseHandlers,
 *     // ... 其他需要的导出
 *   } from './NEUIKitBridge';
 *
 * 可用模块:
 *   - tray: 系统托盘功能（图标、菜单、未读数显示）
 *   - window-close: 窗口关闭行为管理（隐藏到托盘 vs 真正退出）
 *   - app: 应用控制（重启、DevTools）
 *   - version: 版本信息获取
 *   - notification: 桌面通知
 *   - fs: 文件系统操作（文件读写、目录管理、本地文件协议）
 *   - navigation: 页面导航事件
 *   - i18n: 国际化支持
 *   - storage: 本地存储
 *   - store: 状态管理
 */

// ============================================================================
// Tray 模块 - 系统托盘
// ============================================================================
export {
  // 服务层
  initTray,
  updateTrayIcon,
  updateTrayMenu,
  updateTrayTooltip,
  destroyTray,
  // 处理器层
  registerTrayHandlers,
  // API 层
  createTrayAPI,
  type TrayAPI,
} from './tray';

// ============================================================================
// Window Close 模块 - 窗口关闭行为
// ============================================================================
export {
  // 服务层
  initWindowClose,
  markAppQuitting,
  handleWindowClose,
  getClosePreference,
  setClosePreference,
  setWaitingForCloseConfirmation,
  setIsQuitting,
  getIsQuitting,
  // 处理器层
  registerWindowCloseHandlers,
  // API 层
  createWindowCloseAPI,
  type WindowCloseAPI,
  type ClosePreference,
} from './window-close';

// ============================================================================
// App 模块 - 应用控制
// ============================================================================
export {
  // 服务层
  initApp,
  // 处理器层
  registerAppHandlers,
  // API 层
  createAppAPI,
  type AppAPI,
} from './app';

// ============================================================================
// Version 模块 - 版本信息
// ============================================================================
export {
  // 服务层
  getAppVersion,
  // 处理器层
  registerVersionHandlers,
  // API 层
  createVersionAPI,
  type VersionAPI,
} from './version';

// ============================================================================
// Notification 模块 - 桌面通知
// ============================================================================
export {
  // 服务层
  initNotificationService,
  showNotification,
  isNotificationSupported,
  type NotificationOptions,
  // 处理器层
  registerNotificationHandlers,
  // API 层
  createNotificationAPI,
  type NotificationAPI,
  type NotificationClickCallback,
} from './notification';

// ============================================================================
// FS 模块 - 文件系统
// ============================================================================
export {
  // Preload API
  createFsAPI,
  type FsAPI,
  type AppPathName,
  type FileStat,
  // 类型
  type OpenDialogOptions,
  type ChooseFileOptions,
  type ChooseFileResult,
  type SaveClipboardFileOptions,
  type FileType,
  // IPC 处理器
  registerFsHandlers,
  // 协议相关
  registerLocalFileProtocol,
  initLocalFileProtocol,
  toLocalFileUrl,
  fromLocalFileUrl,
  LOCAL_FILE_PROTOCOL,
  // 服务层
  fsService,
} from './fs';

// ============================================================================
// Navigation 模块 - 页面导航
// ============================================================================
export {
  createNavigationAPI,
  type NavigationAPI,
} from './navigation';

// ============================================================================
// I18n 模块 - 国际化
// ============================================================================
export * from './i18n';
