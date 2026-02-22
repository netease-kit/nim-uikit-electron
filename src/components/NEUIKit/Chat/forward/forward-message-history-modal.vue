<template>
  <Modal
    :visible="visible"
    :title="title"
    :showDefaultFooter="false"
    :width="800"
    :height="680"
    :maskOpacity="0"
    @cancel="handleClose"
  >
    <div class="history-container">
      <div v-if="loading" class="loading-wrapper">
        <Loading />
      </div>
      <div v-else-if="msgs.length === 0" class="empty-wrapper">
        <Empty :text="t('noHistoryText')" />
      </div>
      <div v-else class="msg-list">
        <div v-for="(msg, index) in msgs" :key="msg.messageClientId" class="history-item">
          <MessageItem :msg="msg" :index="index" />
        </div>
      </div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, watch, computed } from "vue";
import Modal from "../../CommonComponents/Modal.vue";
import Loading from "../../CommonComponents/Loading.vue";
import Empty from "../../CommonComponents/Empty.vue";
import MessageItem from "../message/message-item.vue";
import { t } from "../../utils/i18n";
import { getContextState } from "../../utils/init";
import type { V2NIMMessageForUI } from "../../store/types";

const props = defineProps<{
  visible: boolean;
  msg: V2NIMMessageForUI;
}>();

const emit = defineEmits(["close"]);

const { store } = getContextState();
const msgs = ref<any[]>([]);
const loading = ref(false);

const title = computed(() => {
  let rawAttachment: any = props.msg.attachment;
  if (rawAttachment?.raw) rawAttachment = rawAttachment.raw;
  if (typeof rawAttachment === "string") {
    try {
      rawAttachment = JSON.parse(rawAttachment);
    } catch {}
  }
  const sessionName = rawAttachment?.name || rawAttachment?.sessionName || "";
  return sessionName ? `${sessionName} ${t("chatHistoryText")}` : t("chatHistoryText");
});

const handleClose = () => {
  emit("close");
};

watch(
  () => props.visible,
  async (val) => {
    if (val && props.msg) {
      loading.value = true;
      msgs.value = [];
      try {
        let rawAttachment: any = props.msg.attachment;
        if (rawAttachment?.raw) rawAttachment = rawAttachment.raw;
        if (typeof rawAttachment === "string") {
          try {
            rawAttachment = JSON.parse(rawAttachment);
          } catch {}
        }

        let url = rawAttachment?.url || rawAttachment?.data?.url;

        if (url) {
          const response = await fetch(url);
          const text = await response.text();
          if (store?.msgStore) {
            const parsedMsgs = store.msgStore.deserializeMergeMsgs(text);
            // 处理解析后的消息，确保它们有必要的属性用于显示
            msgs.value = parsedMsgs.map((m: any) => ({
              ...m,
              // 确保有 senderId, 即使是合并转发中的消息
              // 某些场景下合并转发内部消息可能缺少完整用户信息，这里可能需要补充
              // 如果 serverExtension 中有头像和昵称，也应该被 MessageItem 使用
            }));
          }
        }
      } catch (error) {
        console.error("Failed to load merge forward history:", error);
      } finally {
        loading.value = false;
      }
    }
  }
);
</script>

<style scoped>
.history-container {
  max-height: 600px;
  overflow-y: scroll;
  padding: 20px;
  background: #f6f8fa;
  border-radius: 8px;
}

.loading-wrapper,
.empty-wrapper {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.msg-list {
  display: flex;
  flex-direction: column;
}

.history-item {
  margin-bottom: 20px;
}
</style>
