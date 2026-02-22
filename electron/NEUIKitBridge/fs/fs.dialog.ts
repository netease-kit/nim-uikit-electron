/**
 * 文件对话框服务（主进程）
 * @description 处理文件选择对话框和剪贴板文件保存相关功能
 */
import { dialog, BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import sizeOf from "./image-size-util";
import type { ChooseFileResult, FileType } from "./fs.types";

/** MIME 类型到文件扩展名的映射 */
const MIME_TO_EXTENSION: Record<string, string> = {
  // 图片
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/webp": ".webp",
  // 视频
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/x-msvideo": ".avi",
  "video/x-matroska": ".mkv",
  "video/webm": ".webm",
  // 其他常见类型
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/x-rar-compressed": ".rar",
};

/**
 * 根据 MIME 类型获取文件扩展名
 */
function getExtensionFromMimeType(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] || "";
}

/**
 * 根据 MIME 类型判断文件类型
 */
function getFileTypeFromMime(mimeType: string): FileType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

/**
 * 生成临时文件路径
 */
function getTempFilePath(extension: string): string {
  const tempDir = os.tmpdir();
  const uniqueId = crypto.randomBytes(16).toString("hex");
  const fileName = `nim-paste-${uniqueId}${extension}`;
  return path.join(tempDir, fileName);
}

/**
 * 视频元数据接口
 */
interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  previewImg: string;
}

/**
 * 使用隐藏的 BrowserWindow 获取视频元数据
 * @param filePath 视频文件的本地路径
 * @returns 视频元数据（宽、高、时长、首帧预览图）
 */
async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    // 创建隐藏窗口
    const hiddenWindow = new BrowserWindow({
      width: 1,
      height: 1,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // 允许加载本地文件
      },
    });

    const fileUrl = `file://${filePath}`;

    // 设置超时
    const timeout = setTimeout(() => {
      console.warn("[fs:dialog] 获取视频元数据超时");
      hiddenWindow.destroy();
      resolve({ width: 0, height: 0, duration: 0, previewImg: "" });
    }, 15000);

    // 加载一个简单的 HTML 页面来处理视频
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Video Metadata</title></head>
      <body>
        <video id="video" style="display:none"></video>
        <canvas id="canvas" style="display:none"></canvas>
        <script>
          window.__videoMetadataResult = null;

          const video = document.getElementById('video');
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d');

          let resolved = false;

          const setResult = (result) => {
            if (!resolved) {
              resolved = true;
              window.__videoMetadataResult = result;
            }
          };

          video.oncanplay = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const previewImg = canvas.toDataURL('image/jpeg', 0.8);
                setResult({
                  width: video.videoWidth,
                  height: video.videoHeight,
                  duration: Math.floor(video.duration),
                  previewImg: previewImg,
                });
              } catch (e) {
                setResult({
                  width: video.videoWidth,
                  height: video.videoHeight,
                  duration: Math.floor(video.duration),
                  previewImg: '',
                });
              }
            } else {
              setResult({
                width: video.videoWidth || 0,
                height: video.videoHeight || 0,
                duration: Math.floor(video.duration) || 0,
                previewImg: '',
              });
            }
          };

          video.onerror = (e) => {
            console.error('Video load error:', e);
            setResult({ width: 0, height: 0, duration: 0, previewImg: '' });
          };

          video.preload = 'auto';
          video.muted = true;
          video.src = '${fileUrl.replace(/'/g, "\\'")}';
          video.load();
        </script>
      </body>
      </html>
    `;

    // 加载 HTML
    hiddenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // 页面加载完成后，轮询获取结果
    hiddenWindow.webContents.on("did-finish-load", () => {
      const pollInterval = setInterval(async () => {
        try {
          const result = await hiddenWindow.webContents.executeJavaScript(
            "window.__videoMetadataResult"
          );
          if (result) {
            clearInterval(pollInterval);
            clearTimeout(timeout);
            hiddenWindow.destroy();
            resolve(result);
          }
        } catch (e) {
          // 窗口可能已被销毁
          clearInterval(pollInterval);
        }
      }, 100);

      // 10秒后停止轮询
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 10000);
    });
  });
}

/**
 * 显示打开文件对话框处理器
 */
export async function showOpenDialogHandler(
  _event: Electron.IpcMainInvokeEvent,
  options?: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: Array<"openFile" | "openDirectory" | "multiSelections">;
  }
): Promise<string[] | undefined> {
  const win = BrowserWindow.getFocusedWindow();

  const result = await dialog.showOpenDialog(win!, {
    title: options?.title,
    filters: options?.filters,
    properties: options?.properties || ["openFile"],
  });

  if (result.canceled) {
    return undefined;
  }

  return result.filePaths;
}

/**
 * 选择文件处理器
 */
export async function chooseFileHandler(
  _event: Electron.IpcMainInvokeEvent,
  options: {
    type: FileType;
    extensions?: string[];
    title?: string;
  }
): Promise<ChooseFileResult | undefined> {
  const win = BrowserWindow.getFocusedWindow();

  // 根据类型设置默认扩展名
  let extensions = options.extensions;
  if (!extensions) {
    switch (options.type) {
      case "image":
        extensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
        break;
      case "video":
        extensions = ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"];
        break;
      default:
        extensions = ["*"];
    }
  }

  const filterName =
    options.type === "image" ? "Images" : options.type === "video" ? "Videos" : "Files";

  const result = await dialog.showOpenDialog(win!, {
    title: options.title,
    properties: ["openFile"],
    filters: [{ name: filterName, extensions }],
  });

  if (result.canceled || !result.filePaths.length) {
    return undefined;
  }

  const filePath = result.filePaths[0];

  try {
    const stats = await fs.promises.stat(filePath);

    // 检查是否是目录（Linux 可能会选到文件夹）
    if (stats.isDirectory()) {
      console.error("[fs:dialog] 选择的是文件夹，不是文件");
      return undefined;
    }

    const fileResult: ChooseFileResult = {
      type: options.type,
      file: {
        url: filePath,
        name: path.basename(filePath),
        size: stats.size,
      },
    };

    // 如果是图片类型，获取 base64 和尺寸
    if (options.type === "image") {
      try {
        const ext = path.extname(filePath).substring(1).toLowerCase();
        const base64Prefix = `data:image/${ext};base64,`;
        const fileBuffer = await fs.promises.readFile(filePath);
        fileResult.file.base64 = base64Prefix + fileBuffer.toString("base64");

        // 获取图片尺寸（使用 buffer 传入）
        const dimensions = sizeOf(fileBuffer);
        fileResult.file.width = dimensions.width;
        fileResult.file.height = dimensions.height;
      } catch (e) {
        console.error("[fs:dialog] 获取图片信息失败:", e);
      }
    }

    // 如果是视频类型，使用隐藏窗口获取元数据
    if (options.type === "video") {
      try {
        const videoMeta = await getVideoMetadata(filePath);
        fileResult.file.width = videoMeta.width;
        fileResult.file.height = videoMeta.height;
        fileResult.file.duration = videoMeta.duration;
        fileResult.file.base64 = videoMeta.previewImg;
        console.log("[fs:dialog] 视频元数据获取成功:", {
          width: videoMeta.width,
          height: videoMeta.height,
          duration: videoMeta.duration,
          hasPreview: !!videoMeta.previewImg,
        });
      } catch (e) {
        console.error("[fs:dialog] 获取视频元数据失败:", e);
      }
    }

    return fileResult;
  } catch (err) {
    console.error("[fs:dialog] 读取文件信息失败:", err);
    return undefined;
  }
}

/**
 * 保存剪贴板文件处理器
 */
export async function saveClipboardFileHandler(
  _event: Electron.IpcMainInvokeEvent,
  options: {
    buffer: number[];
    mimeType: string;
    fileName?: string;
  }
): Promise<ChooseFileResult | undefined> {
  try {
    const { buffer, mimeType, fileName } = options;

    // 将数组转换为 Buffer
    const fileBuffer = Buffer.from(buffer);

    // 确定文件扩展名
    let extension = getExtensionFromMimeType(mimeType);
    if (!extension && fileName) {
      extension = path.extname(fileName);
    }
    if (!extension) {
      extension = ".bin";
    }

    // 确定文件类型
    const fileType = getFileTypeFromMime(mimeType);

    // 生成临时文件路径
    const tempFilePath = getTempFilePath(extension);

    // 写入文件
    await fs.promises.writeFile(tempFilePath, fileBuffer);

    // 获取文件名
    const finalFileName = fileName || path.basename(tempFilePath);

    const fileResult: ChooseFileResult = {
      type: fileType,
      file: {
        url: tempFilePath,
        name: finalFileName,
        size: fileBuffer.length,
      },
    };

    // 如果是图片类型，获取 base64 和尺寸
    if (fileType === "image") {
      try {
        const ext = extension.substring(1).toLowerCase();
        const base64Prefix = `data:image/${ext};base64,`;
        fileResult.file.base64 = base64Prefix + fileBuffer.toString("base64");

        // 获取图片尺寸
        const dimensions = sizeOf(fileBuffer);
        fileResult.file.width = dimensions.width;
        fileResult.file.height = dimensions.height;
      } catch (e) {
        console.error("[fs:dialog] 获取粘贴图片信息失败:", e);
      }
    }

    // 如果是视频类型，获取元数据
    if (fileType === "video") {
      try {
        const videoMeta = await getVideoMetadata(tempFilePath);
        fileResult.file.width = videoMeta.width;
        fileResult.file.height = videoMeta.height;
        fileResult.file.duration = videoMeta.duration;
        fileResult.file.base64 = videoMeta.previewImg;
      } catch (e) {
        console.error("[fs:dialog] 获取粘贴视频元数据失败:", e);
      }
    }

    console.log("[fs:dialog] 剪贴板文件保存成功:", {
      type: fileType,
      path: tempFilePath,
      size: fileBuffer.length,
    });

    return fileResult;
  } catch (err) {
    console.error("[fs:dialog] 保存剪贴板文件失败:", err);
    return undefined;
  }
}
