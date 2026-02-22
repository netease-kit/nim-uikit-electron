/**
 * 跳转状态处理工具函数
 */
import emitter from "./eventBus";
import { events } from "./constants";
import { getContextState } from "./init";

/**
 * 处理跳转状态下的消息发送前准备
 * @param conversationId 会话ID
 * @param logPrefix 日志前缀，用于调试
 */
export async function handleJumpStateBeforeSend(
  conversationId?: string,
  logPrefix = "消息发送"
): Promise<void> {
  const { store } = getContextState();

  // 如果不在跳转状态，直接返回
  if (!store?.uiStore.isJumpedToMessage) {
    return;
  }

  console.log(`${logPrefix}: 检测到跳转状态，准备重置状态并加载最新消息`);

  // 退出跳转状态
  store.uiStore.setJumpedToMessage(false);

  if (conversationId) {
    // 清空当前会话的消息缓存
    store?.msgStore.msgs.delete(conversationId);

    // 通过事件总线通知主组件重新加载最新消息
    // 注意：getHistory(0) 是异步的，会等待网络请求完成并自动更新store
    emitter.emit(events.RELOAD_LATEST_MESSAGES);

    // 给一个小的延迟确保事件处理完成
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log(`${logPrefix}: 状态重置完成，可以继续发送消息`);
}
