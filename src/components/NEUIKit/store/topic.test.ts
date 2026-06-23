import { describe, expect, it, vi } from "vitest";
import { TopicStore } from "./topic";

const conversationId = "p2p|bot-1";
const anotherConversationId = "p2p|bot-2";

const createTopicStore = () => {
  const topicService = {
    on: vi.fn(),
    off: vi.fn(),
    getTopicMessageList: vi.fn(),
    getTopicListByOption: vi.fn().mockResolvedValue({
      topicList: [],
      hasMore: false,
      nextToken: "",
    }),
  };
  const messageService = {
    on: vi.fn(),
    off: vi.fn(),
    getLocalThreadMessageList: vi.fn().mockResolvedValue({
      replyList: [],
    }),
  };
  const nim = {
    topicService,
    messageService,
    conversationIdUtil: {
      parseConversationTargetId: vi.fn().mockReturnValue("bot-1"),
      parseConversationType: vi.fn().mockReturnValue(1),
    },
  };
  const rootStore = {
    logger: null,
    localOptions: {
      enableCloudConversation: false,
    },
    localConversationStore: {
      getConversationReadTimeActive: vi.fn().mockResolvedValue(0),
      markConversationReadActive: vi.fn().mockResolvedValue(Date.now()),
    },
    conversationStore: {
      getConversationReadTimeActive: vi.fn().mockResolvedValue(0),
      markConversationReadActive: vi.fn().mockResolvedValue(Date.now()),
    },
    uiStore: {
      selectedConversation: conversationId,
    },
    isAIBotTopicConversation: vi.fn().mockReturnValue(true),
    userStore: {
      myUserInfo: {
        accountId: "me",
      },
    },
    msgStore: {
      handleMsgForSDK: vi.fn((message) => message),
      removeReplyMsgActive: vi.fn(),
    },
  };

  return {
    store: new TopicStore(rootStore as never, nim as never),
    topicService,
    messageService,
    nim,
  };
};

describe("TopicStore draft placeholder", () => {
  it("inserts a visible placeholder topic row when entering a draft", () => {
    const { store } = createTopicStore();

    store.enterDraft(conversationId);

    const state = store.getState(conversationId);
    expect(state.selected.type).toBe("draft");
    expect(state.draft?.topicId).toBeTruthy();
    expect(state.topicRows).toHaveLength(1);
    expect(state.topicRows[0].topicId).toBe(state.draft?.topicId);
    expect(state.topicRows[0].title).toBe("新会话");
    expect(state.topicRows[0].timeText).toBe("");
  });

  it("keeps the placeholder when an in-flight empty topic list load finishes", async () => {
    const { store, topicService } = createTopicStore();
    let resolveList: (value: { topicList: never[]; hasMore: boolean; nextToken: string }) => void =
      () => {};
    topicService.getTopicListByOption.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve;
      })
    );

    const loadTask = store.ensureAllTopicsLoaded(conversationId);
    store.enterDraft(conversationId);
    resolveList({
      topicList: [],
      hasMore: false,
      nextToken: "",
    });
    await loadTask;

    const state = store.getState(conversationId);
    expect(state.selected.type).toBe("draft");
    expect(state.topicRows).toHaveLength(1);
    expect(state.topicRows[0].topicId).toBe(state.draft?.topicId);
    expect(state.empty).toBe(false);
  });

  it("prepends the placeholder when the conversation already has topics", async () => {
    const { store, topicService } = createTopicStore();
    topicService.getTopicListByOption.mockResolvedValueOnce({
      topicList: [
        {
          topicId: "topic-1",
          conversationId,
          topicName: "你叫什么?",
          createTime: Date.now() - 60_000,
          updateTime: Date.now() - 60_000,
          messageClientId: "root-client-1",
          messageServerId: "root-server-1",
          messageTime: Date.now() - 60_000,
        },
        {
          topicId: "topic-2",
          conversationId,
          topicName: "中国西藏",
          createTime: Date.now() - 120_000,
          updateTime: Date.now() - 120_000,
          messageClientId: "root-client-2",
          messageServerId: "root-server-2",
          messageTime: Date.now() - 120_000,
        },
      ],
      hasMore: false,
      nextToken: "",
    });

    await store.ensureAllTopicsLoaded(conversationId);
    store.enterDraft(conversationId);

    const state = store.getState(conversationId);
    expect(state.selected.type).toBe("draft");
    expect(state.topicRows).toHaveLength(3);
    expect(state.topicRows[0].topicId).toBe(state.draft?.topicId);
    expect(state.topicRows[0].title).toBe("新会话");
  });

  it("creates independent placeholders for different conversations", () => {
    const { store } = createTopicStore();

    store.enterDraft(conversationId);
    store.enterDraft(anotherConversationId);

    const firstState = store.getState(conversationId);
    const secondState = store.getState(anotherConversationId);

    expect(firstState.selected.type).toBe("draft");
    expect(secondState.selected.type).toBe("draft");
    expect(firstState.draft?.topicId).toBeTruthy();
    expect(secondState.draft?.topicId).toBeTruthy();
    expect(firstState.draft?.topicId).not.toBe(secondState.draft?.topicId);
    expect(firstState.topicRows).toHaveLength(1);
    expect(secondState.topicRows).toHaveLength(1);
    expect(firstState.topicRows[0].conversationId).toBe(conversationId);
    expect(secondState.topicRows[0].conversationId).toBe(anotherConversationId);
  });

  it("creates a placeholder after switching away from a previous draft conversation", async () => {
    const { store, topicService } = createTopicStore();
    topicService.getTopicListByOption.mockResolvedValueOnce({
      topicList: [
        {
          topicId: "topic-2",
          conversationId: anotherConversationId,
          topicName: "已有会话",
          createTime: Date.now() - 60_000,
          updateTime: Date.now() - 60_000,
          messageClientId: "root-client-2",
          messageServerId: "root-server-2",
          messageTime: Date.now() - 60_000,
        },
      ],
      hasMore: false,
      nextToken: "",
    });

    store.enterDraft(conversationId);
    store.discardDraft(conversationId);
    store.clearSelectedTopic(conversationId);

    await store.ensureAllTopicsLoaded(anotherConversationId);
    const beforeCount = store.getState(anotherConversationId).order.length;
    store.enterDraft(anotherConversationId);

    const state = store.getState(anotherConversationId);
    expect(state.selected.type).toBe("draft");
    expect(state.draft?.conversationId).toBe(anotherConversationId);
    expect(state.order).toHaveLength(beforeCount + 1);
    expect(state.topicRows[0].topicId).toBe(state.draft?.topicId);
    expect(state.topicRows[0].conversationId).toBe(anotherConversationId);
  });
});

describe("TopicStore topic summary", () => {
  it("loads topic item preview from local thread messages with inferred root refer", async () => {
    const { store, topicService, messageService } = createTopicStore();
    const topic = {
      topicId: "topic-1",
      conversationId,
      topicName: "topic",
      createTime: 1_000,
      updateTime: 1_000,
      messageClientId: "root-client-1",
      messageServerId: "root-server-1",
      messageTime: 1_000,
    };
    messageService.getLocalThreadMessageList.mockResolvedValueOnce({
      replyList: [
        {
          messageClientId: "reply-client-1",
          messageServerId: "reply-server-1",
          conversationId,
          senderId: "bot-1",
          receiverId: "me",
          createTime: 2_000,
          messageType: 0,
          text: "older reply",
          threadRoot: {
            messageClientId: "root-client-1",
            messageServerId: "root-server-1",
          },
        },
        {
          messageClientId: "root-client-1",
          messageServerId: "root-server-1",
          conversationId,
          senderId: "me",
          receiverId: "bot-1",
          createTime: 1_000,
          messageType: 0,
          text: "root",
          threadRoot: {
            messageClientId: "root-client-1",
            messageServerId: "root-server-1",
          },
        },
        {
          messageClientId: "reply-client-2",
          messageServerId: "reply-server-2",
          conversationId,
          senderId: "bot-1",
          receiverId: "me",
          createTime: 3_000,
          messageType: 0,
          text: "latest reply",
          threadRoot: {
            messageClientId: "root-client-1",
            messageServerId: "root-server-1",
          },
        },
      ],
    });

    const state = store.getState(conversationId);
    state.topics.set(topic.topicId, topic);
    state.order = [topic.topicId];

    await store.loadSummary(conversationId, topic);

    expect(topicService.getTopicMessageList).not.toHaveBeenCalled();
    expect(messageService.getLocalThreadMessageList).toHaveBeenCalledWith({
      senderId: "me",
      receiverId: "bot-1",
      conversationId,
      conversationType: 1,
      messageClientId: "root-client-1",
      messageServerId: "root-server-1",
      createTime: 1_000,
    });
    expect(state.summaries.get(topic.topicId)?.text).toBe("latest reply");
    expect(state.summaries.get(topic.topicId)?.time).toBe(3_000);
  });

  it("does not call local thread API when root refer cannot be completed", async () => {
    const { store, messageService, nim } = createTopicStore();
    nim.conversationIdUtil.parseConversationTargetId.mockReturnValueOnce("");
    const topic = {
      topicId: "topic-1",
      conversationId,
      topicName: "topic",
      createTime: 1_000,
      updateTime: 1_000,
      messageClientId: "root-client-1",
      messageServerId: "root-server-1",
      messageTime: 1_000,
    };

    await store.loadSummary(conversationId, topic);

    expect(messageService.getLocalThreadMessageList).not.toHaveBeenCalled();
  });
});
