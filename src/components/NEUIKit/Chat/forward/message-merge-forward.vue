<template>
  <div class="msg-merge-forward" @click.stop="historyModalVisible = true">
    <div class="msg-merge-forward-title">{{ title }}</div>
    <div class="msg-merge-forward-content">
      <div v-for="(item, index) in abstracts" :key="index" class="msg-merge-forward-item">
        <span class="sender">{{ item.senderNick }}: </span>
        <span class="text">{{ item.content }}</span>
      </div>
    </div>
    <div class="msg-merge-forward-footer">
      <span>{{ t('chatHistoryText') }}</span>
    </div>
  </div>

  <ForwardMessageHistoryModal 
    :visible="historyModalVisible" 
    :msg="props.msg" 
    @close="historyModalVisible = false"
  />
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { t } from '../../utils/i18n';
import type { V2NIMMessageForUI } from '../../store/types';
import ForwardMessageHistoryModal from '../forward/forward-message-history-modal.vue';

const props = defineProps<{
  msg: V2NIMMessageForUI;
}>();

const historyModalVisible = ref(false);

const data = computed(() => {
  const msg = props.msg;
  let rawAttachment: any = msg.attachment;

  // Handle case where attachment is wrapped or has a 'raw' property
  if (rawAttachment?.raw) {
    rawAttachment = rawAttachment.raw;
  }

  // Parse if string
  if (typeof rawAttachment === 'string') {
    try {
      rawAttachment = JSON.parse(rawAttachment);
    } catch {
      rawAttachment = {};
    }
  }

  // Check type 101 in attachment
  if (rawAttachment && rawAttachment.type === 101) {
    return rawAttachment.data || {};
  }

  // Check content (legacy/compatibility)
  let content: any = (msg as any).content;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      // ignore
    }
  }
  if (content && content.type === 101) {
    return content.data || {};
  }

  // Check text (fallback)
  let text: any = msg.text;
  if (typeof text === 'string') {
    try {
      text = JSON.parse(text);
    } catch {
      // ignore
    }
  }
  if (text && text.type === 101) {
    return text.data || {};
  }

  return {};
});

const title = computed(() => {
  const sessionName = data.value.sessionName || data.value.name || data.value.sessionId || data.value.to || '';
  if (!sessionName) {
    return t('chatHistoryText');
  }
  return t('messageOfText') ? `${sessionName} ${t('messageOfText')}` : `${sessionName} ${t('chatHistoryText')}`;
});

interface AbstractItem {
  senderNick: string;
  content: string;
  userAccId: string;
}

const abstracts = computed<AbstractItem[]>(() => {
  const list = data.value.abstracts || data.value.items || [];
  if (!Array.isArray(list)) return [];
  return list.map((item: any) => ({
    senderNick: item.senderNick || item.nick || item.fromNick || item.userAccId || item.from || 'Unknown',
    content: item.content || item.body || item.text || '[Message]',
    userAccId: item.userAccId || item.from || ''
  }));
});

</script>

<style scoped>
.msg-merge-forward {
  width: 260px;
  background-color: #fff;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #dee0e2;
  font-size: 14px;
  cursor: pointer;
}

.msg-merge-forward-title {
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-merge-forward-content {
  margin-bottom: 8px;
}

.msg-merge-forward-item {
  color: #666;
  font-size: 12px;
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-merge-forward-item .sender {
  color: #666;
}

.msg-merge-forward-footer {
  border-top: 1px solid #f0f0f0;
  padding-top: 8px;
  color: #999;
  font-size: 12px;
}
</style>
