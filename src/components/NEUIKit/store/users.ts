import { makeAutoObservable, runInAction } from "mobx";
import { V2NIMClient } from "node-nim";
import { frequencyControl } from "./utils";
import {
  V2NIMUploadFileTask,
  V2NIMUser,
  V2NIMUserUpdateParams,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import { MyUserServerExt } from "./types";
import * as storeUtils from "./utils";
import RootStore from ".";

/**Mobx 可观察对象，负责管理用户信息（包含陌生人）的子 store */
export class UserStore {
  users: Map<string, V2NIMUser> = new Map();
  myUserInfo: V2NIMUser = {
    accountId: this.nim?.loginService?.getLoginUser(),
    name: "",
    createTime: Date.now(),
    updateTime: Date.now(),
  };
  logger: typeof storeUtils.logger | null = null;

  private _getUserInfo = frequencyControl(this._getUserInfos, 1000, 100);

  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable(this);
    this._onUserProfileChanged = this._onUserProfileChanged.bind(this);
    this.logger = this.rootStore.logger;

    // 用户资料变更回调，返回变更的用户资料列表
    nim.userService?.on("userProfileChanged", this._onUserProfileChanged);
  }

  resetState(): void {
    this.users.clear();
    this.myUserInfo = {
      accountId: this.nim?.loginService?.getLoginUser(),
      name: "",
      createTime: Date.now(),
      updateTime: Date.now(),
    };
  }

  /**
   * 销毁UserStore，会取消相关事件监听
   */
  destroy(): void {
    this.resetState();
    this.nim.userService?.off("userProfileChanged", this._onUserProfileChanged);
  }
  /**
   * 内存中增加users
   * @param users - users数组
   */
  addUsers(users: V2NIMUser[]): void {
    users
      .filter((item) => !!item.accountId)
      .forEach((item) => {
        this.users.set(item.accountId as string, item);
      });
  }
  /**
   * 内存中删除users
   * @param users - users数组
   */
  removeUsers(accounts: string[]): void {
    accounts.forEach((item) => {
      this.users.delete(item);
    });
  }
  /**
   * 获取我自己的 serverExtension 字段
   */
  getMyUserServerExt(): MyUserServerExt {
    let serverExt: MyUserServerExt = {};

    try {
      serverExt = JSON.parse(this.myUserInfo?.serverExtension || "{}");
    } catch {
      //
    }

    return serverExt;
  }
  /**
   * 更新自己的用户资料
   * @param updateParams
   * updateParams.nick - 昵称 <br>
   * updateParams.avatar - 头像 <br>
   * updateParams.sign - 签名 <br>
   * updateParams.gender - 性别 <br>
   * updateParams.email - 邮箱 <br>
   * updateParams.birth - 生日 <br>
   * updateParams.tel - 手机号 <br>
   * updateParams.serverExtension - 扩展字段 <br>
   *
   * @param fileObj - 头像文件对象、或者在小程序中，文件路径
   */
  async updateSelfUserProfileActive(
    updateParams: V2NIMUserUpdateParams,
    fileObj?: File | string
  ): Promise<void> {
    try {
      this.logger?.log("updateSelfUserProfileActive", updateParams, fileObj);
      if (fileObj) {
        const filePath =
          typeof fileObj === "string" ? fileObj : (fileObj as any).path;
        try {
          const task = this.nim.storageService?.createUploadFileTask({
            filePath,
          }) as V2NIMUploadFileTask;
          const avatarUrl = await this.nim.storageService?.uploadFile(
            task,
            () => {
              /**/
            }
          );

          updateParams.avatar = avatarUrl;
        } catch (error) {
          this.logger?.warn("upload avatar error and save continue.", error);
        }
      }

      await this.nim.userService?.updateSelfUserProfile(updateParams);
      this.logger?.log(
        "updateSelfUserProfileActive success",
        updateParams,
        fileObj
      );
    } catch (error) {
      this.logger?.error(
        "updateSelfUserProfileActive failed:",
        updateParams,
        error,
        fileObj
      );
      throw error;
    }
  }

  /**
   * 获取用户最新信息（如果内存中存在，就不去服务器取最新的了）
   * @param accountIds - 账号id数组
   */
  async getUserActive(accountId: string): Promise<V2NIMUser> {
    this.logger?.log("getUserListActive", accountId);
    const user = this.users.get(accountId);

    if (user) {
      this.logger?.log("getUserListActive success", user, accountId);
      return user;
    }

    return this.getUserForceActive(accountId);
  }

  /**
   * 获取用户最新信息
   * @param accountIds - 账号id数组
   */

  async getUserForceActive(accountId: string): Promise<V2NIMUser> {
    try {
      this.logger?.log("getUserForceActive", accountId);
      const user = await this._getUserInfo(accountId);

      this.logger?.log("getUserForceActive success", user, accountId);
      return user;
    } catch (error) {
      this.logger?.error("getUserForceActive failed: ", accountId, error);
      throw error;
    }
  }

  /**
   * 获取用户最新信息（始终从服务器取最新的，用于点开用户头像时）
   * @param accountIds - 账号id数组
   */

  async getUserListFromCloudActive(accountIds: string[]): Promise<V2NIMUser[]> {
    try {
      this.logger?.log("getUserListFromCloudActive", accountIds);

      const users = await this.nim.userService?.getUserListFromCloud(
        accountIds
      );

      this.addUsers(users as V2NIMUser[]);
      this.logger?.log("getUserListFromCloudActive success", users, accountIds);
      return users as V2NIMUser[];
    } catch (error) {
      this.logger?.error(
        "getUserListFromCloudActive failed: ",
        accountIds,
        error
      );
      throw error;
    }
  }

  // 获取自己的用户信息
  async getMyUserInfoActive(): Promise<V2NIMUser> {
    try {
      this.logger?.log("getMyUserInfoActive");
      const myUserInfo = await this.nim.userService?.getUserList([
        this.nim?.loginService?.getLoginUser() as string,
      ]);
      runInAction(() => {
        this.myUserInfo = myUserInfo?.[0] as V2NIMUser;
        this.addUsers(myUserInfo as V2NIMUser[]);
      });
      this.logger?.log("getMyUserInfoActive success", myUserInfo);

      return myUserInfo?.[0] as V2NIMUser;
    } catch (error) {
      this.logger?.error("getMyUserInfoActive failed: ", error);
      throw error;
    }
  }

  private async _getUserInfos(
    accountIds: string[]
  ): Promise<{ accountId: string }[]> {
    const users = await this.nim.userService?.getUserList(accountIds);

    this.addUsers(users as { accountId: string }[]);
    return users as { accountId: string }[];
  }

  private _onUserProfileChanged(data: V2NIMUser[]) {
    this.logger?.log("_onUserProfileChanged: ", data);
    data.forEach((item) => {
      if (item.accountId === this.myUserInfo.accountId) {
        this.myUserInfo = item;
      }
    });
    this.addUsers(data);
  }
}
