/**
 * 托盘模块
 * @description 提供系统托盘相关功能
 */

// 服务层 - 业务逻辑
export {
  initTray,
  updateTrayIcon,
  updateTrayMenu,
  updateTrayTooltip,
  destroyTray,
} from './tray.service';

// 处理器层 - IPC 通信
export { registerTrayHandlers } from './tray.handler';

// API 层 - Preload 暴露
export { createTrayAPI, type TrayAPI } from './tray.api';
