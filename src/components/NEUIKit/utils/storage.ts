/**
 * ============================================================================
 * 统一存储工具类 - 渲染进程使用
 * ============================================================================
 *
 * 提供便于使用的存储接口，替换项目中的所有 localStorage 使用
 *
 * 特点：
 * - 自动处理异步操作
 * - 缓存机制提高性能
 * - 兼容 localStorage API
 * - 支持开发和生产模式持久化
 */

/**
 * 存储管理类
 */
class StorageManager {
  private cache: Map<string, string> = new Map();
  private initialized = false;

  /**
   * 初始化存储，加载所有数据到缓存
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const keys = await window.electronAPI.storage.keys();
      for (const key of keys) {
        const value = await window.electronAPI.storage.getItem(key);
        if (value) {
          this.cache.set(key, value);
        }
      }
      this.initialized = true;
      console.log("[StorageManager] 初始化完成，已加载", this.cache.size, "个配置项");
    } catch (error) {
      console.error("[StorageManager] 初始化失败:", error);
    }
  }

  /**
   * 同步获取存储项（优先从缓存获取，回退到 localStorage）
   */
  getItem(key: string): string | null {
    // 优先从缓存获取
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // 回退到 localStorage（兼容性）
    return localStorage.getItem(key);
  }

  /**
   * 异步获取存储项（直接从持久化存储获取）
   */
  async getItemAsync(key: string): Promise<string | null> {
    try {
      const value = await window.electronAPI.storage.getItem(key);
      if (value) {
        this.cache.set(key, value);
      }
      return value;
    } catch (error) {
      console.error("[StorageManager] getItemAsync 失败:", error);
      return this.getItem(key);
    }
  }

  /**
   * 设置存储项
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      await window.electronAPI.storage.setItem(key, value);
      this.cache.set(key, value);
    } catch (error) {
      console.error("[StorageManager] setItem 失败:", error);
      // 回退到 localStorage
      localStorage.setItem(key, value);
      this.cache.set(key, value);
    }
  }

  /**
   * 移除存储项
   */
  async removeItem(key: string): Promise<void> {
    try {
      await window.electronAPI.storage.removeItem(key);
      this.cache.delete(key);
    } catch (error) {
      console.error("[StorageManager] removeItem 失败:", error);
      // 回退到 localStorage
      localStorage.removeItem(key);
      this.cache.delete(key);
    }
  }

  /**
   * 保存登录信息
   */
  async saveLoginInfo(account: string, token: string): Promise<void> {
    try {
      const loginInfo = { account, token };
      await window.electronAPI.storage.saveLoginInfo(loginInfo);
      console.log("[StorageManager] 登录信息已保存");
    } catch (error) {
      console.error("[StorageManager] 保存登录信息失败:", error);
      // 回退到 localStorage
      localStorage.setItem("loginInfo", JSON.stringify({ account, token }));
    }
  }

  /**
   * 获取登录信息
   */
  async getLoginInfo(): Promise<{ account: string; token: string } | null> {
    try {
      const loginInfo = await window.electronAPI.storage.getLoginInfo();
      return loginInfo;
    } catch (error) {
      console.error("[StorageManager] 获取登录信息失败:", error);
      // 回退到 localStorage
      const fallback = localStorage.getItem("loginInfo");
      return fallback ? JSON.parse(fallback) : null;
    }
  }

  /**
   * 清除登录信息
   */
  async clearLoginInfo(): Promise<void> {
    try {
      await window.electronAPI.storage.clearLoginInfo();
      console.log("[StorageManager] 登录信息已清除");
    } catch (error) {
      console.error("[StorageManager] 清除登录信息失败:", error);
      // 回退到 localStorage
      localStorage.removeItem("loginInfo");
    }
  }
}

/**
 * 全局存储管理实例
 */
const storageManager = new StorageManager();

export { StorageManager };
export default storageManager;
