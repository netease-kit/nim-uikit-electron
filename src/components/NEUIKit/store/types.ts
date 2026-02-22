import {
  V2NIMMessage,
  V2NIMFriendAddApplication,
  V2NIMConversation,
  V2NIMAIUser,
  V2NIMLocalConversation,
  V2NIMTeamJoinActionInfo,
  V2NIMSendMessageParams,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import {
  V2NIMTeamAgreeMode,
  V2NIMTeamInviteMode,
  V2NIMTeamJoinMode,
  V2NIMTeamUpdateExtensionMode,
  V2NIMTeamUpdateInfoMode,
  V2NIMConversationType,
} from "node-nim";

export interface V2NIMConversationForUI extends V2NIMConversation {
  // 点对点已读时间戳
  msgReceiptTime?: number;
  aitMsgs?: string[];
  // 是否有人@我 此属性为兼容老版本，10.6.0 之后，ui层不再用到beMentioned，会话上判断是否有人@，通过aitMsgs的长度判断，撤回@消息等也需动态更新aitMsgs
  beMentioned?: boolean;
}

export interface V2NIMLocalConversationForUI extends V2NIMLocalConversation {
  // 点对点已读时间戳
  msgReceiptTime?: number;
  aitMsgs?: string[];
  // 是否有人@我 此属性为兼容老版本，10.6.0 之后，ui层不再用到beMentioned，会话上判断是否有人@，通过aitMsgs的长度判断，撤回@消息等也需动态更新aitMsgs
  beMentioned?: boolean;
}

export interface V2NIMTeamJoinActionInfoForUI extends V2NIMTeamJoinActionInfo {
  // UI 层添加的群名称字段（异步获取后填充）
  teamName?: string;
}

export interface V2NIMFriendAddApplicationForUI extends V2NIMFriendAddApplication {}

export interface AIUserAgentProvider {
  /**
   * 注册 AI 划词数字人
   */
  getAISearchUser?(user: V2NIMAIUser[]): V2NIMAIUser | void;

  /**
   * 注册 AI 翻译数字人
   */
  getAITranslateUser?(user: V2NIMAIUser[]): V2NIMAIUser | void;

  /**
   * 注册 AI 翻译语言
   */
  getAITranslateLangs?(user: V2NIMAIUser[]): string[];
}

export interface V2NIMMessageForUI extends V2NIMMessage {
  // 上传进度 0-100
  uploadProgress?: number;
  // 上传速度（字节/秒）
  uploadSpeed?: number;
  // 上传开始时间戳
  uploadStartTime?: number;
  // 已上传字节数
  uploadedBytes?: number;
  // 上传时预览图片
  previewImg?: string;
  // 上传时预览图片宽度（用于图片/视频消息在上传过程中显示正确的宽高比）
  previewWidth?: number;
  // 上传时预览图片高度
  previewHeight?: number;
  // 能否撤回
  canRecall?: boolean;
  // 撤回定时器
  reCallTimer?: number;
  // 能否重新编辑
  canEdit?: boolean;
  // 是否是撤回的消息
  isRecallMsg?: boolean;
  // 重新编辑定时器
  canEditTimer?: number;
  // 撤回类型
  recallType?: "beReCallMsg" | "reCallMsg";
  // 重新编辑之前的内容
  oldText?: string;
  // 未读人数
  yxUnread?: number;
  // 已读人数
  yxRead?: number;
  // 发送失败错误码
  errorCode?: number;
  // pin 状态：0 未pin、1 已pin、2 已pin 状态更新
  pinState?: number;
  // pin 的操作者
  operatorId?: string;
  // 语音转文字后的文字内容. 当消息类型为 audio 时才可能存在
  textOfVoice?: string;
  // 原始消息上的 senderId
  __kit__senderId?: string;
  // 原始消息上的 isSelf
  __kit__isSelf?: boolean;
}

export interface LocalOptions {
  /**
   添加好友模式，默认需要验证
   */
  addFriendNeedVerify?: boolean;
  /**
   群组邀请模式，默认管理员可邀请
   */
  teamInviteMode?: V2NIMTeamInviteMode;
  /**
   (用户)申请入群的模式定义，默认无需验证
   */
  teamJoinMode?: V2NIMTeamJoinMode;
  /**
   (管理员)邀请入群时是否需要被邀请人(用户)的同意模式定义，默认无需验证
   */
  teamAgreeMode?: V2NIMTeamAgreeMode;
  /**
   群组更新模式，默认管理员可修改
   */
  teamUpdateTeamMode?: V2NIMTeamUpdateInfoMode;
  /**
   群组更新自定义字段模式，默认所有人可修改
   */
  teamUpdateExtMode?: V2NIMTeamUpdateExtensionMode;
  /**
   是否需要@消息提醒，默认true
   */
  needMention?: boolean;
  /**
   转让群主的同时是否退出群聊，默认false
   */
  leaveOnTransfer?: boolean;
  /**
   是否允许群主转让，默认false
   */
  allowTransferTeamOwner?: boolean;
  /**
   是否显示在线离线状态，默认 true
   */
  loginStateVisible?: boolean;
  /**
   * 发送消息前的钩子函数，异步函数
   * @param options 消息的发送参数
   * @returns Promise 处理后的发送参数
   */
  /**
    是否需要显示 p2p 消息、p2p会话列表消息已读未读，默认 false
    */
  p2pMsgReceiptVisible?: boolean;
  /**
    是否需要显示群组消息已读未读，默认 false
  */
  teamMsgReceiptVisible?: boolean;
  /**
    是否需要显示群管理员相关主动功能，默认 false
  */
  teamManagerVisible?: boolean;
  /**
    是否开启数字人功能，默认 true
   */
  aiVisible?: boolean;
  /**
    控制是否启用群聊功能。默认true，如果设为 false，所有与群相关的功能将会被隐藏。
   */
  enableTeam?: boolean;
  /**
    单个群管理员默认数量限制，默认 10 个
  */
  teamManagerLimit?: number;
  /**
   * 是否允许切换群邀请模式，默认 true
   */
  enableChangeTeamJoinMode?: boolean;
  /**
   * 是否允许切换群加入模式，默认 true
   */
  enableChangeTeamAgreeMode?: boolean;
  /**
     发送消息前的钩子函数，异步函数，返回 false 则不发送消息
   */
  sendMsgBefore?: (params: any) => Promise<V2NIMSendMessageParams | false>;
  /**
     AI 机器人提供者
   */
  aiUserAgentProvider?: AIUserAgentProvider;

  /**
   * 是否开启云端会话，默认false
   */
  enableCloudConversation?: boolean;
  /**
     会话列表拉取会话数量，默认 100
   */
  conversationLimit?: number;
  /**
   * 是否开启日志打印
   */
  debug?: "off" | "debug";
  /**
   * iconfont url 私有化部署时使用
   */

  iconfontUrl?: string[];
  /**
   * 是否需要流式输出ai 消息
   */
  aiStream?: boolean;
  /**
   * 是否启用桌面消息通知，默认 true
   */
  enableDesktopNotification?: boolean;

  /**
   * 是否启用云端搜索，默认 true
   */
  enableCloudSearch?: boolean;
}

export type ContactType = "blackList" | "groupList" | "friendList" | "msgList" | "aiList";

export type Relation = "friend" | "stranger" | "myself" | "ai";

export interface AIUserServerExt {
  pinDefault?: number;
  aiChat?: number;
  welcomeText?: string;
}

export interface MyUserServerExt {
  unpinAIUsers?: string[];
}

export interface YxAitMsg {
  [key: string]: {
    text?: string;
    segments: {
      start: number;
      end: number;
      broken?: boolean;
    }[];
  };
}

export interface YxTopMessage {
  idClient: string;
  scene: V2NIMConversationType;
  from: string;
  receiverId: string;
  // conversationId
  to: string;
  idServer: string;
  time: number;
  operator: string;
  operation: 0 | 1; // 0: add; 1: remove
}

export interface YxServerExt {
  yxAllowAt?: "manager" | "all";
  yxAllowTop?: "manager" | "all";
  lastOpt?: "yxAllowAt" | "yxAllowTop" | "yxMessageTop";
  yxMessageTop?: YxTopMessage;
  yxReplyMsg?: YxReplyMsg;
  yxAitMsg?: YxAitMsg;
  im_ui_kit_group?: boolean;
}

export interface YxReplyMsg {
  idClient: string;
  scene: V2NIMConversationType;
  from: string;
  receiverId: string;
  // conversationId
  to: string;
  idServer: string;
  time: number;
}
