import RootStore from ".";
import { makeAutoObservable } from "mobx";
import {
  AI_MESSAGE_LIMIT,
  AT_ALL_ACCOUNT,
  HISTORY_LIMIT,
  RECALL_TIME,
} from "./constant";
import {
  LocalOptions,
  V2NIMLocalConversationForUI,
  V2NIMMessageForUI,
  YxAitMsg,
  YxReplyMsg,
  YxServerExt,
} from "./types";
import { batchRequest } from "./utils";
import { QueueMap } from "./queueMap";
import { V2NIMConst } from "../utils/constants";

import {
  V2NIMCollectionOption,
  V2NIMAddCollectionParams,
  V2NIMClearHistoryNotification,
  V2NIMCollection,
  V2NIMMessage,
  V2NIMMessageAIConfigParams,
  V2NIMMessageDeletedNotification,
  V2NIMMessageListOption,
  V2NIMMessagePin,
  V2NIMMessagePinNotification,
  V2NIMMessagePushConfig,
  V2NIMMessageRefer,
  V2NIMMessageRevokeNotification,
  V2NIMP2PMessageReadReceipt,
  V2NIMSendMessageParams,
  V2NIMTeamMessageReadReceipt,
  V2NIMTeamMessageReadReceiptDetail,
  V2NIMMessageAIStreamStopParams,
  V2NIMMessageAIRegenParams,
  V2NIMError,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import * as storeUtils from "./utils";
import PinMsgsMap, { PinInfo, PinInfos } from "./pinMsgsMap";
import {
  V2NIMConversationType,
  V2NIMAIModelRoleType,
  V2NIMClient,
  V2NIMMessageType,
} from "node-nim";

/**Mobx 可观察对象，负责管理会话消息的子 store */
export class MsgStore {
  msgs = new QueueMap<V2NIMMessageForUI>(HISTORY_LIMIT, "rightToLeft");
  /** 回复消息 */
  replyMsgs: Map<string, V2NIMMessage> = new Map();
  logger: typeof storeUtils.logger | null = null;

  /** pin 消息 */
  pinMsgs = new PinMsgsMap();
  /** 收藏消息 */
  collectionMsgs: Map<string, V2NIMMessage> = new Map();
  constructor(
    private rootStore: RootStore,
    private nim: V2NIMClient,
    private localOptions: LocalOptions
  ) {
    makeAutoObservable(this);
    this.logger = rootStore.logger;

    this._onReceiveMessages = this._onReceiveMessages.bind(this);
    this._onClearHistoryNotifications =
      this._onClearHistoryNotifications.bind(this);
    this._onMessageDeletedNotifications =
      this._onMessageDeletedNotifications.bind(this);
    this._onMessagePinNotification = this._onMessagePinNotification.bind(this);
    this._onMessageQuickCommentNotification =
      this._onMessageQuickCommentNotification.bind(this);
    this._onMessageRevokeNotifications =
      this._onMessageRevokeNotifications.bind(this);
    this._onReceiveP2PMessageReadReceipts =
      this._onReceiveP2PMessageReadReceipts.bind(this);
    this._onReceiveTeamMessageReadReceipts =
      this._onReceiveTeamMessageReadReceipts.bind(this);

    this._onReceiveMessagesModified =
      this._onReceiveMessagesModified.bind(this);

    this.getTeamMsgReadsActive = batchRequest(this.getTeamMsgReadsActive, 50);

    /** 收到消息 */
    nim?.messageService?.on("receiveMessages", this._onReceiveMessages);
    /** 清空会话历史消息通知 */
    nim?.messageService?.on(
      "clearHistoryNotifications",
      this._onClearHistoryNotifications
    );
    /** 消息被删除通知 */
    nim?.messageService?.on(
      "messageDeletedNotifications",
      this._onMessageDeletedNotifications
    );

    /** 收到消息 pin 状态更新 */
    nim?.messageService?.on(
      "messagePinNotification",
      this._onMessagePinNotification
    );

    /** 收到消息快捷评论更新 */
    nim?.messageService?.on(
      "messageQuickCommentNotification",
      this._onMessageQuickCommentNotification
    );

    /** 收到消息撤回通知 消息 */
    nim?.messageService?.on(
      "messageRevokeNotifications",
      this._onMessageRevokeNotifications
    );

    /** 收到点对点消息的已读回执 */
    nim?.messageService?.on(
      "receiveP2PMessageReadReceipts",
      this._onReceiveP2PMessageReadReceipts
    );

    /** 收到群消息的已读回执 */
    nim?.messageService?.on(
      "receiveTeamMessageReadReceipts",
      this._onReceiveTeamMessageReadReceipts
    );
    /**
     * 收到消息更新事件
     *
     * 1. 收到更新消息在线同步通知
     * 2. 收到更新消息多端同步通知
     * 3. 收到更新消息漫游通知
     */
    nim?.messageService?.on(
      "receiveMessagesModified",
      this._onReceiveMessagesModified
    );
  }

  resetState(): void {
    this.msgs.clear();
    this.replyMsgs.clear();
    this.pinMsgs.clear();
  }

  /**
   * 销毁MsgStore，会取消消息相关事件监听
   */
  destroy(): void {
    this.resetState();
    this.nim?.messageService?.off("receiveMessages", this._onReceiveMessages);
    this.nim?.messageService?.off(
      "clearHistoryNotifications",
      this._onClearHistoryNotifications
    );
    this.nim?.messageService?.off(
      "messageDeletedNotifications",
      this._onMessageDeletedNotifications
    );
    this.nim?.messageService?.off(
      "messagePinNotification",
      this._onMessagePinNotification
    );
    this.nim?.messageService?.off(
      "messageQuickCommentNotification",
      this._onMessageQuickCommentNotification
    );
    this.nim?.messageService?.off(
      "messageRevokeNotifications",
      this._onMessageRevokeNotifications
    );
    this.nim?.messageService?.off(
      "receiveP2PMessageReadReceipts",
      this._onReceiveP2PMessageReadReceipts
    );
    this.nim?.messageService?.off(
      "receiveTeamMessageReadReceipts",
      this._onReceiveTeamMessageReadReceipts
    );

    this.getMsg().forEach((msg) => {
      this._handleClearMsgTimer(msg);
    });
  }

  /**
   * 回复消息
   * @param msg 消息对象
   */
  replyMsgActive(msg: V2NIMMessage): void {
    if (msg?.conversationId) {
      this.replyMsgs.set(msg.conversationId, msg);
    }
  }

  /**
   * 回复消息
   * @param msg 消息对象
   */
  removeReplyMsgActive(conversationId: string): void {
    this.replyMsgs.delete(conversationId);
  }

  /**
   * 获取回复消息
   * @param conversationId
   * @returns
   */
  getReplyMsgActive(conversationId: string): V2NIMMessage | void {
    const msg = this.replyMsgs.get(conversationId);

    if (msg) {
      return this.handleMsgForSDK(msg);
    }
  }

  /**
   * 撤回消息
   * @param msg 消息对象
   */
  async reCallMsgActive(msg: V2NIMMessage): Promise<void> {
    try {
      this.logger?.log("reCallMsgActive", msg);
      // todo
      await this.nim?.messageService?.revokeMessage(
        this.handleMsgForSDK(msg),
        {}
      );
      this.removeMsg(msg.conversationId, [msg.messageClientId as string]);
      const recallMsg = this._createReCallMsg(msg);

      this.addMsg(recallMsg.conversationId as string, [recallMsg]);
      this.logger?.log("reCallMsgActive success", msg);
    } catch (error) {
      this.logger?.error("reCallMsgActive failed: ", msg, error);
      throw error;
    }
  }

  /**
   * 单向删除消息
   * @param msgs 消息对象数组
   */
  async deleteMsgActive(msgs: V2NIMMessage[]): Promise<void> {
    try {
      this.logger?.log("deleteMsgActive", msgs);
      // todo
      await this.nim?.messageService?.deleteMessages(
        msgs.map((item) => this.handleMsgForSDK(item)),
        "",
        false
      );
      const conversationId = msgs[0].conversationId;

      if (conversationId) {
        const messageClientIds = msgs.map((item) => item.messageClientId);

        this.removeMsg(conversationId, messageClientIds as string[]);
      }

      this.logger?.log("deleteMsgActive success", msgs);
    } catch (error) {
      this.logger?.warn(
        "deleteMsgActive failed, but delete msgs from memory: ",
        msgs,
        error
      );
      throw error;
    }
  }

  /**
   * 回复消息
   * @param msgs 消息对象
   * @param repliedMessages 被回复的消息对象
   * @param conversationId 会话id
   */

  async replyMessageByThreadActive(
    message: V2NIMMessage,
    repliedMessage: V2NIMMessage,
    conversationId: string,
    params?: V2NIMSendMessageParams
  ): Promise<void> {
    try {
      this.logger?.log("replyMessageByThreadActive", message, repliedMessage);
      // todo
      const result = await this.nim?.messageService?.replyMessage(
        message,
        repliedMessage,
        params,
        () => {}
      );

      this.removeReplyMsgActive(conversationId);
      this._handleSendMsgSuccess(result.message);
      this.logger?.log(
        "replyMessageByThreadActive success",
        { message, repliedMessage },
        result
      );
    } catch (error) {
      this.logger?.error(
        "replyMessageByThreadActive fail",
        message,
        repliedMessage
      );
      message.threadReply = repliedMessage;
      this._handleSendMsgSuccess(message);

      throw error;
    }
  }

  /**
   * 发送消息
   * @param __namedParameters.msg - 消息对象
   * @param __namedParameters.conversationId - 会话id
   * @param __namedParameters.conversationType - 会话类型
   * @param __namedParameters.progress - progress 进度回调
   * @param __namedParameters.sendBefore - sendBefore 进度回调
   * @param __namedParameters.serverExtension - 扩展字段
   * @param __namedParameters.previewImg - 预览图片，一般用于发送图片和视频消息
   * @param __namedParameters.onAISend - AI 单聊或 at AI 发送成功后的回调
   */
  async sendMessageActive(params: {
    msg: V2NIMMessage;
    conversationId: string;
    conversationType?: V2NIMConversationType;
    progress?: (percentage: number) => boolean;
    sendBefore?: (msg: V2NIMMessageForUI) => void;
    serverExtension?: Record<string, unknown>;
    previewImg?: string;
    onAISend?: (
      msg: V2NIMMessageForUI,
      aiConfig: V2NIMMessageAIConfigParams
    ) => void;
  }): Promise<V2NIMMessage | void> {
    this.logger?.log("sendMessageActive", params);
    const {
      msg,
      conversationId,
      conversationType,
      progress,
      sendBefore,
      serverExtension,
      previewImg,
      onAISend,
    } = params;

    const newMsg: V2NIMMessageForUI = { ...msg };
    let finalServerExtension: YxServerExt = {};

    // @ts-ignore 发送回复消息旧模式，使用ext实现，有一系列缺点
    if (this.localOptions?.sendReplyMsgByExt) {
      finalServerExtension = this._formatExtField(
        conversationId,
        serverExtension || JSON.parse(newMsg.serverExtension || "{}")
      );
    } else {
      finalServerExtension =
        serverExtension || JSON.parse(newMsg.serverExtension || "{}");
    }

    newMsg.serverExtension = Object.keys(finalServerExtension).length
      ? JSON.stringify(finalServerExtension)
      : void 0;
    newMsg.senderId = this.rootStore.userStore.myUserInfo.accountId;
    newMsg.receiverId =
      this.nim.conversationIdUtil?.parseConversationTargetId(conversationId);
    newMsg.conversationId = conversationId;

    if (conversationType !== void 0) {
      newMsg.conversationType = conversationType;
    }

    // 当前发送的消息是否是回复消息
    const replyMsg = this.getReplyMsgActive(conversationId);

    // 在发送中的情况下，让消息先上屏，打上标记，便于UI层渲染，避免回复消息后续高度异常
    if (
      replyMsg &&
      newMsg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
    ) {
      //@ts-ignore
      newMsg.threadReply = replyMsg;
    }

    newMsg.sendingState =
      V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING;

    if (previewImg) {
      newMsg.previewImg = previewImg;
    }

    if (progress) {
      newMsg.uploadProgress = 0;
    }

    try {
      const sendMsgParams = await this.localOptions.sendMsgBefore?.(params);

      if (sendMsgParams === false) {
        this.logger?.log("sendMessageActive cancel", params, sendMsgParams);
        return;
      }

      const aiConfig = this._getAIConfig(newMsg);

      // 先插入这条消息，快速让消息上屏
      this.addMsg(newMsg.conversationId, [newMsg]);

      sendBefore?.(newMsg);

      // ai 相关配置
      const finalAIConfig =
        aiConfig || sendMsgParams?.aiConfig
          ? ({
              ...aiConfig,
              ...sendMsgParams?.aiConfig,
            } as V2NIMMessageAIConfigParams)
          : void 0;

      // 将用户传入的配置和默认配置合并，原则是用户传了用用户的，没传用默认的
      const finalParams: V2NIMSendMessageParams = {
        ...sendMsgParams,
        pushConfig:
          sendMsgParams?.pushConfig ||
          (finalServerExtension?.yxAitMsg
            ? this._formatExtAitToPushInfo(
                finalServerExtension.yxAitMsg,
                newMsg.text || ""
              )
            : void 0),
        messageConfig: {
          // 需要开启已读回执
          readReceiptEnabled: true,
          // 用户传了用用户的，没传用默认的
          ...sendMsgParams?.messageConfig,
        },
        aiConfig: finalAIConfig,
      };

      this.logger?.log(
        "sendMessageActive finalParams: ",
        newMsg,
        conversationId,
        finalParams
      );

      // 发送回复消息新模式，使用sdk replyMessage 实现
      if (
        replyMsg &&
        //@ts-ignore
        !this.localOptions?.sendReplyMsgByExt &&
        newMsg.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
      ) {
        newMsg.serverExtension = Object.keys(finalServerExtension).length
          ? JSON.stringify(finalServerExtension)
          : void 0;
        await this.replyMessageByThreadActive(
          newMsg,
          replyMsg,
          conversationId,
          finalParams
        );
        sendBefore?.(newMsg);
        return;
      }

      // 调用sdk 接口 发送消息
      const { message } = await this.nim?.messageService?.sendMessage(
        newMsg,
        conversationId,
        finalParams,
        (percentage: number) => {
          const shouldContinue = progress?.(percentage);

          if (shouldContinue) {
            const _msg = this.getMsg(conversationId, [
              newMsg.messageClientId as string,
            ])[0];

            if (_msg) {
              this.addMsg(conversationId, [
                {
                  ..._msg,
                  uploadProgress: percentage,
                },
              ]);
            }
          }
        }
      );

      if (finalAIConfig) {
        onAISend?.(message, finalAIConfig);
      }

      //uploadProgress 为UI层需要的字段，当sendMessage返回时，uploadProgress必为100
      if (
        msg.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_FILE ||
        msg.messageType ===
          V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_IMAGE ||
        msg.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_VIDEO
      ) {
        message.uploadProgress = 100;
      }

      this._handleSendMsgSuccess(message);
      this.logger?.log("sendMessageActive success", message);

      if (
        newMsg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
      ) {
        this.removeReplyMsgActive(conversationId);
      }

      return message;
    } catch (error) {
      this.logger?.error(
        "sendMessageActive failed: ",
        error as V2NIMError,
        newMsg
      );
      // 手动取消上传
      if ((error as V2NIMError).code === 191002) {
        this.removeMsg(conversationId, [newMsg.messageClientId as string]);
      } else {
        this._handleSendMsgFail(newMsg, (error as V2NIMError).code as number);
      }

      if (
        newMsg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
      ) {
        this.removeReplyMsgActive(conversationId);
      }

      throw error;
    }
  }

  /**
   * 取消上传
   * @param msg 消息对象
   */
  async cancelMessageAttachmentUploadActive(msg: V2NIMMessage): Promise<void> {
    try {
      this.logger?.log("cancelMessageAttachmentUploadActive", msg);
      await this.nim?.messageService?.cancelMessageAttachmentUpload(
        this.handleMsgForSDK(msg)
      );
      this.removeMsg(msg.conversationId, [msg.messageClientId as string]);
      this.logger?.log("cancelMessageAttachmentUploadActive success", msg);
    } catch (error) {
      this.logger?.error(
        "cancelMessageAttachmentUploadActive failed: ",
        msg,
        error
      );
      throw error;
    }
  }

  /**
   * 发送 p2p 消息已读回执
   * @param msg 消息对象
   */
  async sendMsgReceiptActive(msg: V2NIMMessage): Promise<void> {
    try {
      this.logger?.log("sendMsgReceiptActive", msg);
      await this.nim?.messageService?.sendP2PMessageReceipt(
        this.handleMsgForSDK(msg)
      );
      this.logger?.log("sendMsgReceiptActive success", msg);
    } catch (error) {
      this.logger?.error(
        "sendMsgReceiptActive failed: ",
        msg,
        error as V2NIMError
      );
      throw error;
    }
  }

  /**
   * 添加一个收藏
   * @param params 添加收藏的相关参数
   */
  async addCollectionActive(params: V2NIMAddCollectionParams): Promise<void> {
    try {
      this.logger?.log("addCollectionActive", params);
      await this.nim?.messageService?.addCollection(params);
      this.logger?.log("addCollectionActive success", params);
    } catch (error) {
      this.logger?.error(
        "addCollectionActive failed: ",
        params,
        error as V2NIMError
      );
      throw error;
    }
  }

  /**
   * 移除相关收藏
   * @param collections 需要移除的相关收藏
   */
  async removeCollectionsActive(collections: V2NIMCollection[]): Promise<void> {
    try {
      this.logger?.log("removeCollectionsActive", collections);
      await this.nim?.messageService?.removeCollections(collections);
      this.logger?.log("removeCollectionsActive success", collections);
    } catch (error) {
      this.logger?.error(
        "removeCollectionsActive failed: ",
        collections,
        error as V2NIMError
      );
      throw error;
    }
  }

  /**
   * 获取收藏列表
   * @param option 查询参数
   */
  async getCollectionListByOptionActive(
    option: V2NIMCollectionOption
  ): Promise<Array<V2NIMCollection>> {
    let res: Array<V2NIMCollection> = [];

    try {
      this.logger?.log("getCollectionListByOptionActive", option);
      res = (await this.nim?.messageService?.getCollectionListByOption(
        option
      )) as V2NIMCollection[];

      res.forEach((item) => {
        const collectionData = JSON.parse(item.collectionData as string);
        // 反序列化
        const msg = this.nim?.messageConverter?.messageDeserialization(
          collectionData.message
        );

        if (msg) {
          this.collectionMsgs.set(msg.messageClientId, msg);
        }
      });

      this.logger?.log("getCollectionListByOptionActive success", option);
    } catch (error) {
      this.logger?.error(
        "getCollectionListByOptionActive failed: ",
        option,
        error as V2NIMError
      );
      throw error;
    }

    return res;
  }

  /**
   * 发送群组消息已读回执
   * @param msgs 消息数组
   */
  async sendTeamMsgReceiptActive(msgs: V2NIMMessage[]): Promise<void> {
    try {
      this.logger?.log("sendTeamMsgReceiptActive", msgs);
      if (msgs.length) {
        const finalMsgs = msgs.map((item) => this.handleMsgForSDK(item));

        this.logger?.log("sendTeamMsgReceiptActive finalParams: ", finalMsgs);

        await this.nim?.messageService?.sendTeamMessageReceipts(finalMsgs);
      }

      this.logger?.log("sendTeamMsgReceiptActive success", msgs);
    } catch (error) {
      this.logger?.error(
        "sendTeamMsgReceiptActive failed: ",
        msgs,
        error as V2NIMError
      );
      throw error;
    }
  }

  /**
   * 获取群消息已读未读详情
   * @param message 消息
   */

  async getTeamMessageReceiptDetailsActive(
    message: V2NIMMessage,
    memberAccountIds?: string[]
  ): Promise<V2NIMTeamMessageReadReceiptDetail> {
    try {
      this.logger?.log(
        "getTeamMessageReceiptDetailsActive",
        message,
        memberAccountIds
      );
      const res = await this.nim?.messageService?.getTeamMessageReceiptDetail(
        message,
        memberAccountIds as string[]
      );

      this.logger?.log(
        "getTeamMessageReceiptDetailsActive success:",
        message,
        memberAccountIds,
        res
      );
      return res;
    } catch (error) {
      this.logger?.error(
        "getTeamMessageReceiptDetailsActive failed: ",
        message,
        memberAccountIds,
        error as V2NIMError
      );
      throw error;
    }
  }

  /**
   * 获取历史消息
   * @param options.conversationId - 消息所属的会话的ID
   * @param options.endTime - 结束时间戳, 精确到 ms, 默认为服务器的当前时间
   * @param options.lastMsgId - 上次查询的最后一条消息的 messageServerId, 第一次不填
   * @param options.limit - 本次查询的消息数量限制, 最多 100 条, 默认 100 条
   */
  async getHistoryMsgActive(options: {
    conversationId: string;
    endTime: number;
    lastMsgId?: string;
    limit: number;
  }): Promise<V2NIMMessage[]> {
    try {
      this.logger?.log("getHistoryMsgActive", options);
      const { conversationId, endTime, lastMsgId, limit = 100 } = options;
      const conversationType =
        this.nim.conversationIdUtil?.parseConversationType(conversationId);

      const finalParams: V2NIMMessageListOption = {
        conversationId,
        endTime,
        limit,
      };

      if (lastMsgId) {
        const anchorMessage = this.getMsg(conversationId, [lastMsgId])[0];

        if (anchorMessage) {
          finalParams.anchorMessage = anchorMessage;
        }
      }

      const msgs = await this.nim?.messageService?.getMessageList(finalParams);

      this.addMsg(conversationId, msgs as V2NIMMessage[]);
      // 如果是群组消息，需要获取下自己发出的消息已读未读数
      if (
        conversationType ===
          V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM &&
        this.rootStore.localOptions.teamMsgReceiptVisible
      ) {
        const myMsgs = msgs
          ?.filter((item) => item.isSelf)
          .filter(
            (item) =>
              ![
                V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_NOTIFICATION,
                V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TIP,
              ].includes(item.messageType)
          );

        await this.getTeamMsgReadsActive(
          myMsgs as V2NIMMessage[],
          conversationId
        );
      }

      this.logger?.log(
        "getHistoryMsgActive success",
        options,
        finalParams,
        msgs
      );
      return msgs as V2NIMMessage[];
    } catch (error) {
      this.logger?.error(
        "getHistoryMsgActive failed: ",
        options,
        error as V2NIMError
      );
      throw error;
    }
  }

  /**
   * 转发消息
   * @param msg - 消息对象
   * @param conversationId - 会话id
   * @param comment - 评论
   */
  async forwardMsgActive(
    msg: V2NIMMessageForUI,
    conversationId: string,
    comment?: string
  ): Promise<void> {
    try {
      this.logger?.log("forwardMsgActive", msg, conversationId, comment);
      // 处理下 msg 中的 serverExtension 字段，因为回复消息和@消息被转发后交互跟之前不一样
      let serverExtension = msg?.serverExtension;

      if (serverExtension) {
        try {
          serverExtension = JSON.parse(serverExtension);
          // @ts-ignore
          delete serverExtension.yxReplyMsg;
          // @ts-ignore
          delete serverExtension.yxAitMsg;
          serverExtension = JSON.stringify(serverExtension);
        } catch {
          //
        }
      }

      // 处理下 msg 中的 UI 相关字段，转发出去的消息不需要在此刻带上撤回相关的信息
      const deleteKeys = ["canRecall", "reCallTimer", "yxUnread", "yxRead"];

      deleteKeys.forEach((key) => {
        //@ts-ignore
        delete msg[key];
      });
      // 之前 IM2 sdk 有问题，这边先保留
      if (msg.pushConfig?.pushContent === "") {
        delete msg.pushConfig.pushContent;
      }

      const finalMsg: V2NIMMessage = this.handleMsgForSDK({
        ...msg,
        serverExtension,
      });

      const forwardMsg =
        this.nim.messageCreator?.createForwardMessage(finalMsg);

      if (forwardMsg) {
        await this.sendMessageActive({
          msg: forwardMsg,
          conversationId,
        });
      }

      if (comment) {
        const textMsg = this.nim.messageCreator?.createTextMessage(comment);

        await this.sendMessageActive({ msg: textMsg, conversationId });
      }

      this.logger?.log(
        "forwardMsgActive success",
        msg,
        conversationId,
        comment
      );
    } catch (error) {
      this.logger?.error("forwardMsgActive failed: ", error);
      throw error;
    }
  }

  /**
   * 获取群组消息已读未读数
   * @param msgs 消息数组
   * @param conversationId 会话id
   */
  async getTeamMsgReadsActive(
    msgs: V2NIMMessage[],
    conversationId: string
  ): Promise<void> {
    this.logger?.log("getTeamMsgReadsActive", msgs, conversationId);
    let res: V2NIMTeamMessageReadReceipt[] = [];

    if (msgs.length) {
      try {
        res = (await this.nim?.messageService?.getTeamMessageReceipts(
          msgs.map((item) => this.handleMsgForSDK(item))
        )) as V2NIMTeamMessageReadReceipt[];
      } catch (error) {
        this.logger?.warn(
          "getTeamMsgReadsActive failed but continue: ",
          error as V2NIMError
        );
        // 兼容老用户，忽略这个报错
      }
    }

    const newMsgs: V2NIMMessageForUI[] = msgs
      .filter((msg) =>
        res.some((status) => msg.messageClientId === status.messageClientId)
      )
      .map((item) => {
        const teamMsgReceipt = res.find(
          (j) => j.messageClientId === item.messageClientId
        );

        if (teamMsgReceipt) {
          return this._updateReceiptMsg(item, {
            unread: teamMsgReceipt.unreadCount || 0,
            read: teamMsgReceipt.readCount || 0,
          });
        }

        return item;
      });

    this.addMsg(conversationId, newMsgs);
  }
  /**
   * pin 一条消息
   * @param message 需要被 pin 的消息体
   * @param serverExtension 扩展字段
   */
  async pinMessageActive(
    message: V2NIMMessage,
    serverExtension?: string
  ): Promise<void> {
    this.logger?.log("pinMessageActive", message, serverExtension);
    try {
      await this.nim?.messageService?.pinMessage(
        message,
        serverExtension as string
      );
    } catch (error) {
      this.logger?.warn(
        "pinMessageActive failed but continue: ",
        error as V2NIMError
      );
      // 这里需要把错误抛出去，让 ui 层感知到
      throw error;
    }
  }

  /**
   * 取消一条Pin消息
   * @param messageRefer 需要被取消 pin 的消息摘要
   * @param serverExtension 扩展字段
   */
  async unpinMessageActive(
    messageRefer: V2NIMMessageRefer,
    serverExtension?: string
  ): Promise<void> {
    this.logger?.log("uppinMessageActive", messageRefer, serverExtension);
    try {
      await this.nim?.messageService?.unpinMessage(
        messageRefer,
        serverExtension as string
      );
    } catch (error) {
      this.logger?.warn(
        "uppinMessageActive failed but continue: ",
        error as V2NIMError
      );
      // 这里需要把错误抛出去，让 ui 层感知到
      throw error;
    }
  }

  /**
   * 取消一条Pin消息
   * @param messageRefer 需要被取消 pin 的消息摘要
   * @param serverExtension 扩展字段
   */
  async updatePinMessageActive(
    message: V2NIMMessage,
    serverExtension?: string
  ): Promise<void> {
    this.logger?.log("updatePinMessageActive", message, serverExtension);
    try {
      await this.nim?.messageService?.updatePinMessage(
        message,
        serverExtension as string
      );
    } catch (error) {
      this.logger?.warn(
        "updatePinMessageActive failed but continue: ",
        error as V2NIMError
      );
      // 这里需要把错误抛出去，让 ui 层感知到
      throw error;
    }
  }

  /**
   * 获取 pin 消息列表
   * @param conversationId 会话id
   */
  async getPinnedMessageListActive(conversationId: string): Promise<PinInfos> {
    const curPinMsgsMap = this.pinMsgs.get(conversationId);
    let pinInfos: PinInfos = [];

    if (curPinMsgsMap) {
      // 如果内存里面有，从内存里面获取
      pinInfos = [...curPinMsgsMap.values()];
    } else {
      // 这里不做 try catch，底层方法已处理
      // 如果内存里面没有，那么像服务器获取
      pinInfos = await this._getPinnedMessageListByServer(conversationId);
    }

    // 这里不做 try catch，底层方法已处理
    // 补全 pinInfos message 信息
    pinInfos = await this.completePinnedMessageList(conversationId, pinInfos);

    // 这里
    pinInfos = pinInfos
      .filter((pinInfo) => pinInfo.pinState > 0 && pinInfo.message)
      .sort(
        (a, b) => (b?.message!.createTime || 0) - (a?.message!.createTime || 0)
      );
    return pinInfos;
  }

  /**
   * 停止流式输出
   * @param message 消息体
   * @param params 停止模式等入参
   */
  async stopAIStreamMessageActive(
    message: V2NIMMessage,
    params: V2NIMMessageAIStreamStopParams
  ): Promise<void> {
    this.logger?.log("stopAIStreamMessageActive", message);
    try {
      await this.nim?.messageService?.stopAIStreamMessage(message, params);
    } catch (error) {
      this.logger?.error(
        "stopAIStreamMessageActive failed ",
        error as V2NIMError
      );
      throw error;
    }
  }

  /**
   * 重新生成 ai 消息
   *
   * 注: 若是流式消息, 必须等到流式分片输出完毕, 才允许调用此 API
   *
   * 此外他支持两种配置
   *
   * 1. 更新，新消息覆盖老消息---只允许更新3天内的消息
   * 2. 新消息，产生一条新消息
   *
   * @param message 需要重新输出的原始数字人消息
   * @param params 确定重新输出的操作类型
   */
  async regenAIMessageActive(
    message: V2NIMMessage,
    params: V2NIMMessageAIRegenParams
  ): Promise<void> {
    this.logger?.log("regenAIMessageActive", message);
    try {
      await this.nim?.messageService?.regenAIMessage(message, params);
    } catch (error) {
      this.logger?.error("regenAIMessageActive failed ", error as V2NIMError);
      throw error;
    }
  }

  async voiceToTextActive(message: V2NIMMessageForUI): Promise<void> {
    // 已经有转过的消息不要再次转
    if (message.textOfVoice) return;
    // 判定如果没有附件, 或者附件不是语音类型的, 也 return
    if (!message.attachment) return;
    // 类型保护, 判定一定是音视频才能走入这段逻辑
    if (!("url" in message.attachment)) return;
    // 经过了上面的类型保护后, 这一段直接访问 message.attachment.url 才不会 ts 提示说不存在
    if (!message.attachment.url) return;
    if (!("duration" in message.attachment)) return;
    if (!message.attachment.duration) return;

    this.logger?.log("voiceToTextActive", message);
    try {
      const text = await this.nim?.messageService?.voiceToText({
        voiceUrl: message.attachment.url,
        duration: message.attachment.duration,
        // todo
        // @ts-ignore
        sceneName: message.attachment.sceneName,
        // 在群里与产品孙有军交流, 得知可以写死 aac 和 16000
        mimeType: "aac",
        sampleRate: "16000",
      });

      if (!text) throw new Error("voiceToText empty");

      this.updateMsg(
        message.conversationId as string,
        message.messageClientId as string,
        {
          textOfVoice: text,
        }
      );
      this.logger?.log("voiceToTextActive success", text);
    } catch (error) {
      this.logger?.warn("voiceToTextActive failed: ", error as V2NIMError);
      // 这里需要把错误抛出去，让 ui 层感知到
      throw error;
    }
  }

  /**
   * 往内存中添加消息
   * @param conversationId - 消息所属的会话的ID
   * @param msgs- 消息对象数组
   */
  addMsg(conversationId: string, msgs: V2NIMMessageForUI[]): void {
    const sortFunc = (a: V2NIMMessageForUI, b: V2NIMMessageForUI) => {
      return (a.createTime || 0) - (b.createTime || 0);
    };

    const _msgs = this.msgs.get(conversationId) || [];
    // 获取当前会话的 pinMsgsMap
    const curPinMsgsMap = this.pinMsgs.get(conversationId);

    msgs
      .filter((item) => !!item.messageClientId)
      .map((item) => {
        // 这里做消息处理
        item = this.handleReceiveAIMsg(item);
        if (curPinMsgsMap) item = this.handleMsgPinState(item, curPinMsgsMap);

        return item;
      })
      .forEach((item) => {
        const newMsg = { ...item };
        const _msg = _msgs.find(
          (msg) => msg.messageClientId === newMsg.messageClientId
        );

        // SDK 可能会返回多条 messageClientId 相同的数据，此时取 createTime 最新的
        if (_msg) {
          if (
            (_msg?.createTime || 0) <= (newMsg?.createTime || 0) ||
            _msg.sendingState ===
              V2NIMConst.V2NIMMessageSendingState
                .V2NIM_MESSAGE_SENDING_STATE_SENDING
          ) {
            // 如果之前的消息有撤回相关字段，则更新时保留
            if (_msg.canRecall !== void 0 && _msg.reCallTimer !== void 0) {
              newMsg.canRecall = _msg.canRecall;
              newMsg.reCallTimer = _msg.reCallTimer;
            }

            // 如果之前已经请求过 voiceToText 语音转文字的结果, 那么更新时保留
            if (_msg.textOfVoice) {
              newMsg.textOfVoice = _msg.textOfVoice;
            }

            _msgs.splice(_msgs.indexOf(_msg), 1, newMsg);
          }
        } else {
          _msgs.push(item);
        }
      });
    this.msgs.set(
      conversationId,
      [..._msgs].sort(sortFunc),
      this.rootStore.uiStore.selectedConversation === conversationId
    );
  }

  /**
   * 从内存中删除消息
   * @param conversationId - 消息所属的会话的ID
   * @param idClients - 端测生成的消息id数组
   */
  removeMsg(conversationId?: string, idClients?: string[]): void {
    if (!conversationId) {
      this.getMsg().forEach((item) => {
        this._handleClearMsgTimer(item);
      });
      this.msgs.clear();
      return;
    }

    const msgs = this.msgs.get(conversationId);

    if (!msgs) {
      return;
    }

    if (!idClients || !idClients.length) {
      msgs.forEach((item) => {
        this._handleClearMsgTimer(item);
      });
      this.msgs.delete(conversationId);
      return;
    }

    this.msgs.set(
      conversationId,
      msgs.filter((msg) => {
        const isDelete =
          idClients.includes(msg.messageClientId as string) &&
          // 无法删除撤回消息
          !(
            msg.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
            msg.recallType === "beReCallMsg"
          );

        if (isDelete) {
          this._handleClearMsgTimer(msg);
        }

        return !isDelete;
      }),
      this.rootStore.uiStore.selectedConversation === conversationId
    );
  }

  deletePinInfoByMessageClientId(
    conversationId: string,
    messageClientIds: string[]
  ) {
    this.logger?.log(
      "deletePinInfoByMessageClientId",
      conversationId,
      messageClientIds
    );
    this.pinMsgs.delete(conversationId, messageClientIds);
  }
  /**
   * 从内存中获取消息
   * @param conversationId - 消息所属的会话的ID
   * @param idClients - 端测生成的消息id数组
   */
  getMsg(conversationId?: string, idClients?: string[]): V2NIMMessageForUI[] {
    if (!conversationId) {
      return this.msgs.values();
    }

    const msgs = this.msgs.get(conversationId) || [];

    if (!idClients || !idClients.length) {
      return msgs;
    }

    // 如果有 idClients，只返回 idClients 中的消息，新数组
    return msgs.filter((item) =>
      idClients.includes(item.messageClientId as string)
    );
  }

  updateMsg(
    conversationId: string,
    idClient: string,
    updateParam: Partial<V2NIMMessageForUI>
  ) {
    const msgs = this.msgs.get(conversationId);

    if (!msgs) return;

    const msg = msgs.findIndex((item) => item.messageClientId === idClient);

    if (!msg) return;

    this.msgs.set(
      conversationId,
      msgs.map((msg) => {
        if (msg.messageClientId === idClient) {
          msg = {
            ...msg,
            ...updateParam,
          };
        }

        return msg;
      }),
      this.rootStore.uiStore.selectedConversation === conversationId
    );
  }

  handleReceiveAIMsg(msg: V2NIMMessageForUI): V2NIMMessageForUI {
    const myAccountId = this.rootStore.userStore.myUserInfo.accountId;
    const aiConfig = msg.aiConfig;
    const senderId = aiConfig
      ? aiConfig.aiStatus === 2
        ? aiConfig.accountId
        : msg.senderId
      : msg.senderId;
    const isSelf = senderId === myAccountId;

    return {
      ...msg,
      __kit__isSelf: msg.isSelf,
      __kit__senderId: msg.senderId,
      isSelf,
    };
  }

  /** 处理消息的 pinState */
  handleMsgPinState(
    msg: V2NIMMessageForUI,
    curPinMsgsMap: Map<string, PinInfo>
  ): V2NIMMessageForUI {
    const pinInfo = curPinMsgsMap.get(msg.messageClientId as string);

    if (pinInfo) {
      msg.pinState = pinInfo.pinState;
      msg.operatorId = pinInfo.operatorId;
    }

    return msg;
  }

  handleMsgForSDK(msg: V2NIMMessageForUI): V2NIMMessage {
    const { __kit__isSelf, __kit__senderId, ...rest } = msg;

    let { senderId, isSelf } = msg;

    if (__kit__isSelf) {
      isSelf = __kit__isSelf;
    }

    if (__kit__senderId) {
      senderId = __kit__senderId;
    }

    return {
      ...rest,
      senderId,
      isSelf,
    };
  }

  private async _getMessageListByRefer(
    messageRefers: V2NIMMessageRefer[]
  ): Promise<V2NIMMessage[]> {
    let res: V2NIMMessage[] = [];

    try {
      res = (await this.nim?.messageService?.getMessageListByRefers(
        messageRefers
      )) as V2NIMMessage[];
    } catch (error) {
      this.logger?.warn(
        "_getMessageListByRefer failed but continue: ",
        error as V2NIMError
      );
    }

    return res;
  }

  /** 从服务器拉 pin 消息列表 */
  private async _getPinnedMessageListByServer(
    conversationId: string
  ): Promise<PinInfos> {
    this.logger?.log("_getPinnedMessageListByServer", conversationId);
    let res: V2NIMMessagePin[] = [];
    const pinInfos: PinInfos = [];

    try {
      res = (await this.nim?.messageService?.getPinnedMessageList(
        conversationId
      )) as V2NIMMessagePin[];
    } catch (error) {
      this.logger?.warn(
        "_getPinnedMessageListByServer failed but continue: ",
        error as V2NIMError
      );
    }

    res.forEach((pin) => {
      pinInfos.push({
        pinState: 1,
        ...pin,
      });
    });
    this.pinMsgs.set(conversationId, pinInfos);
    if (pinInfos.length) {
      // 主动获取 pin 消息时需要更新 msg 的 pin 状态
      this._updateMsgsPinState(conversationId, pinInfos);
    }

    return pinInfos;
  }

  /** 补全被 pin 的消息 */
  private async completePinnedMessageList(
    conversationId: string,
    pinInfos: PinInfos
  ): Promise<PinInfos> {
    let res: V2NIMMessage[] = [];

    if (!pinInfos.length) return pinInfos;
    const messageRefers: V2NIMMessageRefer[] = [];

    // 找出缺少 message 的 pinInfo，说明这个 pinInfo 没有补全消息
    pinInfos.forEach((pinInfo) => {
      if (!pinInfo.message) {
        messageRefers.push(pinInfo?.messageRefer as V2NIMMessageRefer);
      }
    });
    if (!messageRefers.length) return pinInfos;

    // 这里不做 try catch，因为 _getMessageListByRefer 已经处理了
    // 这里全都从服务器获取补全的消息，不从内存中获取已有的补全消息
    res = await this._getMessageListByRefer(messageRefers);

    if (res.length) {
      pinInfos = pinInfos.map((pinInfo) => {
        const msg = res.find(
          (item) =>
            item.messageClientId === pinInfo.messageRefer?.messageClientId
        );

        if (msg) {
          pinInfo = { ...pinInfo, message: msg };
        }

        return pinInfo;
      });
      this.pinMsgs.set(conversationId, pinInfos);
    }

    return pinInfos;
  }
  private _handleSendMsgSuccess(msg: V2NIMMessage) {
    if (msg && msg.conversationId) {
      // const canRecallMsg: V2NIMMessageForUI = {
      //   ...msg,
      //   canRecall: true,
      //   reCallTimer: setTimeout(() => {
      //     // 从内存中取最新的，因为中间可能有其他更新
      //     const _msg = this.getMsg(msg.conversationId, [msg.messageClientId])[0]

      //     if (_msg) {
      //       delete _msg.canRecall
      //       delete _msg.reCallTimer
      //       this.addMsg(msg.conversationId, [_msg])
      //     }
      //   }, RECALL_TIME) as unknown as number,
      // }

      // delete canRecallMsg.uploadProgress
      // delete canRecallMsg.previewImg
      // delete canRecallMsg.errorCode
      this.addMsg(msg.conversationId, [msg]);
    }
  }

  private _handleSendMsgFail(msg: V2NIMMessage, errorCode: number) {
    // 发送失败，拉黑的情况不能撤回、可以删除；网络情况不能撤回、不能删除
    // 因此删除那边做一下 try catch 处理，忽略错误消息
    // 先清除老消息的定时器，再更新消息
    if (msg && msg.conversationId) {
      const oldMsg = this.getMsg(msg.conversationId, [
        msg.messageClientId as string,
      ])[0];

      this._handleClearMsgTimer(oldMsg);
      this.addMsg(msg.conversationId, [
        {
          ...oldMsg,
          ...msg,
          messageStatus: {
            errorCode,
          },
          uploadProgress: void 0,
          sendingState:
            V2NIMConst.V2NIMMessageSendingState
              .V2NIM_MESSAGE_SENDING_STATE_FAILED,
          errorCode,
        },
      ]);
    }
  }

  private _handleClearMsgTimer(msg?: V2NIMMessageForUI) {
    if (msg) {
      clearTimeout(msg.canEditTimer);
      clearTimeout(msg.reCallTimer);
    }
  }

  private _onReceiveMessages(data: V2NIMMessage[]) {
    this.logger?.log("_onReceiveMessages: ", data);
    data.forEach((item) => {
      this.addMsg(item.conversationId as string, [item]);
    });
    if (this.localOptions?.enableCloudConversation) {
      this.rootStore.conversationStore?.handleConversationWithAit(data);
    } else {
      this.rootStore.localConversationStore?.handleConversationWithAit(data);
    }
  }

  private _onReceiveMessagesModified(data: V2NIMMessage[]) {
    this.logger?.log("_onReceiveMessagesModified: ", data);
    data.forEach((item) => {
      this.addMsg(item.conversationId as string, [item]);
    });
  }

  private _onClearHistoryNotifications(data: V2NIMClearHistoryNotification[]) {
    this.logger?.log("_onClearHistory: ", data);
    data.forEach((item) => {
      this.removeMsg(item.conversationId);
    });
  }

  private _onMessageDeletedNotifications(
    data: V2NIMMessageDeletedNotification[]
  ) {
    this.logger?.log("_onMessageDeletedNotifications: ", data);
    const res: { [key: string]: V2NIMMessageDeletedNotification[] } = {};

    data.forEach((item) => {
      const conversationId = item.messageRefer?.conversationId;

      if (res[conversationId as string]) {
        res[conversationId as string].push(item);
      } else {
        res[conversationId as string] = [item];
      }
    });
    Object.keys(res).forEach((conversationId) => {
      const messageClientIds = res[conversationId].map(
        (item) => item.messageRefer?.messageClientId
      );

      this.removeMsg(conversationId, messageClientIds as string[]);
      this.deletePinInfoByMessageClientId(
        conversationId,
        messageClientIds as string[]
      );
    });
  }

  private _onMessagePinNotification(data: V2NIMMessagePinNotification) {
    const {
      operatorId,
      messageRefer,
      serverExtension,
      createTime,
      updateTime,
    } = data.pin as V2NIMMessagePin;
    const curPinMsgsMap = this.pinMsgs.get(
      messageRefer?.conversationId as string
    );

    // 如果内存里面没有当前会话的 pin map，直接返回；等主动调用了 getPinnedMessageListActive 内存才会有 pin map，才处理相应的 _onMessagePinNotification
    if (!curPinMsgsMap) return;
    const pinState = data.pinState;
    const pinInfo = curPinMsgsMap?.get(messageRefer?.messageClientId as string);

    const newPinInfo: PinInfos = [
      {
        pinState: pinState as number,
        messageRefer,
        operatorId,
        serverExtension,
        // @ts-ignore
        createTime: pinInfo?.createTime || createTime,
        updateTime,
      },
    ];

    // 补全 message。咨询过产品，nim?.messageService.getMessageListByRefers 这个接口不会有频控的问题，一个人1分钟可以调用几百次。所以这里可以实时补全 message
    this.completePinnedMessageList(
      messageRefer?.conversationId as string,
      newPinInfo
    ).then((pinInfo) => {
      this._updateMsgsPinState(messageRefer?.conversationId as string, pinInfo);
    });
  }

  private _updateMsgsPinState(conversationId: string, pinInfos: PinInfos) {
    // 获取会话内存中维护的所有消息
    const _msgs = this.getMsg(conversationId) || [];
    let hasChange = false;

    pinInfos.forEach((pinInfo) => {
      // 找到需要更新 pin 状态的 msg
      const msg = _msgs.find(
        (msg) => msg.messageClientId === pinInfo.messageRefer?.messageClientId
      );

      // 如果内存里有对应的消息，再更新 pin 状态；没有，会在之后拉取到对应消息再更新
      if (msg && msg.pinState !== pinInfo.pinState) {
        const newMsg = { ...msg };

        newMsg.pinState = pinInfo.pinState;
        newMsg.operatorId = pinInfo.operatorId;
        _msgs.splice(_msgs.indexOf(msg), 1, newMsg);
        hasChange = true;
      }
    });
    if (hasChange) {
      this.msgs.set(
        conversationId,
        _msgs,
        this.rootStore.uiStore.selectedConversation === conversationId
      );
    }
  }

  private _onMessageQuickCommentNotification() {
    // 暂不支持
  }

  private async _onMessageRevokeNotifications(
    data: V2NIMMessageRevokeNotification[]
  ) {
    this.logger?.log("_onMessageRevokeNotifications: ", data);
    data.forEach(async (item) => {
      const oldMsg = this.getMsg(item.messageRefer?.conversationId, [
        item.messageRefer?.messageClientId as string,
      ])[0];

      // 这里只处理新的撤回消息，老的表示是自己主动撤回的，不处理。
      if (oldMsg && oldMsg.recallType) {
        return;
      }

      const conversationId = item.messageRefer?.conversationId;
      const messageClientIds = [item.messageRefer?.messageClientId];

      this.removeMsg(conversationId, messageClientIds as string[]);
      this.deletePinInfoByMessageClientId(
        conversationId as string,
        messageClientIds as string[]
      );
      if (!item.message?.isSelf) {
        // 处理对方撤回消息的情况
        const msg = this._createBeReCallMsg(item);
        this.addMsg(msg.conversationId as string, [msg]);
      } else {
        // 处理自己撤回消息的情况
        const msg = this._createReCallMsg(item.message);
        this.addMsg(msg.conversationId as string, [msg]);
      }

      if (
        item.messageRefer?.conversationType ===
        V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_TEAM
      ) {
        const conversation = this.localOptions?.enableCloudConversation
          ? this.rootStore.conversationStore?.conversations.get(
              conversationId as string
            )
          : this.rootStore.localConversationStore?.conversations.get(
              conversationId as string
            );

        if (conversation) {
          let aitMsgs = conversation.aitMsgs || [];
          const messageClientId = item.messageRefer.messageClientId;

          if (aitMsgs.includes(messageClientId as string)) {
            aitMsgs = aitMsgs.filter((item) => item !== messageClientId);

            if (this.localOptions?.enableCloudConversation) {
              this.rootStore.conversationStore?.updateConversation([
                //@ts-ignore serverExtension 缺失，预期内
                { ...conversation, aitMsgs },
              ]);
            } else {
              this.rootStore.localConversationStore?.updateConversation([
                { ...conversation, aitMsgs } as V2NIMLocalConversationForUI,
              ]);
            }
          }
        }
      }
    });
  }

  private _onReceiveP2PMessageReadReceipts(data: V2NIMP2PMessageReadReceipt[]) {
    this.logger?.log("_onReceiveP2PMessageReadReceipts: ", data);
    data.forEach((item) => {
      const oldConversation = this.localOptions?.enableCloudConversation
        ? this.rootStore.conversationStore?.conversations.get(
            item?.conversationId as string
          )
        : this.rootStore.localConversationStore?.conversations.get(
            item.conversationId as string
          );

      if (
        oldConversation &&
        (item?.timestamp || 0) > (oldConversation.msgReceiptTime || 0)
      ) {
        if (this.localOptions?.enableCloudConversation) {
          this.rootStore.conversationStore?.updateConversation([
            //@ts-ignore
            {
              ...oldConversation,
              msgReceiptTime: item.timestamp,
            },
          ]);
        } else {
          this.rootStore.localConversationStore?.updateConversation([
            {
              ...oldConversation,
              msgReceiptTime: item.timestamp,
            } as V2NIMLocalConversationForUI,
          ]);
        }
      }
    });
  }

  private _onReceiveTeamMessageReadReceipts(
    data: V2NIMTeamMessageReadReceipt[]
  ): void {
    this.logger?.log("_onReceiveTeamMessageReadReceipts: ", data);
    // 群消息中，同一条消息可能收到多条消息的回执，需要按照已读数量排序，服务端下发可能顺序不一致，端上排序，保证最后的已读未读情况覆盖之前的
    data.sort((a, b) => (a?.readCount || 0) - (b?.readCount || 0));
    data.forEach((msgReadReceipt) => {
      const conversationId = msgReadReceipt.conversationId;
      const msg = this.getMsg(conversationId, [
        msgReadReceipt.messageClientId as string,
      ])[0];

      if (msg) {
        const newMsg = this._updateReceiptMsg(msg, {
          unread: msgReadReceipt.unreadCount || 0,
          read: msgReadReceipt.readCount || 0,
        });

        this.addMsg(conversationId as string, [newMsg]);
      }
    });
  }

  private _formatExtField(
    conversationId: string,
    serverExtension?: Record<string, unknown>
  ): YxServerExt {
    const extObj: YxServerExt = serverExtension || {};
    // 有回复消息的情况，需要把回复消息的信息放到 serverExtension 中
    const replyMsg = this.getReplyMsgActive(conversationId);

    if (replyMsg) {
      extObj.yxReplyMsg = {
        idClient: replyMsg.messageClientId,
        scene: replyMsg.conversationType,
        from: replyMsg.senderId,
        receiverId: replyMsg.receiverId,
        to: replyMsg.conversationId,
        idServer: replyMsg.messageServerId,
        time: replyMsg.createTime,
      } as YxReplyMsg;
    }

    return extObj;
  }

  private _updateReceiptMsg(
    originMsg: V2NIMMessage,
    data: {
      unread: number;
      read: number;
    }
  ): V2NIMMessageForUI {
    return {
      ...originMsg,
      yxUnread: Number(data.unread),
      yxRead: Number(data.read),
    };
  }

  private _formatExtAitToPushInfo(
    yxAitMsg: YxAitMsg,
    content: string
  ): V2NIMMessagePushConfig | undefined {
    function getForcePushIDsList(obj: YxAitMsg): string[] | undefined {
      return Object.keys(obj).includes(AT_ALL_ACCOUNT)
        ? void 0
        : Object.keys(obj);
    }

    const pushInfo: V2NIMMessagePushConfig = {
      forcePushAccountIds: getForcePushIDsList(yxAitMsg),
      forcePush: true,
      forcePushContent: content,
    };

    return pushInfo;
  }

  private _createReCallMsg(msg: V2NIMMessageForUI): V2NIMMessageForUI {
    const recallMsg: V2NIMMessageForUI = {
      ...msg,
      isSelf: true,
      sendingState:
        V2NIMConst.V2NIMMessageSendingState
          .V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED,
      messageType: V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM,
      recallType: "reCallMsg",
      messageClientId: `recall-${msg.messageClientId}`,
    };

    // 只有 type 为 custom 和 text 的消息可以被重新编辑
    if (
      [
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM,
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT,
      ].includes(msg.messageType as V2NIMMessageType)
    ) {
      recallMsg.oldText = msg.text;
      recallMsg.canEdit = true;
      recallMsg.isRecallMsg = true;
      recallMsg.canEditTimer = setTimeout(() => {
        const newMsg = this.getMsg(recallMsg.conversationId, [
          recallMsg.messageClientId as string,
        ])[0];

        if (newMsg) {
          this.addMsg(newMsg.conversationId as string, [
            {
              ...newMsg,
              canEdit: false,
            },
          ]);
        }
      }, RECALL_TIME) as unknown as number;
    }
    return recallMsg;
  }

  private _createBeReCallMsg(
    data: V2NIMMessageRevokeNotification
  ): V2NIMMessageForUI {
    // @ts-ignore
    return {
      ...data.messageRefer,
      isSelf:
        data.messageRefer?.senderId ===
        this.rootStore.userStore.myUserInfo.accountId,
      sendingState:
        V2NIMConst.V2NIMMessageSendingState
          .V2NIM_MESSAGE_SENDING_STATE_SUCCEEDED,
      messageType: V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM,
      recallType: "beReCallMsg",
      messageClientId: `recall-${data.messageRefer?.messageClientId}`,
    };
  }

  private _getAIConfig(
    msg: V2NIMMessageForUI
  ): V2NIMMessageAIConfigParams | undefined {
    const {
      serverExtension,
      conversationId,
      receiverId,
      messageType,
      text = "",
    } = msg;

    let serverExt;

    try {
      serverExt = JSON.parse(serverExtension || "{}");
    } catch {
      serverExt = {};
    }

    // at 消息
    const yxAitMsg = serverExt.yxAitMsg || {};
    // 回复消息
    const replyMsg = this.getReplyMsgActive(conversationId as string);
    const { relation } = this.rootStore.uiStore.getRelation(
      receiverId as string
    );
    const myAccountId = this.rootStore.userStore.myUserInfo.accountId;

    let aiConfig: V2NIMMessageAIConfigParams | undefined = void 0;

    if (relation === "ai") {
      if (messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT) {
        // 取最近的30条文本会话
        let _msgs = (this.msgs.get(conversationId as string) || [])
          .slice(-AI_MESSAGE_LIMIT)
          .filter(
            (item) =>
              item.messageType ===
              V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
          );

        // 找到第一条自己发的消息，从此时开始作为真正的上下文
        const myIndex = _msgs.findIndex(
          (item) => item.senderId === myAccountId
        );

        _msgs = myIndex === -1 ? [] : _msgs.slice(myIndex);

        //@ts-ignore
        aiConfig = {
          accountId: receiverId as string,
          content: { msg: text, type: 0 },
          // 取最后30条消息作为上下文
          messages: _msgs.map((item) => {
            const role =
              item.senderId === myAccountId
                ? ("user" as unknown as V2NIMAIModelRoleType)
                : ("assistant" as unknown as V2NIMAIModelRoleType);

            return {
              role,
              msg: item.text || "",
              type: 0,
            };
          }),
        };
      } else {
        //@ts-ignore
        aiConfig = {
          accountId: receiverId as string,
        };
      }
    }

    // 只保留 at 数字人的 yxAitMsg
    const newYxAitMsg: YxAitMsg = {};

    Object.keys(yxAitMsg).forEach((account) => {
      if (this.rootStore.aiUserStore.aiUsers.has(account)) {
        newYxAitMsg[account] = yxAitMsg[account];
      }
    });

    // 找到最早的 at 数字人
    const aiAtAccount = this._findMinStart(newYxAitMsg);
    const aiAtMember = this.rootStore.aiUserStore.aiUsers.get(
      aiAtAccount || ""
    );

    // 表示 at 数字人
    if (aiAtMember) {
      //@ts-ignore
      aiConfig = {
        accountId: aiAtMember.accountId as string,
        content: { msg: text, type: 0 },
      };
    }

    // 表示此时有回复消息
    if (replyMsg && aiConfig) {
      // 只有回复的是文本消息需要带上下文，其他类型消息不用带上下文
      if (
        replyMsg.messageType ===
        V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_TEXT
      ) {
        aiConfig.messages = [
          {
            role: "user" as unknown as V2NIMAIModelRoleType,
            msg: replyMsg.text || "",
            type: 0,
          },
        ];
      } else {
        aiConfig.messages = void 0;
      }
    }

    if (aiConfig) {
      aiConfig.aiStream = !!this.localOptions?.aiStream;
    }

    return aiConfig;
  }

  private _findMinStart(data: YxAitMsg): string | void {
    let minStart = Number.MAX_VALUE;
    let minStartKey: string | void = void 0;

    for (const key in data) {
      const segments = data[key].segments;

      for (const segment of segments) {
        if (segment.start < minStart) {
          minStart = segment.start;
          minStartKey = key;
        }
      }
    }

    return minStartKey;
  }
}
