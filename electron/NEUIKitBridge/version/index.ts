/**
 * 版本模块
 * @description 提供应用版本相关功能
 */

// 服务层 - 业务逻辑
export { getAppVersion } from './version.service';

// 处理器层 - IPC 通信
export { registerVersionHandlers } from './version.handler';

// API 层 - Preload 暴露
export { createVersionAPI, type VersionAPI } from './version.api';
