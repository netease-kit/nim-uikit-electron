import { makeAutoObservable } from "mobx";
import RootStore from ".";
import { AT_ALL_ACCOUNT } from "./constant";
import { V2NIMConst } from "../utils/constants";

import { V2NIMClient } from "node-nim";
import { V2NIMConversationType } from "node-nim/types/v2_def/v2_nim_enum_def";
import {
  V2NIMError,
  V2NIMLocalConversation,
  V2NIMLocalConversationResult,
  V2NIMMessageTeamNotificationAttachment,
  V2NIMMessage,
  V2NIMP2PMessageReadReceipt,
} from "node-nim/types/v2_def/v2_nim_struct_def";

import { YxServerExt, V2NIMLocalConversationForUI } from "./types";
import * as storeUtils from "./utils";

/**Mobx 可观察对象，负责管理本地会话列表的子 store */
export class LocalConversationStore {
  conversations: Map<string, V2NIMLocalConversationForUI> = new Map();
  totalUnreadCount = 0;
  logger: typeof storeUtils.logger | null = null;

  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable(this);

    this._onSyncStarted = this._onSyncStarted.bind(this);
    this._onSyncFinished = this._onSyncFinished.bind(this);
    this._onSyncFailed = this._onSyncFailed.bind(this);
    this._onConversationCreated = this._onConversationCreated.bind(this);
    this._onConversationDeleted = this._onConversationDeleted.bind(this);
    this._onConversationChanged = this._onConversationChanged.bind(this);
    this._onTotalUnreadCountChanged =
      this._onTotalUnreadCountChanged.bind(this);
    this.logger = rootStore.logger;

    /** 数据同步开始 */
    nim.localConversationService?.on("syncStarted", this._onSyncStarted);
    /** 数据同步结束 */
    nim.localConversationService?.on("syncFinished", this._onSyncFinished);
    /** 数据同步失败 */
    nim.localConversationService?.on("syncFailed", this._onSyncFailed);
    /** 会话创建 */
    nim.localConversationService?.on(
      "conversationCreated",
      this._onConversationCreated
    );
    /** 会话删除 */
    nim.localConversationService?.on(
      "conversationDeleted",
      this._onConversationDeleted
    );
    /** 会话更新 */
    nim.localConversationService?.on(
      "conversationChanged",
      this._onConversationChanged
    );
    /** 会话总未读数变化 */
    nim.localConversationService?.on(
      "totalUnreadCountChanged",
      this._onTotalUnreadCountChanged
    );
  }

  resetState(): void {
    this.logger?.log("LocalConversationStore Conversation resetState");
    this.conversations.clear();
    this.totalUnreadCount = 0;
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.resetState();
    this.nim.localConversationService?.off("syncStarted", this._onSyncStarted);
    this.nim.localConversationService?.off(
      "syncFinished",
      this._onSyncFinished
    );
    this.nim.localConversationService?.off("syncFailed", this._onSyncFailed);
    this.nim.localConversationService?.off(
      "conversationCreated",
      this._onConversationCreated
    );
    this.nim.localConversationService?.off(
      "conversationDeleted",
      this._onConversationDeleted
    );
    this.nim.localConversationService?.off(
      "conversationChanged",
      this._onConversationChanged
    );
    this.nim.localConversationService?.off(
      "totalUnreadCountChanged",
      this._onTotalUnreadCountChanged
    );
  }

  /**
   * 添加内存中的会话
   * @param conversations 会话数组
   */
  addConversation(conversations: V2NIMLocalConversationForUI[]): void {
    conversations
      .filter((item) => !!item.conversationId)
      // 暂时仅支持 p2p 和 team
      .filter((item) =>
        [
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P,
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM,
        ].includes(item.type)
      )
      .forEach(async (item) => {
        const oldConversation = this.conversations.get(item.conversationId);

        // 先更新一次
        this.conversations.set(item.conversationId, {
          ...oldConversation,
          ...item,
        });

        // 异步处理之后，数据可能发生改变，因此重新获取一次会话
        // const newConversation = this.conversations.get(item.conversationId)

        // if (newConversation) {
        //   this.conversations.set(item.conversationId, {
        //     ...newConversation,
        //   })
        // }
      });
  }

  /**
   * 更新内存中的会话
   * @param conversations 会话数组
   */
  updateConversation(conversations: V2NIMLocalConversationForUI[]): void {
    conversations
      .filter((item) => !!item.conversationId)
      // 暂时仅支持 p2p 和 team
      .filter((item) =>
        [
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P,
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM,
        ].includes(item.type)
      )
      .forEach((item) => {
        const oldConversation = this.conversations.get(item.conversationId);

        this.conversations.set(item.conversationId, {
          ...oldConversation,
          ...item,
        });
      });
  }

  /**
   * 移除内存中的会话
   * @param conversationId 会话ID
   */
  removeConversation(conversationIds: string[]): void {
    conversationIds.forEach((item) => {
      this.conversations.delete(item);
      if (this.rootStore.uiStore.selectedConversation === item) {
        this.rootStore.uiStore.unselectConversation();
      }
    });
  }

  /**
   * 重置会话未读数
   * @param conversationId - 消息所属的会话的ID
   */
  async resetConversation(conversationId: string): Promise<void> {
    this.logger?.log(
      "LocalConversationStore resetConversation",
      conversationId
    );
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      this.logger?.warn(
        "LocalConversationStore resetConversation: conversation is not found.",
        conversationId
      );
      return;
    }

    try {
      if (conversation.unreadCount) {
        // 请求前也清理一次会话未读数，fix http://jira.netease.com/browse/YYTX-34326
        this._resetMemoryConversationUnreadCount(conversation);
        await this.nim.localConversationService?.clearUnreadCountByIds([
          conversation.conversationId,
        ]);
        this._resetMemoryConversationUnreadCount(conversation);
      }

      this.logger?.log("LocalConversationStore resetConversation success");
    } catch (error) {
      this.logger?.error(
        "LocalConversationStore resetConversation failed: ",
        error
      );
      throw error;
    }
  }

  /**
   * 插入一条会话记录
   * @param conversationType
   * @param receiverId - 接收方, 对方帐号或者群id
   * @param isSelected - 是否选中
   */
  async insertConversationActive(
    conversationType: V2NIMConversationType,
    receiverId: string,
    isSelected = true
  ): Promise<void> {
    try {
      this.logger?.log("LocalConversationStore insertConversationActive", {
        conversationType,
        receiverId,
        isSelected,
      });
      let conversationId = "";

      if (
        conversationType ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
      ) {
        if (!this.nim.conversationIdUtil?.p2pConversationId) {
          throw new Error(
            "conversationIdUtil.p2pConversationId is not initialized"
          );
        }
        conversationId =
          this.nim.conversationIdUtil?.p2pConversationId(receiverId) || "";
      } else if (
        conversationType ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
      ) {
        if (!this.nim.conversationIdUtil?.teamConversationId) {
          throw new Error(
            "conversationIdUtil.teamConversationId is not initialized"
          );
        }
        conversationId =
          this.nim.conversationIdUtil?.teamConversationId(receiverId) || "";
      } else {
        throw new Error("Unsupported conversation type");
      }

      if (!this.conversations.has(conversationId)) {
        if (!this.nim.localConversationService?.createConversation) {
          throw new Error(
            "localConversationService.createConversation is not initialized"
          );
        }
        const conversation =
          await this.nim.localConversationService?.createConversation(
            conversationId
          );

        this.addConversation([conversation]);
      }

      if (isSelected) {
        await this.rootStore.uiStore.selectConversation(conversationId);
      }

      this.logger?.log(
        "LocalConversationStore insertConversationActive success",
        {
          conversationType,
          receiverId,
          isSelected,
        }
      );
    } catch (error) {
      this.logger?.error(
        "LocalConversationStore insertConversationActive failed: ",
        { conversationType, receiverId, isSelected },
        error
      );
      throw error;
    }
  }

  /**
   * 删除会话记录
   * @param conversationId - 消息所属的会话的ID
   */
  async deleteConversationActive(conversationId: string): Promise<void> {
    try {
      this.logger?.log(
        "LocalConversationStore deleteConversationActive",
        conversationId
      );
      // 先取消下置顶
      try {
        await this.stickTopConversationActive(conversationId, false);
      } catch (error) {
        // 忽略这个错误，因为有可能会话不存在等原因导致接口报错
        this.logger?.warn(
          "LocalConversationStore deleteConversationActive failed but continue: ",
          error
        );
      }

      // 先删除内存，防止删除失败导致一些问题
      this.removeConversation([conversationId]);

      // 不删除历史消息，让表现跟线上一致，后续可根据需求调整
      if (!this.nim.localConversationService?.deleteConversation) {
        throw new Error(
          "localConversationService.deleteConversation is not initialized"
        );
      }
      await this.nim.localConversationService.deleteConversation(
        conversationId,
        false
      );
      this.logger?.log(
        "LocalConversationStore deleteConversationActive success"
      );
    } catch (error) {
      this.logger?.warn(
        "LocalConversationStore deleteConversationActive failed but continue: ",
        error
      );
    }
  }

  /**
   * 新增会话置顶
   * @param conversationId - 消息所属的会话的ID
   * @param stickTop - 是否置顶
   */
  async stickTopConversationActive(
    conversationId: string,
    stickTop: boolean
  ): Promise<void> {
    try {
      this.logger?.log(
        "LocalConversationStore stickTopConversationActive",
        conversationId,
        stickTop
      );

      if (!this.nim.localConversationService?.stickTopConversation) {
        throw new Error(
          "localConversationService.stickTopConversation is not initialized"
        );
      }
      await this.nim.localConversationService.stickTopConversation(
        conversationId,
        stickTop
      );
      this.logger?.log(
        "LocalConversationStore stickTopConversationActive success"
      );
    } catch (error) {
      this.logger?.error(
        "LocalConversationStore stickTopConversationActive failed: ",
        error
      );
      throw error;
    }
  }

  /**
   * 获取会话列表
   * @param offset 分页偏移量
   * @param limit 分页拉取数量
   */
  async getConversationListActive(
    offset: number,
    limit: number
  ): Promise<V2NIMLocalConversationResult> {
    try {
      this.logger?.log(
        "LocalConversationStore getConversationListActive",
        offset,
        limit
      );

      if (!this.nim.localConversationService?.getConversationList) {
        throw new Error(
          "localConversationService.getConversationList is not initialized"
        );
      }
      const res: V2NIMLocalConversationResult =
        await this.nim.localConversationService.getConversationList(
          offset,
          limit
        );

      this.addConversation(res.conversationList);
      await this.getP2PMessageReceipt(
        res.conversationList
          .filter(
            (item: V2NIMLocalConversation) =>
              item.type ===
              V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
          )
          .map((item: V2NIMLocalConversation) => item.conversationId)
      );
      this.logger?.log(
        "LocalConversationStore getConversationListActive success",
        offset,
        limit,
        res
      );
      return res;
    } catch (error) {
      this.logger?.error(
        "LocalConversationStore getConversationListActive failed: ",
        error,
        offset,
        limit
      );
      throw error;
    }
  }

  async getP2PMessageReceipt(
    conversationIds: string[]
  ): Promise<V2NIMP2PMessageReadReceipt[]> {
    try {
      this.logger?.log(
        "LocalConversationStore getP2PMessageReceipt",
        conversationIds
      );
      if (!this.nim.messageService?.getP2PMessageReceipt) {
        throw new Error(
          "messageService.getP2PMessageReceipt is not initialized"
        );
      }

      const res: V2NIMP2PMessageReadReceipt[] = await Promise.all(
        conversationIds.map((item) =>
          this.nim.messageService?.getP2PMessageReceipt(item)
        )
      );
      const conversations = res
        .map((item) => {
          if (item.conversationId) {
            const conversation = this.conversations.get(item.conversationId);

            if (conversation) {
              return {
                ...conversation,
                // todo
                // @ts-ignore
                msgReceiptTime: item.timestamp,
              };
            }
          }
        })
        .filter((item) => !!item) as V2NIMLocalConversationForUI[];

      this.updateConversation(conversations);

      this.logger?.log(
        "LocalConversationStore getP2PMessageReceipt success",
        conversationIds,
        res
      );
      return res;
    } catch (error) {
      this.logger?.error(
        "LocalConversationStore getP2PMessageReceipt failed: ",
        error,
        conversationIds
      );
      throw error;
    }
  }

  private _resetMemoryConversationUnreadCount(
    conversation: V2NIMLocalConversation
  ): void {
    const newConversation = this.conversations.get(conversation.conversationId);

    if (newConversation) {
      this.updateConversation([{ ...newConversation, unreadCount: 0 }]);
    }
  }

  /**
   * 获取会话已读时间戳。该时间包含多端已读时间戳
   */
  async getConversationReadTimeActive(conversationId: string): Promise<number> {
    try {
      this.logger?.log(
        "LocalConversationStore getConversationReadTimeActive",
        conversationId
      );

      if (!this.nim.localConversationService?.getConversationReadTime) {
        throw new Error(
          "localConversationService.getConversationReadTime is not initialized"
        );
      }
      const res =
        await this.nim.localConversationService?.getConversationReadTime(
          conversationId
        );

      this.logger?.log(
        "LocalConversationStore getConversationReadTimeActive success",
        conversationId,
        res
      );
      return res as number;
    } catch (error) {
      this.logger?.error(
        "LocalConversationStore getConversationReadTimeActive failed: ",
        error,
        conversationId
      );
      throw error;
    }
  }

  /**
   * 标记会话已读时间戳
   *
   * 注: 当该方法调用后，SDK 可能给多端账户抛出以下的事件
   *
   * {@link V2NIMConversationListener.onConversationReadTimeUpdated | V2NIMConversationListener.onConversationReadTimeUpdated} <br/>
   *
   */
  async markConversationReadActive(conversationId: string): Promise<number> {
    try {
      this.logger?.log(
        "LocalConversationStore markConversationReadActive",
        conversationId
      );

      if (!this.nim.localConversationService?.markConversationRead) {
        throw new Error(
          "localConversationService.markConversationRead is not initialized"
        );
      }
      const res = await this.nim.localConversationService.markConversationRead(
        conversationId
      );

      this.logger?.log(
        "LocalConversationStore markConversationReadActive success",
        conversationId,
        res
      );
      return res as number;
    } catch (error) {
      this.logger?.error(
        "LocalConversationStore markConversationReadActive failed: ",
        error,
        conversationId
      );
      throw error;
    }
  }

  handleConversationWithAit(msgs: V2NIMMessage[]): void {
    msgs.map(async (item) => {
      if (
        item.conversationType ===
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ||
        item.conversationType ===
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_SUPER_TEAM
      ) {
        if (item?.serverExtension && item.conversationId) {
          const hasAitMsg = this.hasAitMsg([item.serverExtension]);

          const conversationReadTime = await this.getConversationReadTimeActive(
            item.conversationId as string
          );
          const isCurConversation =
            item.conversationId == this.rootStore.uiStore.selectedConversation;

          const isSendFromMe =
            item.senderId === this.rootStore.userStore.myUserInfo?.accountId;

          // 当前通过_onReceiveMessages获取的新消息时间戳大于会话的最后已读时间戳，且有@消息，且没有选中当前该会话，则标记为已读
          if (
            item.createTime &&
            item.messageClientId &&
            item.createTime > conversationReadTime &&
            hasAitMsg &&
            !isCurConversation &&
            !isSendFromMe
          ) {
            const conversation = this.conversations.get(
              item.conversationId as string
            );

            // 如果此时conversation为空，则可能的情况为:
            // 1.该用户删除了该会话后，又收到了 @消息（onReceiveMessages会先于onConversationCreated触发），此时需要在onConversationCreated处理 @消息相关
            // 2.im sdk初始化过程中，onReceiveMessages 会先于onSyncFinished（因为实在onSyncFinished中拉取会话列表） 触发，此时由于会话列表为空，上面的if判断会为false，则在else中先在内存中构造一个会话，带上aitMsg，后等会话列表拉取完成进行合并
            if (conversation) {
              const aitMsgs = conversation.aitMsgs || [];

              if (aitMsgs.length === 0) {
                this.updateConversation([
                  {
                    ...conversation,
                    aitMsgs: [item.messageClientId as string],
                  },
                ]);
              } else {
                this.updateConversation([
                  {
                    ...conversation,
                    aitMsgs: [...aitMsgs, item.messageClientId as string],
                  },
                ]);
              }
            } else {
              this.addConversation([
                //@ts-ignore
                {
                  conversationId: item.conversationId as string,
                  type: item.conversationType,
                  aitMsgs: [item.messageClientId as string],
                },
              ]);
            }
          }
        }
      }
    });
  }

  resetConversationAit(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);

    if (
      conversation?.type ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM ||
      conversation?.type ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_SUPER_TEAM
    ) {
      this.updateConversation([
        {
          ...conversation,
          aitMsgs: [],
        },
      ]);
    }
  }

  private hasAitMsg(serverExtensions: string[]): boolean {
    let flag = false;

    if (serverExtensions?.length) {
      serverExtensions?.forEach((item) => {
        try {
          const extObj: YxServerExt = JSON.parse(item || "{}");
          const yxAitMsg = extObj.yxAitMsg;
          const account = this.rootStore.userStore.myUserInfo.accountId;

          if (yxAitMsg) {
            Object.keys(yxAitMsg)?.forEach((key) => {
              if (key === account || key === AT_ALL_ACCOUNT) {
                flag = true;
              }
            });
          }
        } catch {
          this.logger?.error(
            "LocalConversationStore parse serverExtension failed: ",
            item
          );
        }
      });
    }

    return flag;
  }

  private _onSyncStarted() {
    this.logger?.log("LocalConversationStore _onSyncStarted");
    // 获取会话列表
    this.rootStore.localConversationStore?.getConversationListActive(
      0,
      this.rootStore.localOptions.conversationLimit || 100
    );
  }

  private async _onSyncFinished() {
    this.logger?.log("LocalConversationStore _onSyncFinished");
    // 获取会话列表
    this.rootStore.localConversationStore?.getConversationListActive(
      0,
      this.rootStore.localOptions.conversationLimit || 100
    );
  }

  private _onSyncFailed(e: V2NIMError) {
    this.logger?.log("LocalConversationStore _onSyncFailed", e);
  }

  private _onConversationCreated(data: V2NIMLocalConversation) {
    this.logger?.log("LocalConversationStore _onConversationCreated", data);
    // 如果是创群，此时_onConversationCreated 返回的data可能没有avatar和name，需要getConversation
    if (
      data.type ===
      V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
    ) {
      if (!this.nim.localConversationService?.getConversation) {
        throw new Error(
          "localConversationService.getConversation is not initialized"
        );
      }

      this.nim.localConversationService
        ?.getConversation(data.conversationId)
        .then((conversation) => {
          this.addConversation([conversation]);
          // 处理@消息 情况为
          if (conversation.lastMessage) {
            this.handleConversationWithAit([
              // 该用户删除了该会话后，又收到了@消息，此时需要在onConversationCreated处理@消息相关
              {
                ...conversation.lastMessage,
                ...conversation.lastMessage.messageRefer,
              },
            ]);
          }
        });
    } else {
      this.addConversation([data]);
      // 会话创建的时候，获取一下当前会话的最后已读时间，便于展示消息已读未读
      if (
        data.type ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P
      ) {
        const conversationId = data.conversationId;

        if (!this.nim.messageService?.getP2PMessageReceipt) {
          throw new Error(
            "messageService.getP2PMessageReceipt is not initialized"
          );
        }

        this.nim?.messageService
          ?.getP2PMessageReceipt(conversationId)
          .then((res) => {
            const conversation = this.conversations.get(conversationId);

            if (conversation) {
              this.updateConversation([
                {
                  ...conversation,
                  msgReceiptTime: res.timestamp,
                },
              ]);
            }
          });
      }
    }
  }

  private _onConversationDeleted(conversationIds: string[]) {
    this.logger?.log(
      "LocalConversationStore _onConversationDeleted",
      conversationIds
    );
    this.removeConversation(conversationIds);
  }

  private async _onConversationChanged(data: V2NIMLocalConversation[]) {
    this.logger?.log("LocalConversationStore _onConversationChanged", data);
    this.addConversation(data);
    data.forEach(async (item) => {
      const attachment = item.lastMessage
        ?.attachment as unknown as V2NIMMessageTeamNotificationAttachment;
      // 处理下退出群聊和解散群聊的情况
      const type = attachment?.type;

      if (
        item.lastMessage?.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION &&
        ((type ===
          V2NIMConst.V2NIMMessageNotificationType
            .V2NIM_MESSAGE_NOTIFICATION_TYPE_TEAM_KICK &&
          attachment?.targetIds?.includes(
            this.rootStore.userStore.myUserInfo?.accountId as string
          )) ||
          (type ===
            V2NIMConst.V2NIMMessageNotificationType
              .V2NIM_MESSAGE_NOTIFICATION_TYPE_TEAM_LEAVE &&
            item.lastMessage?.messageRefer?.senderId ===
              this.rootStore.userStore.myUserInfo.accountId) ||
          type ===
            V2NIMConst.V2NIMMessageNotificationType
              .V2NIM_MESSAGE_NOTIFICATION_TYPE_TEAM_DISMISS)
      ) {
        await this.deleteConversationActive(item.conversationId);
      } else if (
        this.rootStore.uiStore.selectedConversation === item.conversationId
      ) {
        await this.resetConversation(item.conversationId);
      }

      if (
        item.type ===
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
        item.unreadCount == 0
      ) {
        this.resetConversationAit(item.conversationId);
      }
    });
  }

  private _onTotalUnreadCountChanged(data: number) {
    this.logger?.log("LocalConversationStore _onTotalUnreadCountChanged", data);
    this.totalUnreadCount = data;
  }
}
