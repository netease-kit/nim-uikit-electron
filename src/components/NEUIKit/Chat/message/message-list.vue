<template>
  <div class="msg-list-wrapper">
    <div
      id="message-scroll-list"
      scroll-y="true"
      :scroll-top="scrollTop"
      class="message-scroll-list"
      ref="messageListRef"
    >
      <div v-show="loadingMore" class="msg-tip">
        {{ t("loadingText") }}
      </div>
      <div class="msg-tip" v-show="noMore">{{ t("noMoreText") }}</div>
      <div v-for="(item, index) in msgs" :key="item.messageClientId">
        <MessageItem
          :msg="item"
          :index="index"
          :key="item.messageClientId"
          :reply-msgs-map="replyMsgsMap"
        >
        </MessageItem>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
/** 消息列表 */
import { ref, onBeforeMount, onUnmounted, nextTick, onMounted, watch } from "vue";
import MessageItem from "./message-item.vue";
import emitter from "../../utils/eventBus";

import { t } from "../../utils/i18n";
import { V2NIMConst } from "../../utils/constants";
import { autorun } from "mobx";
import { events } from "../../utils/constants";
import type { V2NIMMessageForUI } from "../../store/types";
import { getContextState } from "../../utils/init";
import { V2NIMConversationType } from "node-nim";
const props = withDefaults(
  defineProps<{
    msgs: V2NIMMessageForUI[];
    conversationType: V2NIMConversationType;
    to: string;
    loadingMore?: boolean;
    noMore?: boolean;
    replyMsgsMap?: {
      [key: string]: V2NIMMessageForUI;
    };
  }>(),
  {}
);

const { store } = getContextState();

const messageListRef = ref<HTMLElement | null>(null);
let teamWatch = () => {};

onBeforeMount(() => {
  teamWatch = autorun(() => {
    store?.teamStore.teams.get(props.to);
  });
});

const scrollTop = ref(0);
const loadingMoreMessages = ref(false);

// 消息滑动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
    }
  });
};

// 防抖定时器
let scrollTimer: NodeJS.Timeout | number | null = null;

// 处理滚动事件，实现向上滚动加载更多和检测滚动到底部
const handleScroll = () => {
  if (!messageListRef.value) {
    console.log("handleScroll: messageListRef.value 为空");
    return;
  }

  // 防抖处理，避免频繁触发
  if (scrollTimer) {
    clearTimeout(scrollTimer);
  }

  scrollTimer = setTimeout(() => {
    if (!messageListRef.value) return;

    const scrollTop = messageListRef.value.scrollTop;
    const scrollHeight = messageListRef.value.scrollHeight;
    const clientHeight = messageListRef.value.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // 添加调试日志
    console.log("滚动事件触发:", {
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceFromBottom,
      loadingMoreMessages: loadingMoreMessages.value,
      msgsLength: props.msgs.length,
      isJumpedToMessage: store?.uiStore.isJumpedToMessage,
    });

    // 如果滚动到顶部附近且不在加载中，则加载更多历史消息
    if (scrollTop <= 50 && !loadingMoreMessages.value && props.msgs.length > 0) {
      console.log("滚动到顶部，准备加载历史消息");
      loadMoreMessages();
    }

    // 如果滚动到底部附近且不在加载中，则加载更多新消息（仅在跳转状态下）
    if (distanceFromBottom <= 50 && !loadingMoreMessages.value && props.msgs.length > 0) {
      const lastMsg = props.msgs[props.msgs.length - 1];
      const isJumpedState = store?.uiStore.isJumpedToMessage;
      console.log("检查跳转状态:", {
        isJumpedState,
        distanceFromBottom,
        loadingMoreMessages: loadingMoreMessages.value,
        hasMessages: props.msgs.length > 0,
        hasLastMsg: !!lastMsg,
      });
      if (lastMsg && isJumpedState) {
        // 仅在跳转状态下才发送 GET_NEXT_MSG 事件
        console.log("在跳转状态下，发送 GET_NEXT_MSG 事件，加载新消息");
        loadingMoreMessages.value = true;
        emitter.emit(events.GET_NEXT_MSG, lastMsg);
      } else if (lastMsg && !isJumpedState) {
        console.log("不在跳转状态，不加载新消息");
      }
    }

    // 精确检测是否在底部（用于隐藏新消息提醒）
    if (distanceFromBottom === 0) {
      console.log("精确底部检测触发，隐藏新消息提醒");
      emitter.emit(events.ON_SCROLL_BOTTOM);
    }
  }, 100); // 防抖延迟100ms
};

// 加载更多消息
const loadMoreMessages = () => {
  if (!messageListRef.value) return;

  // 记录加载前的滚动状态
  const previousScrollHeight = messageListRef.value.scrollHeight;
  const previousScrollTop = messageListRef.value.scrollTop;
  const previousMsgCount = props.msgs.length;

  const msg = props.msgs.filter(
    (item) =>
      !(
        item.messageType === V2NIMConst.V2NIMMessageType.V2NIM_MESSAGE_TYPE_CUSTOM &&
        ["beReCallMsg", "reCallMsg"].includes(item.recallType || "")
      )
  )[0];

  if (msg) {
    emitter.emit(events.GET_HISTORY_MSG, msg);

    // 监听消息数据变化，恢复滚动位置
    const unwatch = watch(
      () => props.msgs.length,
      (newLength) => {
        if (newLength > previousMsgCount && messageListRef.value) {
          nextTick(() => {
            if (messageListRef.value) {
              const newScrollHeight = messageListRef.value.scrollHeight;
              const heightDifference = newScrollHeight - previousScrollHeight;

              // 计算目标位置：保持原来的消息位置，然后向上偏移
              const targetScrollTop = previousScrollTop + heightDifference - 1;
              const finalScrollTop = Math.max(0, targetScrollTop);

              // 直接滚动到目标位置
              messageListRef.value.scrollTo({
                top: finalScrollTop,
                behavior: "instant",
              });

              // 取消监听
              unwatch();
            }
          });
        }
      }
    );
  }
};

// 获取MessageList的高度和滚动信息
const getScrollInfo = () => {
  if (!messageListRef.value) {
    return {
      height: 0,
      scrollTop: 0,
      scrollHeight: 0,
      clientHeight: 0,
      distanceFromBottom: 0,
    };
  }

  const element = messageListRef.value;
  const scrollTop = element.scrollTop;
  const scrollHeight = element.scrollHeight;
  const clientHeight = element.clientHeight;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

  return {
    height: clientHeight,
    scrollTop,
    scrollHeight,
    clientHeight,
    distanceFromBottom,
  };
};

// 暴露方法给父组件
defineExpose({
  getScrollInfo,
  scrollToBottom,
  messageListRef,
});

// 重置加载状态
const resetLoadingMoreMessages = () => {
  console.log("🔄 收到 RESET_LOADING_MORE_MESSAGES 事件，重置 loadingMoreMessages 为 false");
  loadingMoreMessages.value = false;
};

onMounted(() => {
  // 监听滚动到底部
  emitter.on(events.ON_SCROLL_BOTTOM, scrollToBottom);

  // 监听加载完成事件 - 修复事件名称
  emitter.on(events.RESET_LOADING_MORE_MESSAGES, resetLoadingMoreMessages);

  // 添加滚动监听器，实现向上滚动加载更多
  nextTick(() => {
    if (messageListRef.value) {
      console.log("添加滚动监听器到:", messageListRef.value);
      messageListRef.value.addEventListener("scroll", handleScroll);

      // 测试初始状态
      const scrollInfo = {
        scrollTop: messageListRef.value.scrollTop,
        scrollHeight: messageListRef.value.scrollHeight,
        clientHeight: messageListRef.value.clientHeight,
      };
      console.log("初始滚动状态:", scrollInfo);
    } else {
      console.log("messageListRef.value 为空，无法添加滚动监听器");
    }
  });
});

onUnmounted(() => {
  emitter.off(events.ON_SCROLL_BOTTOM, scrollToBottom);
  emitter.off(events.AUDIO_URL_CHANGE);

  // 清理加载完成事件监听器
  emitter.off(events.RESET_LOADING_MORE_MESSAGES, resetLoadingMoreMessages);

  teamWatch();

  // 清理滚动事件监听器
  if (messageListRef.value) {
    messageListRef.value.removeEventListener("scroll", handleScroll);
  }

  // 清理防抖定时器
  if (scrollTimer) {
    clearTimeout(scrollTimer);
    scrollTimer = null;
  }
});
</script>

<style scoped>
.msg-list-wrapper {
  flex: 1;
  overflow: hidden;
  display: flex;
  height: 100%;
  box-sizing: border-box;
  padding: 0px 0px 5px 0px;
  background: #f6f8fa;
}

.msg-tip {
  text-align: center;
  color: #b3b7bc;
  font-size: 14px;
  margin-top: 10px;
  width: 100%;
}

.block {
  width: 100%;
  height: 40px;
}

.message-scroll-list {
  height: 100%;
  box-sizing: border-box;
  padding: 0 15px 10px 10px;
  overflow-y: auto;
  width: 100%;
  overflow-x: hidden;
  overscroll-behavior: contain;
  overflow-anchor: none;
}

.message-scroll-list {
  /* 设置滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.loading-more-text {
  text-align: center;
  color: #b3b7bc;
  font-size: 14px;
  margin-top: 10px;
  margin-bottom: 10px;
  padding: 8px 0;
}
</style>
