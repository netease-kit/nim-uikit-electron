/**
 * 本地文件协议模块
 * @description 注册自定义协议以支持渲染进程访问本地文件
 */
import { protocol } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * 自定义协议名称
 * 使用方式：local-file://localhost/path/to/file.jpg
 */
export const LOCAL_FILE_PROTOCOL = "local-file";

/**
 * 将本地文件路径转换为自定义协议 URL
 * @param filePath 本地文件绝对路径
 * @returns 自定义协议 URL
 *
 * @example
 * toLocalFileUrl('/Users/xxx/file.jpg')
 * // => 'local-file://localhost/Users/xxx/file.jpg'
 */
export function toLocalFileUrl(filePath: string): string {
  if (!filePath) return "";

  // 如果已经是 URL（http/https/blob/data），直接返回
  if (/^(https?|blob|data):/.test(filePath)) {
    return filePath;
  }

  // 如果已经是自定义协议 URL，直接返回
  if (filePath.startsWith(`${LOCAL_FILE_PROTOCOL}:`)) {
    return filePath;
  }

  // 标准化路径分隔符
  const normalizedPath = filePath.replace(/\\/g, "/");

  // 确保路径以 / 开头
  const urlPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;

  // 使用 localhost 作为主机名，避免路径被当作主机名处理（主机名会被转为小写）
  return `${LOCAL_FILE_PROTOCOL}://localhost${urlPath}`;
}

/**
 * 从自定义协议 URL 中提取本地文件路径
 * @param url 自定义协议 URL
 * @returns 本地文件路径
 *
 * @note URL 格式为 local-file://localhost/path/to/file
 *       使用 localhost 作为主机名，避免路径被当作主机名处理（主机名会被转为小写）
 */
export function fromLocalFileUrl(url: string): string {
  if (!url) return "";

  try {
    // 使用 URL 对象解析，pathname 保持原有大小写
    const urlObj = new URL(url);
    let filePath = decodeURIComponent(urlObj.pathname);

    // Windows 路径处理：移除开头的 / (如 /C:/...)
    if (process.platform === "win32" && /^\/[A-Za-z]:/.test(filePath)) {
      filePath = filePath.slice(1);
    }

    return filePath;
  } catch {
    // URL 解析失败时的后备方案
    const protocolSeparator = "://";
    const separatorIndex = url.indexOf(protocolSeparator);

    if (separatorIndex === -1) return url;

    // 从 :// 后截取
    let filePath = url.slice(separatorIndex + protocolSeparator.length);

    // 移除 localhost 主机名
    if (filePath.startsWith("localhost/")) {
      filePath = filePath.slice("localhost".length);
    } else if (filePath.startsWith("localhost")) {
      filePath = filePath.slice("localhost".length);
    }

    // 处理 URL 编码
    filePath = decodeURIComponent(filePath);

    // Windows 路径处理
    if (process.platform === "win32" && /^\/[A-Za-z]:/.test(filePath)) {
      filePath = filePath.slice(1);
    }

    return filePath;
  }
}

/**
 * 获取文件的 MIME 类型
 * @param filePath 文件路径
 * @returns MIME 类型
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    // 图片
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    // 视频
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    // 音频
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    // 文档
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".json": "application/json",
    ".xml": "application/xml",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    // 压缩文件
    ".zip": "application/zip",
    ".rar": "application/x-rar-compressed",
    ".7z": "application/x-7z-compressed",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * 注册本地文件自定义协议
 * @description 必须在 app.whenReady() 之前调用
 */
export function registerLocalFileProtocol(): void {
  // 注册为标准协议（支持 fetch、XHR 等）
  protocol.registerSchemesAsPrivileged([
    {
      scheme: LOCAL_FILE_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

/**
 * 初始化本地文件协议处理器
 * @description 必须在 app.whenReady() 之后调用
 */
export function initLocalFileProtocol(): void {
  protocol.handle(LOCAL_FILE_PROTOCOL, async (request) => {
    const filePath = fromLocalFileUrl(request.url);

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return new Response("File not found", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        });
      }

      // 获取文件信息
      const stat = fs.statSync(filePath);
      const mimeType = getMimeType(filePath);

      // 处理范围请求（用于视频/音频的分段加载）
      const rangeHeader = request.headers.get("Range");

      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0;
          const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
          const chunkSize = end - start + 1;

          const stream = fs.createReadStream(filePath, { start, end });
          let isClosed = false;

          const readable = new ReadableStream({
            start(controller) {
              stream.on("data", (chunk) => {
                if (!isClosed) {
                  try {
                    controller.enqueue(chunk);
                  } catch {
                    // 控制器已关闭，忽略
                    isClosed = true;
                    stream.destroy();
                  }
                }
              });
              stream.on("end", () => {
                if (!isClosed) {
                  isClosed = true;
                  controller.close();
                }
              });
              stream.on("error", (err) => {
                if (!isClosed) {
                  isClosed = true;
                  controller.error(err);
                }
              });
            },
            cancel() {
              isClosed = true;
              stream.destroy();
            },
          });

          return new Response(readable, {
            status: 206,
            headers: {
              "Content-Type": mimeType,
              "Content-Length": String(chunkSize),
              "Content-Range": `bytes ${start}-${end}/${stat.size}`,
              "Accept-Ranges": "bytes",
            },
          });
        }
      }

      // 普通请求：返回完整文件
      const fileBuffer = fs.readFileSync(filePath);

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(stat.size),
          "Accept-Ranges": "bytes",
        },
      });
    } catch (error) {
      console.error("[LocalFileProtocol] Error reading file:", filePath, error);
      return new Response("Internal Server Error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }
  });

  console.log("[FsProtocol] Local file protocol handler initialized");
}
