/**
 * 应用模块
 * @description 提供应用控制相关功能（重启、开发者工具等）
 */

// 处理器层 - IPC 通信
export { 
  initApp, 
  getMainWindow, 
  registerAppHandlers 
} from './app.handler';

// API 层 - Preload 暴露
export { createAppAPI, type AppAPI } from './app.api';
