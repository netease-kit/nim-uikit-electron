import { makeAutoObservable } from "mobx";
import RootStore from ".";
import { V2NIMClient } from "node-nim";
import { V2NIMConst } from "../utils/constants";

import {
  V2NIMFriend,
  V2NIMFriendAddApplication,
  V2NIMFriendAddApplicationQueryOption,
  V2NIMFriendAddApplicationResult,
  V2NIMFriendAddParams,
  V2NIMFriendSetParams,
  V2NIMUser,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import * as storeUtils from "./utils";

/**Mobx 可观察对象，负责管理好友信息的子 store */
export class FriendStore {
  friends: Map<string, V2NIMFriend> = new Map();
  logger: typeof storeUtils.logger | null = null;

  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable(this);

    this._onFriendAdded = this._onFriendAdded.bind(this);
    this._onFriendDeleted = this._onFriendDeleted.bind(this);
    this._onFriendAddApplication = this._onFriendAddApplication.bind(this);
    this._onFriendAddRejected = this._onFriendAddRejected.bind(this);
    this._onFriendInfoChanged = this._onFriendInfoChanged.bind(this);
    this.logger = rootStore.logger;

    nim.friendService?.on("friendAdded", this._onFriendAdded);
    nim.friendService?.on("friendDeleted", this._onFriendDeleted);
    /** 申请添加好友的相关信息，其他端向本端发送好友申请,会触发该事件，多端登录情况下也会触发 */
    nim.friendService?.on("friendAddApplication", this._onFriendAddApplication);
    /** 对端拒绝本端好友申请，本端会触发该事件 */
    nim.friendService?.on("friendAddRejected", this._onFriendAddRejected);
    /** 好友信息更新回调，返回变更的好友信息，包括本端直接更新的好友信息和其他端同步更新的好友信息 */
    nim.friendService?.on("friendInfoChanged", this._onFriendInfoChanged);
  }

  resetState(): void {
    this.friends.clear();
  }

  /**
   * 销毁FriendStore，会取消好友事件监听
   */
  destroy(): void {
    this.resetState();
    this.nim.friendService?.off("friendAdded", this._onFriendAdded);
    this.nim.friendService?.off("friendDeleted", this._onFriendDeleted);
    this.nim.friendService?.off(
      "friendAddApplication",
      this._onFriendAddApplication
    );
    this.nim.friendService?.off("friendAddRejected", this._onFriendAddRejected);
    this.nim.friendService?.off("friendInfoChanged", this._onFriendInfoChanged);
  }
  /**
   * 查询好友列表
   */
  async getFriendListActive(): Promise<V2NIMFriend[]> {
    try {
      this.logger?.log("getFriendListActive");
      const friends = await this.nim.friendService?.getFriendList();
      if (friends?.length) {
        this.addFriend(friends);
      }
      this.logger?.log("getFriendListActive success", friends);
      return friends as V2NIMFriend[];
    } catch (error) {
      this.logger?.error("getFriendListActive failed: ", error);
      throw error;
    }
  }

  /**
   * 根据Id 查询好友信息
   */
  async getFriendByIdsActive(ids: string[]): Promise<V2NIMFriend[]> {
    try {
      this.logger?.log("getFriendByIdsActive", ids);
      const friends = await this.nim.friendService?.getFriendByIds(ids);

      if (friends?.length) {
        this.addFriend(friends);
      }
      this.logger?.log("getFriendByIdsActive success", friends);
      return friends as V2NIMFriend[];
    } catch (error) {
      this.logger?.error("getFriendByIdsActive failed: ", error);
      throw error;
    }
  }

  /**
   * 获取申请添加好友列表通知
   * @param options V2NIMFriendAddApplicationQueryOption
   */
  async getAddApplicationListActive(
    options: V2NIMFriendAddApplicationQueryOption
  ): Promise<V2NIMFriendAddApplicationResult> {
    try {
      this.logger?.log("getAddApplicationListActive, option: ", options);
      const res = await this.nim.friendService?.getAddApplicationList(options);
      this.rootStore.sysMsgStore.addFriendApplyMsg(res.infos);
      this.logger?.log("getAddApplicationListActive success", res);
      return res;
    } catch (error) {
      this.logger?.error("getAddApplicationListActive failed: ", error);
      throw error;
    }
  }

  /**
   * 添加好友申请
   * @param accountId 账号
   * @param params 添加好友的配置参数
   */
  async addFriendActive(
    accountId: string,
    params: V2NIMFriendAddParams
  ): Promise<void> {
    try {
      this.logger?.log("addFriendActive", accountId);
      await this.nim.friendService?.addFriend(accountId, params);
      this.logger?.log("addFriendActive success", accountId, params);
    } catch (error) {
      this.logger?.error("addFriendActive failed: ", accountId, params, error);
      throw error;
    }
  }

  /**
   * 接受好友申请
   * @param application 申请添加好友的相关信息
   */
  async acceptAddApplicationActive(
    application: V2NIMFriendAddApplication
  ): Promise<void> {
    try {
      this.logger?.log("acceptAddApplicationActive", application);
      await this.nim.friendService?.acceptAddApplication(application);
      this.logger?.log("acceptAddApplicationActive success", application);
    } catch (error) {
      this.logger?.error(
        "acceptAddApplicationActive failed: ",
        application,
        error
      );
      throw error;
    }
  }

  /**
   * 拒绝好友申请
   * @param application 申请添加好友的相关信息
   * @param postscript 拒绝好友申请的附言
   */

  async rejectAddApplicationActive(
    application: V2NIMFriendAddApplication,
    postscript?: string
  ): Promise<void> {
    try {
      this.logger?.log("rejectAddApplicationActive", application, postscript);
      await this.nim.friendService?.rejectAddApplication(
        application,
        postscript as string
      );
      this.rootStore.sysMsgStore.updateFriendApplyMsg([
        {
          ...application,
          status:
            V2NIMConst.V2NIMFriendAddApplicationStatus
              .V2NIM_FRIEND_ADD_APPLICATION_STATUS_REJECTED
        },
      ])
      this.logger?.log(
        "rejectFriendApplyActive success",
        application,
        postscript
      );
    } catch (error) {
      this.logger?.error(
        "rejectFriendApplyActive failed: ",
        application,
        postscript,
        error
      );
      throw error;
    }
  }

  /**
   * 删除好友
   * @param accountId 账号
   */
  async deleteFriendActive(accountId: string): Promise<void> {
    try {
      this.logger?.log("deleteFriendActive", accountId);
      await this.nim.friendService?.deleteFriend(accountId, {
        deleteAlias: true,
      });
      this.removeFriend([accountId]);
      this.logger?.log("deleteFriendActive success", accountId);
    } catch (error) {
      this.logger?.error("deleteFriendActive failed: ", accountId, error);
      throw error;
    }
  }

  /**
   * 更新好友信息
   * @param accountId 账号
   * @param params 设置好友信息的配置参数。
   */
  async setFriendInfoActive(
    accountId: string,
    params: V2NIMFriendSetParams
  ): Promise<void> {
    try {
      this.logger?.log("setFriendInfoActive", accountId, params);
      await this.nim.friendService?.setFriendInfo(accountId, params);
      this.logger?.log("setFriendInfoActive success", accountId, params);
    } catch (error) {
      this.logger?.error(
        "setFriendInfoActive failed: ",
        accountId,
        params,
        error
      );
      throw error;
    }
  }

  /**
   * 内存中增加好友
   * @param data - 好友数组
   */
  addFriend(data: V2NIMFriend[]): void {
    data
      .filter((item) => !!item.accountId)
      .forEach((item) => {
        const oldFriend = this.friends.get(item.accountId as string);

        if (!oldFriend) {
          this.friends.set(item.accountId as string, {
            ...item,
            ...item.userProfile,
          });

          // 这里不用再去获取用户信息，sdk返回的好友信息的userProfile 已经包含用户信息了 此时再去拉取用户信息会有性能问题
          // this.rootStore.userStore.getUserActive(item.accountId)
        } else {
          this.friends.set(item.accountId as string, {
            ...oldFriend,
            ...item,
            ...item.userProfile,
          });
        }
      });

    this.rootStore.userStore.addUsers(
      data.map((item) => {
        return {
          ...item,
          ...item.userProfile,
        } as V2NIMUser;
      })
    );
  }

  /**
   * 内存中删除好友
   * @param data - 好友数组
   */
  removeFriend(accounts: string[]): void {
    accounts.forEach((item) => {
      this.friends.delete(item);
    });
  }

  /**
   * 监听添加好友
   */
  private _onFriendAdded(friend: V2NIMFriend) {
    this.logger?.log("_onFriendAdded", friend);
    this.addFriend([friend]);
    // 如果存在系统消息，则更新系统消息，这里只能自己是被申请者
    this.rootStore.sysMsgStore.updateFriendApplyMsg([
      {
        operatorAccountId: this.rootStore.userStore.myUserInfo.accountId,
        applicantAccountId: friend.accountId as string,
        recipientAccountId: this.rootStore.userStore.myUserInfo
          .accountId as string,
        timestamp: Date.now(),
        status:
          V2NIMConst.V2NIMFriendAddApplicationStatus
            .V2NIM_FRIEND_ADD_APPLICATION_STATUS_AGREED,
        read: true,
      },
    ]);
  }

  /**
   * 监听删除好友
   */
  private _onFriendDeleted(accountId: string) {
    this.logger?.log("_onFriendDeleted", accountId);
    if (accountId) {
      this.removeFriend([accountId]);
    }
  }
  /**
   * 申请添加好友的相关信息，其他端向本端发送好友申请,会触发该事件
   */
  private _onFriendAddApplication(application: V2NIMFriendAddApplication) {
    this.logger?.log("_onFriendAddApplication", application);
    // 多端登录时，本端发送好友申请，多端登录另一端会收到该事件，此时需要过滤，多端登录另一端不需要提醒
    if (
      application.applicantAccountId !==
      this.rootStore.userStore.myUserInfo.accountId
    ) {
      this.rootStore.sysMsgStore.addFriendApplyMsg([application]);
    }
  }

  /**
   * 对端拒绝本端好友申请，本端会触发该事件
   */
  private _onFriendAddRejected(rejection: V2NIMFriendAddApplication) {
    this.logger?.log("_onFriendAddRejected", rejection);
    // 如果存在系统消息，则更新系统消息
    this.rootStore.sysMsgStore.addFriendApplyMsg([
      {
        ...rejection,
      },
    ]);
  }

  /**
   * 好友信息更新回调，返回变更的好友信息，包括本端直接更新的好友信息和其他端同步更新的好友信息
   */
  private _onFriendInfoChanged(friend: V2NIMFriend) {
    this.logger?.log("_onFriendInfoChanged", friend);
    this.addFriend([friend]);
  }
}
