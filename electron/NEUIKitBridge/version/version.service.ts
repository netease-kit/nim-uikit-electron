/**
 * 版本服务模块
 * @description 版本相关的业务逻辑实现
 */
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * 从 package.json 读取应用版本号
 * @returns 应用版本号，读取失败时返回默认值 "0.1.0"
 */
export function getAppVersion(): string {
  // 使用 main.ts 中设置的环境变量
  const packageJsonPath = path.join(process.env.APP_ROOT!, "package.json");
  const defaultVersion = "0.1.0";
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || defaultVersion;
  } catch (error) {
    console.error("Failed to read package.json:", error);
    return defaultVersion;
  }
}
