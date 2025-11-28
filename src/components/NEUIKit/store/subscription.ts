import { V2NIMClient } from "node-nim";
import { makeAutoObservable } from "mobx";
import RootStore from ".";
import * as storeUtils from "./utils";
import { V2NIMUserStatus } from "node-nim/types/v2_def/v2_nim_struct_def";

/**Mobx 可观察对象，负责管理在线离线等事件订阅的子store */
export class SubscriptionStore {
  public stateMap = new Map<string, V2NIMUserStatus>();
  logger: typeof storeUtils.logger | null = null;

  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable(this);
    this._onUserStatusChanged = this._onUserStatusChanged.bind(this);

    this.nim.subscriptionService?.on(
      "userStatusChanged",
      this._onUserStatusChanged
    );

    this.logger = this.rootStore.logger;
  }

  resetState(): void {
    this.logger?.log("SubscriptionStore resetState");
    this.stateMap.clear();
  }

  /**
   * 销毁SubscriptionStore，会取消相关事件监听
   */
  destroy(): void {
    this.resetState();
    this.nim.subscriptionService?.off(
      "userStatusChanged",
      this._onUserStatusChanged
    );
  }

  /** 获取当前用户在线离线状态
   * @param accountId 用户ID
   **/
  getUserStatus(accountId: string): V2NIMUserStatus | undefined {
    return this.stateMap.get(accountId);
  }

  /** 获取当前所有用户在线离线状态
   **/
  getUserStatusList(): V2NIMUserStatus[] {
    return [...this.stateMap.values()];
  }

  /**
   * 订阅用户状态，包括在线状态或用户自定义的状态。
   * 成功订阅用户状态后，当订阅的用户状态有变更时，会触发 onUserStatusChanged 回调。
   * @param accountIds 要订阅的用户 ID 列表。
   */
  async subscribeUserStatusActive(
    accountIds: string[]
  ): Promise<Array<string> | undefined> {
    try {
      this.logger?.log("subscribeUserStatusActive", accountIds);
      const failedAccounts =
        await this.nim.subscriptionService?.subscribeUserStatus({
          accountIds,
          duration: 3600 * 24 * 7,
          immediateSync: true,
        });

      if (failedAccounts?.length && failedAccounts.length > 0) {
        this.logger?.warn(
          "subscribeUserStatusActive failed accounts",
          failedAccounts
        );
        return failedAccounts;
      }

      this.logger?.log("subscribeUserStatusActive success");
    } catch (err) {
      this.logger?.error("subscribeUserStatusActive err", err);
    }
  }

  /**
   * 注册用户状态订阅相关监听。
   */
  private _onUserStatusChanged(userStatusList: Array<V2NIMUserStatus>) {
    this.logger?.log("_onUserStatusChanged", userStatusList);
    for (const userStatus of userStatusList) {
      this.stateMap.set(userStatus.accountId, userStatus);
    }
  }
}
