import { describe, expect, it, vi } from "vitest";
import { shouldRenderMessageMarkdown } from "./msg";
import type { V2NIMMessageForUI } from "../store/types";

vi.mock("node-nim", () => {
  const emptyEnum = {};

  return {
    V2NIMDataSyncLevel: emptyEnum,
    V2NIMDataSyncType: emptyEnum,
    V2NIMDataSyncState: emptyEnum,
    V2NIMConversationType: {
      V2NIM_CONVERSATION_TYPE_P2P: 1,
    },
    V2NIMLastMessageState: emptyEnum,
    V2NIMFriendAddMode: emptyEnum,
    V2NIMFriendAddApplicationStatus: emptyEnum,
    V2NIMFriendDeletionType: emptyEnum,
    V2NIMLoginAuthType: emptyEnum,
    V2NIMLoginStatus: emptyEnum,
    V2NIMLoginClientType: emptyEnum,
    V2NIMKickedOfflineReason: emptyEnum,
    V2NIMLoginClientChange: emptyEnum,
    V2NIMConnectStatus: emptyEnum,
    V2NIMMessageType: {
      V2NIM_MESSAGE_TYPE_TEXT: 0,
      V2NIM_MESSAGE_TYPE_IMAGE: 1,
      V2NIM_MESSAGE_TYPE_AUDIO: 2,
      V2NIM_MESSAGE_TYPE_VIDEO: 3,
      V2NIM_MESSAGE_TYPE_LOCATION: 4,
      V2NIM_MESSAGE_TYPE_NOTIFICATION: 5,
      V2NIM_MESSAGE_TYPE_FILE: 6,
      V2NIM_MESSAGE_TYPE_TIP: 10,
      V2NIM_MESSAGE_TYPE_ROBOT: 11,
      V2NIM_MESSAGE_TYPE_CALL: 12,
      V2NIM_MESSAGE_TYPE_CUSTOM: 100,
    },
    V2NIMMessageNotificationType: emptyEnum,
    V2NIMMessageAttachmentUploadState: emptyEnum,
    V2NIMMessageSendingState: emptyEnum,
    V2NIMQueryDirection: emptyEnum,
    V2NIMMessageRevokeType: emptyEnum,
    V2NIMMessagePinState: emptyEnum,
    V2NIMMessageQuickCommentType: emptyEnum,
    V2NIMClientAntispamOperateType: emptyEnum,
    V2NIMSortOrder: emptyEnum,
    V2NIMTeamMessageMuteMode: emptyEnum,
    V2NIMP2PMessageMuteMode: emptyEnum,
    V2NIMTeamMemberRoleQueryType: emptyEnum,
    V2NIMTeamType: emptyEnum,
    V2NIMTeamJoinMode: emptyEnum,
    V2NIMTeamAgreeMode: emptyEnum,
    V2NIMTeamInviteMode: emptyEnum,
    V2NIMTeamUpdateInfoMode: emptyEnum,
    V2NIMTeamChatBannedMode: emptyEnum,
    V2NIMTeamUpdateExtensionMode: emptyEnum,
    V2NIMTeamJoinActionType: emptyEnum,
    V2NIMTeamJoinActionStatus: emptyEnum,
    V2NIMTeamMemberRole: emptyEnum,
    V2NIMSearchKeywordMathType: emptyEnum,
    V2NIMSearchDirection: emptyEnum,
    V2NIMSearchStrategy: emptyEnum,
    V2NIMAIModelRoleType: emptyEnum,
    V2NIMAIModelType: emptyEnum,
    V2NIMSignallingChannelType: emptyEnum,
    V2NIMSignallingEventType: emptyEnum,
    V2NIMUserStatusType: emptyEnum,
  };
});

const MESSAGE_TYPE_TEXT = 0;
const MESSAGE_TYPE_IMAGE = 1;
const V2NIM_MESSAGE_AI_STATUS_RESPONSE = 2;

const createTextMessage = (overrides: Partial<V2NIMMessageForUI> = {}): V2NIMMessageForUI =>
  ({
    messageType: MESSAGE_TYPE_TEXT,
    text: "## 标题\n\n- 列表",
    senderId: "user-1",
    ...overrides,
  }) as V2NIMMessageForUI;

describe("shouldRenderMessageMarkdown", () => {
  it("对 SDK AI 回复启用 markdown", () => {
    const msg = createTextMessage({
      aiConfig: {
        accountId: "ai-1",
        aiStatus: V2NIM_MESSAGE_AI_STATUS_RESPONSE,
      } as V2NIMMessageForUI["aiConfig"],
    });

    expect(shouldRenderMessageMarkdown(msg)).toBe(true);
  });

  it("对流式文本消息启用 markdown", () => {
    const msg = createTextMessage({
      streamConfig: {} as V2NIMMessageForUI["streamConfig"],
    });

    expect(shouldRenderMessageMarkdown(msg)).toBe(true);
  });

  it("对 AI Bot Topic 中来自 bot 的文本回复启用 markdown", () => {
    const msg = createTextMessage({
      conversationId: "p2p|bot-1",
      senderId: "bot-1",
      isSelf: false,
    });

    expect(
      shouldRenderMessageMarkdown(msg, {
        currentAccountId: "me",
        conversationTargetId: "bot-1",
        isAIBotTopicConversation: true,
        isAIBot: (accountId) => accountId === "bot-1",
      })
    ).toBe(true);
  });

  it("AI Bot Topic 中自己发送的文本仍走普通文本渲染", () => {
    const msg = createTextMessage({
      conversationId: "p2p|bot-1",
      senderId: "me",
      isSelf: true,
    });

    expect(
      shouldRenderMessageMarkdown(msg, {
        currentAccountId: "me",
        conversationTargetId: "bot-1",
        isAIBotTopicConversation: true,
        isAIBot: () => true,
      })
    ).toBe(false);
  });

  it("普通聊天文本即使包含 markdown 字符也不启用 markdown", () => {
    const msg = createTextMessage({
      text: "**普通文本** http://example.com @张三",
      senderId: "user-1",
    });

    expect(shouldRenderMessageMarkdown(msg)).toBe(false);
  });

  it("非文本消息不启用 markdown", () => {
    const msg = createTextMessage({
      messageType: MESSAGE_TYPE_IMAGE,
      text: "## 图片标题",
    });

    expect(shouldRenderMessageMarkdown(msg)).toBe(false);
  });
});
