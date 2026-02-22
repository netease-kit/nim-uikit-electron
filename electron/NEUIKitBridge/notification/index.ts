/**
 * 通知模块
 * @description 提供桌面通知相关功能
 */

// 服务层 - 业务逻辑
export {
  initNotificationService,
  showNotification,
  isNotificationSupported,
  type NotificationOptions,
} from './notification.service';

// 处理器层 - IPC 通信
export { registerNotificationHandlers } from './notification.handler';

// API 层 - Preload 暴露
export {
  createNotificationAPI,
  type NotificationAPI,
  type NotificationClickCallback,
} from './notification.api';
