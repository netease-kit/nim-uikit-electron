import { makeAutoObservable } from "mobx";
import RootStore from ".";
import { V2NIMClient } from "node-nim";
import { logger } from "./utils";
import { V2NIMUploadFileTask } from "node-nim/types/v2_def/v2_nim_struct_def";

/**Mobx 可观察对象，负责管理文件存储的子 store */
export class StorageStore {
  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable(this);
    void this.rootStore;
  }

  /**
   * 上传文件
   * @param fileObj - 文件对象或文件路径
   */
  async uploadFileActive(fileObj?: File | string): Promise<string> {
    logger.log("uploadFileActive", fileObj);
    if (!fileObj) {
      const errorContent = "upload avatar error, no file or filepath";

      logger.warn(errorContent);
      throw new Error(errorContent);
    }

    let avatarUrl = "";

    try {
      // 根据类型获取文件路径
      const filePath =
        typeof fileObj === "string" ? fileObj : (fileObj as any).path || ""; // Electron 环境下的 File 对象有 path 属性

      const task = this.nim.storageService?.createUploadFileTask({
        filePath,
      }) as V2NIMUploadFileTask;

      avatarUrl = (await this.nim.storageService?.uploadFile(task, () => {
        /**/
      })) as string;
    } catch (error) {
      logger.warn("upload avatar error ", error);
      throw error;
    }

    return avatarUrl;
  }
}
