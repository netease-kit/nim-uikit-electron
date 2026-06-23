<template>
  <aside class="topic-column">
    <div class="topic-column__header">
      <div class="topic-column__title">{{ title }}</div>
      <div class="topic-column__actions">
        <button class="topic-column__icon-btn" type="button" @click="handleCreate">
          +
        </button>
      </div>
    </div>

    <div class="topic-column__search">
      <Icon class="topic-column__search-icon" type="icon-sousuo" :size="12" />
      <input v-model="keyword" class="topic-column__search-input" :placeholder="searchPlaceholder" />
      <button v-if="keyword" class="topic-column__clear" type="button" @click="keyword = ''">x</button>
    </div>

    <div ref="bodyRef" class="topic-column__body" @scroll="handleScroll">
      <button v-if="hasError && !displayRows.length" class="topic-column__state topic-column__retry" type="button" @click="reload">
        {{ retryText }}
      </button>
      <div v-else-if="!displayRows.length" class="topic-column__state">
        {{ loading ? loadingText : keyword ? noSearchResultText : emptyText }}
      </div>
      <template v-else>
        <Dropdown v-for="row in displayRows" :key="row.topicId" trigger="contextmenu">
          <button
            class="topic-row"
            :class="{ 'topic-row--active': selectedTopicId === row.topicId }"
            type="button"
            @click="selectTopic(row.topicId)"
          >
            <span class="topic-row__dot" :class="`topic-row__dot--${row.colorIndex}`"></span>
            <span class="topic-row__content">
              <span class="topic-row__line">
                <span class="topic-row__title" v-html="highlight(row.title)"></span>
                <span class="topic-row__time">{{ row.timeText }}</span>
              </span>
              <span class="topic-row__line topic-row__line--summary">
                <MessageOneLine class="topic-row__summary" :text="row.summary.text" />
                <span v-if="row.hasUnread" class="topic-row__unread"></span>
              </span>
            </span>
          </button>
          <template #overlay>
            <div class="topic-dropdown-menu">
              <div class="topic-dropdown-item" @click="openRenameModal(row)">
                <Icon type="icon-shezhi1" :size="13" />
                <span>{{ t("topicSubsessionRenameText") }}</span>
              </div>
              <div class="topic-dropdown-item" @click="openDeleteModal(row)">
                <Icon type="icon-delete" :size="13" />
                <span>{{ t("deleteSessionText") }}</span>
              </div>
            </div>
          </template>
        </Dropdown>
      </template>
    </div>
    <Modal
      v-if="renameModalVisible"
      :visible="renameModalVisible"
      :title="t('topicSubsessionRenameText')"
      :confirmText="t('confirmText')"
      :cancelText="t('cancelText')"
      :confirmDisabled="!renameValue.trim()"
      width="360"
      @confirm="confirmRename"
      @cancel="closeRenameModal"
      @close="closeRenameModal"
    >
      <div class="topic-rename-modal">
        <Input
          :modelValue="renameValue"
          :placeholder="t('topicSubsessionRenamePlaceholder')"
          :maxlength="TOPIC_RENAME_MAX_LENGTH"
          :showClear="true"
          :focus="true"
          :inputWrapperStyle="renameInputWrapperStyle"
          :inputStyle="renameInputStyle"
          @update:modelValue="handleRenameValueUpdate"
          @input="handleRenameInput"
        />
      </div>
    </Modal>
    <Modal
      v-if="deleteModalVisible"
      :visible="deleteModalVisible"
      :title="t('deleteSessionText')"
      :confirmText="t('deleteText')"
      :cancelText="t('cancelText')"
      :confirmDisabled="deleteLoading"
      width="360"
      @confirm="confirmDelete"
      @cancel="closeDeleteModal"
      @close="closeDeleteModal"
    >
      <div class="topic-delete-modal">
        <p>{{ t("topicSubsessionDeleteConfirmText") }}</p>
      </div>
    </Modal>
  </aside>
</template>

<script lang="ts" setup>
import { autorun } from "mobx";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { getContextState } from "../../utils/init";
import { t } from "../../utils/i18n";
import { toast } from "../../utils/toast";
import { V2NIMConst } from "../../utils/constants";
import Icon from "../../CommonComponents/Icon.vue";
import Dropdown from "../../CommonComponents/Dropdown.vue";
import MessageOneLine from "../../CommonComponents/MessageOneLine.vue";
import Modal from "../../CommonComponents/Modal.vue";
import Input from "../../CommonComponents/Input.vue";
import type { TopicConversationState, TopicRowForUI } from "../../store/types";

const props = defineProps<{
  conversationId: string;
}>();

const { nim, store } = getContextState();
const keyword = ref("");
const rows = ref<TopicRowForUI[]>([]);
const displayRows = ref<TopicRowForUI[]>([]);
const state = ref<TopicConversationState>();
const loading = ref(false);
const hasError = ref(false);
const selectedTopicId = ref("");
const title = ref(t("topicSubsessionTitle"));
const renameModalVisible = ref(false);
const renameTopicId = ref("");
const renameValue = ref("");
const deleteModalVisible = ref(false);
const deleteTopicId = ref("");
const deleteLoading = ref(false);
const bodyRef = ref<HTMLElement>();

const searchPlaceholder = computed(() => t("topicSubsessionSearchPlaceholder"));
const loadingText = computed(() => t("loadingText"));
const retryText = computed(() => t("topicSubsessionLoadFailed"));
const emptyText = computed(() => t("topicSubsessionEmptyText"));
const noSearchResultText = computed(() => t("topicSubsessionNoSearchResult"));
const renameInputWrapperStyle = {
  height: "36px",
  backgroundColor: "#fff",
  border: "1px solid #d9dee8",
  borderRadius: "4px",
};
const renameInputStyle = {
  height: "34px",
  backgroundColor: "#fff",
  padding: "0 30px 0 10px",
};
let lastCreateAt = 0;
let visibleSummaryTimer: ReturnType<typeof setTimeout> | undefined;
const SCROLL_BOTTOM_THRESHOLD = 50;
const TOPIC_ROW_HEIGHT = 58;
const VISIBLE_SUMMARY_BUFFER = 5;
const TOPIC_RENAME_MAX_LENGTH = 20;

const getConversationTitle = (conversationId: string): string => {
  const conversation = store?.localOptions.enableCloudConversation
    ? store?.conversationStore?.conversations.get(conversationId)
    : store?.localConversationStore?.conversations.get(conversationId);
  if (conversation?.name) {
    return conversation.name;
  }

  const conversationType = nim?.conversationIdUtil?.parseConversationType(conversationId);
  const targetId = nim?.conversationIdUtil?.parseConversationTargetId(conversationId) || "";
  if (
    conversationType === V2NIMConst.V2NIMConversationType.V2NIM_CONVERSATION_TYPE_P2P &&
    targetId
  ) {
    return store?.uiStore.getAppellation({ account: targetId }) || targetId;
  }

  return conversationId || t("topicSubsessionTitle");
};

const getTopicColumnTitle = (conversationId: string): string => {
  return `${getConversationTitle(conversationId)} · ${t("topicSubsessionTag")}`;
};

const normalizeSearchText = (value?: string): string => {
  return (value || "").trim().toLowerCase();
};

const syncDisplayRows = () => {
  const value = normalizeSearchText(keyword.value);
  if (!value) {
    displayRows.value = rows.value;
    scheduleVisibleSummaryLoad();
    return;
  }

  displayRows.value = rows.value.filter((row) => normalizeSearchText(row.title).includes(value));
  scheduleVisibleSummaryLoad();
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlight = (value: string) => {
  const safeValue = escapeHtml(value);
  const search = keyword.value.trim();
  if (!search) {
    return safeValue;
  }

  return safeValue.replace(
    new RegExp(escapeRegExp(escapeHtml(search)), "gi"),
    (match) => `<span class="topic-row__highlight">${match}</span>`
  );
};

const reload = async () => {
  if (props.conversationId) {
    await store?.topicStore.loadFirstPage(props.conversationId);
    scheduleVisibleSummaryLoad();
  }
};

const getVisibleTopicIds = () => {
  const target = bodyRef.value;
  if (!target || !displayRows.value.length) {
    return [];
  }

  const startIndex = Math.max(
    0,
    Math.floor(target.scrollTop / TOPIC_ROW_HEIGHT) - VISIBLE_SUMMARY_BUFFER
  );
  const visibleCount = Math.ceil(target.clientHeight / TOPIC_ROW_HEIGHT) + VISIBLE_SUMMARY_BUFFER * 2;
  return displayRows.value.slice(startIndex, startIndex + visibleCount).map((row) => row.topicId);
};

const loadVisibleSummaries = () => {
  if (!props.conversationId) {
    return;
  }

  const topicIds = getVisibleTopicIds();
  if (!topicIds.length) {
    return;
  }

  store?.topicStore.loadSummariesForTopics(props.conversationId, topicIds).catch((error) => {
    store?.logger?.error("load visible topic summaries failed", {
      conversationId: props.conversationId,
      error,
    });
  });
};

const scheduleVisibleSummaryLoad = () => {
  if (visibleSummaryTimer) {
    clearTimeout(visibleSummaryTimer);
  }
  visibleSummaryTimer = setTimeout(loadVisibleSummaries, SCROLL_BOTTOM_THRESHOLD);
};

const handleScroll = () => {
  scheduleVisibleSummaryLoad();
};

const handleCreate = () => {
  const now = Date.now();
  if (now - lastCreateAt < 500) {
    return;
  }
  lastCreateAt = now;

  if (
    store?.connectStore.connectStatus !==
    V2NIMConst.V2NIMConnectStatus.V2NIM_CONNECT_STATUS_DISCONNECTED
  ) {
    store?.topicStore.enterDraft(props.conversationId);
  } else {
    toast.error(t("topicSubsessionOfflineCreateTip"));
  }
};

const selectTopic = (topicId: string) => {
  store?.topicStore.selectTopic(props.conversationId, topicId);
};

const openDeleteModal = (row: TopicRowForUI) => {
  deleteTopicId.value = row.topicId;
  deleteModalVisible.value = true;
};

const closeDeleteModal = () => {
  if (deleteLoading.value) {
    return;
  }

  deleteModalVisible.value = false;
  deleteTopicId.value = "";
};

const confirmDelete = async () => {
  const topicId = deleteTopicId.value;
  if (!topicId) {
    return;
  }

  deleteLoading.value = true;
  try {
    await store?.topicStore.removeTopic(props.conversationId, topicId);
    deleteModalVisible.value = false;
    deleteTopicId.value = "";
  } catch (error) {
    store?.logger?.error("remove topic failed", {
      conversationId: props.conversationId,
      topicId,
      error,
    });
    toast.error(t("deleteMsgFailText"));
  } finally {
    deleteLoading.value = false;
  }
};

const openRenameModal = (row: TopicRowForUI) => {
  renameTopicId.value = row.topicId;
  renameValue.value = row.title;
  renameModalVisible.value = true;
};

const closeRenameModal = () => {
  renameModalVisible.value = false;
  renameTopicId.value = "";
  renameValue.value = "";
};

const handleRenameInput = (event: { target: { value: string } }) => {
  renameValue.value = event.target.value;
};

const handleRenameValueUpdate = (value: string | number) => {
  renameValue.value = String(value);
};

const confirmRename = async () => {
  const nextName = renameValue.value.trim().slice(0, TOPIC_RENAME_MAX_LENGTH);
  if (!nextName || !renameTopicId.value) {
    return;
  }

  try {
    await store?.topicStore.updateTopicName(props.conversationId, renameTopicId.value, nextName);
    closeRenameModal();
  } catch (error) {
    store?.logger?.error("rename topic failed", {
      conversationId: props.conversationId,
      topicId: renameTopicId.value,
      error,
    });
    toast.error(t("topicSubsessionRenameFailed"));
  }
};

let dispose = () => {};
let loadingConversationId = "";

const resetTopicColumnState = () => {
  if (visibleSummaryTimer) {
    clearTimeout(visibleSummaryTimer);
    visibleSummaryTimer = undefined;
  }

  rows.value = [];
  displayRows.value = [];
  state.value = undefined;
  loading.value = false;
  hasError.value = false;
  selectedTopicId.value = "";
  title.value = t("topicSubsessionTitle");
  loadingConversationId = "";
};

function syncTopicColumnState(conversationId = props.conversationId) {
  if (!conversationId || conversationId !== props.conversationId) {
    resetTopicColumnState();
    return;
  }

  const currentState = store?.topicStore.getState(conversationId);
  const nextRows = currentState?.topicRows || [];
  const selected = currentState?.selected;
  title.value = getTopicColumnTitle(conversationId);
  state.value = currentState;
  loading.value = !!currentState?.loading;
  hasError.value = !!currentState?.error;
  selectedTopicId.value =
    selected?.type === "topic" || selected?.type === "draft" ? selected.topicId || "" : "";
  rows.value = nextRows.slice();
  syncDisplayRows();
}

const restartTopicColumnSync = (conversationId: string) => {
  dispose();
  dispose = () => {};
  if (!conversationId) {
    return;
  }

  dispose = autorun(() => {
    syncTopicColumnState(conversationId);
  });
};

const ensureTopicListLoaded = (conversationId: string) => {
  if (!conversationId || loadingConversationId === conversationId) {
    return;
  }

  const topicStore = store?.topicStore;
  if (!topicStore) {
    return;
  }

  const currentState = topicStore.getState(conversationId);
  if (currentState?.loaded) {
    return;
  }

  loadingConversationId = conversationId;
  topicStore
    .ensureAllTopicsLoaded(conversationId)
    .catch((error) => {
      store?.logger?.error("TopicSubsessionColumn load topics failed", {
        conversationId,
        error,
      });
    })
    .finally(() => {
      if (loadingConversationId === conversationId) {
        loadingConversationId = "";
      }
      if (props.conversationId === conversationId) {
        syncTopicColumnState();
      }
    });
};

watch(
  () => props.conversationId,
  (conversationId) => {
    keyword.value = "";
    resetTopicColumnState();
    restartTopicColumnSync(conversationId);
    ensureTopicListLoaded(conversationId);
  },
  { flush: "sync", immediate: true }
);

onMounted(() => {
  store?.logger?.log("TopicSubsessionColumn mounted", {
    conversationId: props.conversationId,
  });

  ensureTopicListLoaded(props.conversationId);
});

watch(keyword, syncDisplayRows);

onUnmounted(() => {
  if (visibleSummaryTimer) {
    clearTimeout(visibleSummaryTimer);
  }
  dispose();
});
</script>

<style scoped>
.topic-column {
  width: 240px;
  min-width: 240px;
  height: 100%;
  border-right: 1px solid #ebedf0;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.topic-column__header {
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.topic-column__title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
}

.topic-column__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topic-column__icon-btn {
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #9aa3af;
  font-size: 26px;
  font-weight: 300;
  line-height: 1;
  box-shadow: none;
  transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
}

.topic-column__icon-btn:hover {
  border-color: transparent;
  background: #f0f2f5;
  box-shadow: none;
}

.topic-column__icon-btn:active {
  background: #e8ebef;
  box-shadow: none;
}

.topic-column__search {
  position: relative;
  padding: 0 12px 8px;
}

.topic-column__search-icon {
  position: absolute;
  left: 20px;
  top: 7px;
  color: #8c8c8c;
  pointer-events: none;
}

.topic-column__search-input {
  width: 100%;
  height: 26px;
  border: none;
  border-radius: 4px;
  padding: 0 28px 0 28px;
  box-sizing: border-box;
  outline: none;
  background: #f7f8fa;
  color: #262626;
  font-size: 12px;
}

.topic-column__clear {
  position: absolute;
  right: 18px;
  top: 3px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #86909c;
}

.topic-column__body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.topic-column__state {
  padding: 32px 16px;
  color: #86909c;
  font-size: 14px;
  text-align: center;
}

.topic-column__retry {
  width: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
}

.topic-row {
  width: 100%;
  min-height: 58px;
  border: none;
  background: transparent;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  box-sizing: border-box;
  cursor: pointer;
  text-align: left;
}

.topic-row:hover {
  background: #f0f2f5;
}

.topic-row--active {
  background: #e8f0ff;
}

.topic-row__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 8px;
  margin-top: 6px;
}

.topic-row__dot--0 { background: #337eff; }
.topic-row__dot--1 { background: #00a870; }
.topic-row__dot--2 { background: #ff7d00; }
.topic-row__dot--3 { background: #f53f3f; }
.topic-row__dot--4 { background: #722ed1; }
.topic-row__dot--5 { background: #14c9c9; }
.topic-row__dot--6 { background: #f7ba1e; }

.topic-row__content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.topic-row__line {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.topic-row__line--summary {
  justify-content: space-between;
  gap: 6px;
  margin-top: 2px;
}

.topic-row__title,
.topic-row__summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-row__title {
  flex: 1;
  min-width: 0;
  color: #262626;
  font-size: 13px;
  font-weight: 500;
}

.topic-row__summary {
  flex: 1;
  min-width: 0;
  color: #8c8c8c;
  font-size: 12px;
}

.topic-row__time {
  color: #8c8c8c;
  font-size: 11px;
  flex: 0 0 auto;
}

.topic-row__unread {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f53f3f;
  flex: 0 0 8px;
}

.topic-dropdown-menu {
  min-width: 132px;
}

.topic-dropdown-item {
  height: 32px;
  padding: 5px 12px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  color: rgba(0, 0, 0, 0.85);
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}

.topic-dropdown-item span {
  margin-left: 5px;
  font-size: 14px;
}

:deep(.topic-dropdown-item .icon) {
  filter: grayscale(1);
  opacity: 0.72;
}

.topic-dropdown-item:hover {
  background: #f5f5f5;
}

.topic-rename-modal {
  width: 100%;
  padding: 4px 0 2px;
}

.topic-delete-modal {
  width: 100%;
  padding: 4px 0 2px;
  color: #1f2329;
  font-size: 14px;
  line-height: 22px;
}

.topic-delete-modal p {
  margin: 0;
}

:deep(.topic-row__highlight) {
  color: #337eff;
}
</style>
