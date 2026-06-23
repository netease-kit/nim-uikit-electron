<template>
  <div class="msg-merge-forward" @click.stop="historyModalVisible = true">
    <div class="msg-merge-forward-title">
      <span v-if="titleSuffix" class="title-name">{{ titleName }}</span>
      <span v-if="titleSuffix" class="title-suffix">&nbsp;{{ titleSuffix }}</span>
      <span v-else>{{ titleName }}</span>
    </div>
    <div class="msg-merge-forward-content" ref="contentRef">
      <div
        v-for="(item, index) in displayAbstracts"
        :key="index"
        v-show="shouldShow(index)"
        class="msg-merge-forward-item"
        :style="{ '-webkit-line-clamp': getMaxLines(index) }"
      >
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
import { computed, ref, watch, nextTick, onMounted } from 'vue';
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

const titleName = computed(() => {
  const sessionName = data.value.sessionName || data.value.name || data.value.sessionId || data.value.to || '';
  if (!sessionName) {
    return t('chatHistoryText');
  }
  return sessionName;
});

const titleSuffix = computed(() => {
  const sessionName = data.value.sessionName || data.value.name || data.value.sessionId || data.value.to || '';
  if (!sessionName) {
    return '';
  }
  return t('messageOfText') || t('chatHistoryText');
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

// 最多显示 3 条外露消息
const displayAbstracts = computed(() => abstracts.value.slice(0, 3));

const MAX_TOTAL_LINES = 3;
// 每条消息的实际分配行数
const lineClamps = ref<number[]>([]);
const contentRef = ref<HTMLElement | null>(null);
// 是否已完成首次测量
const measured = ref(false);

const recalcLineClamps = async () => {
  // 等待 DOM 渲染
  await nextTick();
  await nextTick();
  const container = contentRef.value;
  if (!container) return;

  const items = container.querySelectorAll('.msg-merge-forward-item') as NodeListOf<HTMLElement>;
  const total = items.length;
  if (total === 0) return;

  const newClamps: number[] = [];
  let remaining = MAX_TOTAL_LINES;

  for (let i = 0; i < total; i++) {
    const el = items[i];
    // 确保元素可见以便测量
    const prevDisplay = el.style.display;
    el.style.display = '';
    el.style.webkitLineClamp = 'unset';

    const computedStyle = getComputedStyle(el);
    const lineHeight = parseFloat(computedStyle.lineHeight) || (parseFloat(computedStyle.fontSize) * 1.6);
    const naturalLines = Math.max(1, Math.round(el.scrollHeight / lineHeight));

    // 分配行数：min(自然行数, 剩余行数)
    const allocated = Math.min(naturalLines, Math.max(0, remaining));
    newClamps.push(allocated);
    remaining -= allocated;

    // 恢复
    el.style.display = prevDisplay;
    el.style.webkitLineClamp = '';
  }

  lineClamps.value = newClamps;
  measured.value = true;
};

const getMaxLines = (index: number): number => {
  // 测量完成前，所有消息都可见（不限制行数），以便 DOM 能正确测量
  if (!measured.value) return MAX_TOTAL_LINES;
  return lineClamps.value[index] ?? 0;
};

// 是否显示该条消息
const shouldShow = (index: number): boolean => {
  if (!measured.value) return true; // 测量前全部可见
  return (lineClamps.value[index] ?? 0) > 0;
};

watch(displayAbstracts, () => {
  measured.value = false;
  lineClamps.value = [];
  recalcLineClamps();
}, { immediate: true });

onMounted(() => {
  recalcLineClamps();
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
  display: flex;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
  overflow: hidden;
  white-space: nowrap;
}

.title-name {
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
}

.title-suffix {
  flex-shrink: 0;
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
  display: -webkit-box;
  -webkit-box-orient: vertical;
  word-break: break-all;
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
