import { makeAutoObservable } from "mobx";
import {
  ContactType,
  LocalOptions,
  Relation,
  V2NIMConversationForUI,
  V2NIMFriendAddApplicationForUI,
  V2NIMLocalConversationForUI,
} from "./types";
import RootStore from ".";
import { V2NIMTeam, V2NIMFriend, V2NIMUser } from "node-nim/types/v2_def/v2_nim_struct_def";

import * as storeUtils from "./utils";

/** Mobx 可观察对象，负责 UI 会用到的属性的子 store */
export class UiStore {
  // 这边使用 undefined 会导致无法被注册成 observable，但是 demo 上没问题，不知道是为什么，很懵逼，但是先把这边附上默认值就可以解决
  selectedContactType: ContactType | "" = "";
  /**
   * 当前选中的会话
   */
  selectedConversation = "";
  logger: typeof storeUtils.logger | null = null;

  // 多选模式
  isMultiSelectMode = false;
  // 选中的消息ID集合
  selectedMessageIds: string[] = [];

  // 跳转到消息相关状态
  isJumpedToMessage = false; // 是否是通过搜索跳转到的消息
  targetMessageId = ""; // 目标消息ID

  constructor(
    private rootStore: RootStore,
    private localOptions: LocalOptions
  ) {
    makeAutoObservable(this);
    this.logger = rootStore.logger;
  }

  setMultiSelectMode(isMultiSelectMode: boolean): void {
    this.isMultiSelectMode = isMultiSelectMode;
    if (!isMultiSelectMode) {
      this.selectedMessageIds = [];
    }
  }

  selectMessage(id: string): void {
    if (!this.selectedMessageIds.includes(id)) {
      this.selectedMessageIds.push(id);
    }
  }

  unselectMessage(id: string): void {
    this.selectedMessageIds = this.selectedMessageIds.filter((item) => item !== id);
  }

  /**
   * 重置状态
   */
  resetState(): void {
    this.selectedContactType = "";
    this.selectedConversation = "";
  }

  /**
   * 销毁UiStore，使UI重置
   */
  destroy(): void {
    this.resetState();
  }

  /**
   * 通讯录选中类型
   * @param contactType - 导航类型
   */
  selectContactType(contactType: ContactType): void {
    this.logger?.log("selectContactType: ", contactType);
    this.selectedContactType = contactType;
  }

  /**
   * 取消通讯录选中
   */
  unselectContactType(): void {
    this.logger?.log("unselectContactType");
    this.selectedContactType = "";
  }

  /**
   * 切换会话
   * @param conversationId - 会话ID
   */
  async selectConversation(conversationId: string): Promise<void> {
    this.logger?.log("selectConversation: ", conversationId);
    if (conversationId === this.selectedConversation) {
      return;
    }

    this.rootStore.msgStore.msgs.resetLimitState();
    this.selectedConversation = conversationId;

    // 重置会话未读数
    if (conversationId) {
      if (this.localOptions?.enableCloudConversation) {
        this.rootStore.conversationStore?.resetConversationAit(conversationId);
        await this.rootStore.conversationStore?.resetConversation(conversationId);
      } else {
        this.rootStore.localConversationStore?.resetConversationAit(conversationId);
        await this.rootStore.localConversationStore?.resetConversation(conversationId);
      }
    }
  }

  /**
   * 取消选中会话
   */
  unselectConversation(): void {
    this.logger?.log("unselectConversation");
    this.selectedConversation = "";
    this.rootStore.msgStore.msgs.resetLimitState();
  }

  /**
   * 获取用户关系
   * @param account - 账号
   */
  public getRelation(account: string): {
    relation: Relation;
    isInBlacklist: boolean;
  } {
    let res: Relation = "stranger";

    if (this.rootStore.userStore.myUserInfo.accountId === account) {
      res = "myself";
    } else if (this.rootStore.aiUserStore.aiUsers.has(account)) {
      res = "ai";
    } else if (this.rootStore.friendStore.friends.has(account)) {
      res = "friend";
    } else {
      res = "stranger";
    }

    // this.logger?.log('getRelation success', account, res)
    return {
      relation: res,
      isInBlacklist: this.rootStore.relationStore.isInBlacklist(account),
    };
  }

  /**
   * 获取好友名片
   * * @param account - 账号
   */
  getFriendWithUserNameCard(account: string): V2NIMFriend & V2NIMUser {
    const friend: V2NIMFriend =
      this.rootStore.friendStore.friends.get(account) ||
      ({
        accountId: "",
        serverExtension: "",
        customerExtension: "",
      } as V2NIMFriend);
    const userCard: V2NIMUser = this.rootStore.userStore.users.get(account) || {
      accountId: "",
      name: "",
      createTime: Date.now(),
    };

    return { ...friend, ...userCard };
  }

  /**
   * 查询用户称谓
   * 优先级按照 备注 > 群昵称 > 好友昵称 > 消息上的昵称 > 好友账号 返回，如果是机器人则优先返回机器人名字
   * * @param account - 账号
   * * @param teamId - 群号
   * * @param ignoreAlias - 是否忽略好友备注
   * * @param nickFromMsg - 消息上的昵称
   */
  getAppellation({
    account,
    teamId = "",
    ignoreAlias = false,
    nickFromMsg = "",
  }: {
    account: string;
    teamId?: string;
    ignoreAlias?: boolean;
    nickFromMsg?: string;
  }): string {
    const aiUser = this.rootStore.aiUserStore.aiUsers.get(account);

    if (aiUser) {
      return aiUser.name || account;
    }

    const friend = this.rootStore.friendStore.friends.get(account);
    const user = this.rootStore.userStore.users.get(account);
    const teamMember = this.rootStore.teamMemberStore.teamMembers.get(teamId)?.get(account);

    return (
      (!ignoreAlias && friend?.alias) ||
      teamMember?.teamNick ||
      user?.name ||
      nickFromMsg ||
      account
    );
  }

  get friends(): V2NIMFriend[] {
    return [...this.rootStore.friendStore.friends.values()];
  }

  get conversations(): V2NIMConversationForUI[] {
    return this.rootStore.conversationStore?.conversations.values()
      ? [...this.rootStore.conversationStore.conversations.values()]
      : [];
  }

  get localConversations(): V2NIMLocalConversationForUI[] {
    return this.rootStore.localConversationStore?.conversations.values()
      ? [...this.rootStore.localConversationStore.conversations.values()]
      : [];
  }

  get users(): V2NIMUser[] {
    return [...this.rootStore.userStore.users.values()];
  }

  get teamList(): V2NIMTeam[] {
    const teams = [...this.rootStore.teamStore.teams.values()];

    return teams
      .filter((item) => item.isValidTeam)
      .sort((a, b) => (b?.createTime || 0) - (a?.createTime || 0));
  }

  get applyMsgs(): V2NIMFriendAddApplicationForUI[] {
    return [...this.rootStore.sysMsgStore.friendApplyMsg.values()];
  }

  /**
   * 设置跳转到消息状态
   */
  setJumpedToMessage(jumped: boolean): void {
    this.isJumpedToMessage = jumped;
  }

  /**
   * 设置目标消息ID
   */
  setTargetMessageId(messageId: string): void {
    this.targetMessageId = messageId;
  }

  /**
   * 清除跳转消息状态
   */
  clearJumpedToMessage(): void {
    this.isJumpedToMessage = false;
    this.targetMessageId = "";
  }
}
