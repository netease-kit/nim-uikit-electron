/**
 * 窗口关闭模块
 * @description 提供窗口关闭行为相关功能
 */

// 服务层 - 业务逻辑
export {
  initWindowClose,
  markAppQuitting,
  handleWindowClose,
  getClosePreference,
  setClosePreference,
  setWaitingForCloseConfirmation,
  setIsQuitting,
  getIsQuitting,
  getMainWindow,
  type ClosePreference,
} from './window-close.service';

// 处理器层 - IPC 通信
export { registerWindowCloseHandlers } from './window-close.handler';

// API 层 - Preload 暴露
export { createWindowCloseAPI, type WindowCloseAPI } from './window-close.api';
