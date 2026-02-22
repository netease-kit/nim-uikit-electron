<template>
  <div>
    <Drawer
      v-model:visible="drawerVisible"
      placement="right"
      :width="360"
      :showDefaultFooter="false"
      :showHeader="true"
      :offsetRight="52"
      :offsetTop="96"
      :showMask="true"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    >
      <template #header>
        <div class="custom-header">
          <span class="header-title">{{ t("searchHistoryTitle") }}</span>
        </div>
      </template>
      <div class="chat-history-content">
        <!-- 搜索输入区域 -->
        <div class="search-section">
          <div class="search-input-wrapper">
            <Icon type="icon-sousuo" :size="16" color="#999" class="search-icon" />
            <input
              v-model="searchKeyword"
              type="text"
              :placeholder="t('searchHistoryPlaceholder')"
              class="search-input"
              @input="handleSearchInput"
              @keydown.enter="() => handleSearch()"
            />
            <span class="input-clear" v-if="searchKeyword" @mousedown.prevent @click="clearSearch">
              <svg
                fill-rule="evenodd"
                viewBox="64 64 896 896"
                focusable="false"
                data-icon="close-circle"
                width="1em"
                height="1em"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M512 64c247.4 0 448 200.6 448 448S759.4 960 512 960 64 759.4 64 512 264.6 64 512 64zm127.98 274.82h-.04l-.08.06L512 466.75 384.14 338.88c-.04-.05-.06-.06-.08-.06a.12.12 0 00-.07 0c-.03 0-.05.01-.09.05l-45.02 45.02a.2.2 0 00-.05.09.12.12 0 000 .07v.02a.27.27 0 00.06.06L466.75 512 338.88 639.86c-.05.04-.06.06-.06.08a.12.12 0 000 .07c0 .03.01.05.05.09l45.02 45.02a.2.2 0 00.09.05.12.12 0 00.07 0c.02 0 .04-.01.08-.05L512 557.25l127.86 127.87c.04.04.06.05.08.05a.12.12 0 00.07 0c.03 0 .05-.01.09-.05l45.02-45.02a.2.2 0 00.05-.09.12.12 0 000-.07v-.02a.27.27 0 00-.05-.06L557.25 512l127.87-127.86c.04-.04.05-.06.05-.08a.12.12 0 000-.07c0-.03-.01-.05-.05-.09l-45.02-45.02a.2.2 0 00-.09-.05.12.12 0 00-.07 0z"
                ></path>
              </svg>
            </span>
          </div>
        </div>

        <!-- 搜索结果区域 -->
        <div class="search-results" v-if="showSearchResults">
          <!-- 搜索状态 -->
          <div v-if="searchLoading" class="search-loading">
            <Icon type="icon-jiazai" :size="16" class="loading-icon" />
            <span>{{ t("searching") }}</span>
          </div>

          <!-- 搜索结果列表 -->
          <div v-if="!searchLoading && searchResults.length > 0" class="results-list">
            <!-- 结果计数头部 - 固定在顶部 -->
            <div class="results-header">
              {{ t("searchResultsCount", { count: searchResults.length }) }}
            </div>

            <div class="results-virtual-list">
              <RecycleScroller
                class="scroller"
                :items="displayItems"
                :item-size="80"
                :buffer="100"
                key-field="id"
                v-slot="{ item }"
                @scroll="handleScroll"
              >
                <!-- 搜索结果项 -->
                <SearchResultItem
                  v-if="item.type === 'result'"
                  :key="`${item.data.conversationId}-${item.data.messageClientId}`"
                  :message="item.data"
                  :keyword="currentSearchKeyword"
                  :conversationType="props.conversationType"
                  :to="props.to"
                  @click="handleResultClick(item.data)"
                />

                <!-- 加载更多指示器 -->
                <div v-else-if="item.type === 'loading'" class="loading-more-item">
                  <Icon type="icon-jiazai" :size="14" class="loading-icon" />
                  <span>{{ t("loadingMore") }}</span>
                </div>

                <!-- 没有更多数据提示 -->
                <div v-else-if="item.type === 'nomore'" class="no-more-data-item">
                  <span>{{ t("noMoreData") }}</span>
                </div>
              </RecycleScroller>
            </div>
          </div>

          <!-- 无结果 -->
          <div v-else-if="hasSearched" class="no-results">
            <span>{{ t("noSearchResults") }}</span>
          </div>
        </div>

        <!-- 默认内容（无搜索时） -->
        <div v-else class="default-content">
          <div class="search-tip">
            <span>{{ t("searchHistoryTip") }}</span>
          </div>
        </div>
      </div>
    </Drawer>
  </div>
</template>

<script lang="ts" setup>
/** 历史记录 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import { t } from "../../utils/i18n";
import { RecycleScroller } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

import Drawer from "../../CommonComponents/Drawer.vue";
import Icon from "../../CommonComponents/Icon.vue";

import type { V2NIMConversationType } from "node-nim";

import type { V2NIMMessageForUI } from "../../store/types";
import { toast } from "../../utils/toast";
import { getContextState } from "../../utils/init";
import { SEARCH_HISTORY_LIMIT } from "../../utils/constants";
import emitter from "../../utils/eventBus";
import SearchResultItem from "./search-result-item.vue";

interface Props {
  visible: boolean;
  to: string;
  conversationType: V2NIMConversationType;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

// 抽屉可见性
const drawerVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit("update:visible", value),
});

const { store } = getContextState();

if (!store) {
  throw new Error("Store not initialized");
}

// 搜索相关状态
const searchKeyword = ref("");
const searchInputTimer = ref<NodeJS.Timeout | null>(null);
const searchResults = ref<V2NIMMessageForUI[]>([]);
const searchLoading = ref(false);
const currentSearchKeyword = ref("");
const hasMoreResults = ref(true);
const loadingMore = ref(false);

// 跳转相关定时器 ID
let scrollTimer: NodeJS.Timeout | null = null;
let highlightTimer: NodeJS.Timeout | null = null;

// 搜索请求序列号，用于处理竞态条件
let searchRequestId = 0;

// 清理所有定时器
const clearAllTimers = () => {
  clearTimeout(searchInputTimer.value!);
  clearTimeout(scrollTimer!);
  clearTimeout(highlightTimer!);
  searchInputTimer.value = null;
  scrollTimer = null;
  highlightTimer = null;
};

// 显示搜索结果的条件
const showSearchResults = computed(() => {
  return searchKeyword.value.trim().length > 0;
});

// 是否已经搜索过
const hasSearched = computed(() => {
  return currentSearchKeyword.value.length > 0 && !searchLoading.value;
});

// 用于虚拟列表显示的项目数组
const displayItems = computed(() => {
  const items: Array<{ id: string; type: string; data?: V2NIMMessageForUI }> = [];

  // 添加搜索结果项
  searchResults.value.forEach((result, index) => {
    items.push({
      id: `result-${index}`,
      type: "result",
      data: result,
    });
  });

  // 添加底部状态项
  if (loadingMore.value) {
    items.push({
      id: "loading",
      type: "loading",
    });
  } else if (!hasMoreResults.value && searchResults.value.length > 0) {
    items.push({
      id: "nomore",
      type: "nomore",
    });
  }

  return items;
});

// 搜索处理函数
const handleSearchInput = () => {
  // 清除之前的定时器
  if (searchInputTimer.value) {
    clearTimeout(searchInputTimer.value);
  }

  // 设置新的定时器，防抖处理
  searchInputTimer.value = setTimeout(() => {
    handleSearch();
  }, 500);
};

const handleSearch = async (isLoadMore: boolean = false) => {
  const keyword = searchKeyword.value.trim();
  if (!keyword) {
    return;
  }

  // 递增请求ID，用于处理竞态条件
  const currentRequestId = ++searchRequestId;

  try {
    if (isLoadMore) {
      loadingMore.value = true;
    } else {
      searchLoading.value = true;
      currentSearchKeyword.value = keyword;
      searchResults.value = [];
      hasMoreResults.value = true;
    }

    // 计算搜索起始时间（用于分页）
    let searchStartTime = 0;
    if (isLoadMore && searchResults.value.length > 0) {
      // 获取最后一条消息的时间作为下一页的起始时间
      const lastMessage = searchResults.value[searchResults.value.length - 1];
      searchStartTime = lastMessage.createTime! - 1; // 减1毫秒确保不重复
    }

    const results = await store.msgStore.searchHistoryActive(
      keyword,
      store.uiStore.selectedConversation,
      SEARCH_HISTORY_LIMIT,
      searchStartTime
    );

    // 【关键】检查是否为最新的搜索请求，防止竞态条件导致旧结果覆盖新结果
    if (currentRequestId !== searchRequestId) {
      console.log(`忽略过期的搜索响应: requestId=${currentRequestId}, current=${searchRequestId}`);
      return;
    }

    if (isLoadMore) {
      // 追加到现有结果
      searchResults.value.push(...results);
    } else {
      // 新搜索，替换所有结果
      searchResults.value = results;
    }

    // 判断是否还有更多数据
    hasMoreResults.value = results.length === SEARCH_HISTORY_LIMIT;
  } catch (error) {
    // 同样需要检查请求是否过期
    if (currentRequestId !== searchRequestId) {
      return;
    }

    console.error("搜索失败:", error);
    toast.error(t("searchError"));
    if (!isLoadMore) {
      searchResults.value = [];
    }
    hasMoreResults.value = false;
    //@ts-ignore
    if (store.localOptions?.enableCloudSearch && error.code === 192003) {
      toast.error(t("offlineText"));
    }
  } finally {
    // 只有当这是最新请求时才更新loading状态
    if (currentRequestId === searchRequestId) {
      searchLoading.value = false;
      loadingMore.value = false;
    }
  }
};

const clearSearch = () => {
  searchKeyword.value = "";
  searchResults.value = [];
  currentSearchKeyword.value = "";
  hasMoreResults.value = true;
  loadingMore.value = false;

  if (searchInputTimer.value) {
    clearTimeout(searchInputTimer.value);
    searchInputTimer.value = null;
  }
};

const handleResultClick = async (message: V2NIMMessageForUI) => {
  try {
    if (!store) {
      throw new Error("Store not available");
    }

    // 清理之前的定时器
    clearAllTimers();

    // 1. 关闭历史搜索抽屉
    emit("update:visible", false);

    // 2. 跳转到对应会话
    await store.uiStore.selectConversation(message.conversationId!);

    // 3. 跳转到指定消息并加载上下文
    await store.msgStore.jumpToMessageActive(message, message.conversationId!, 15);

    // 4. 等待DOM更新后滚动到目标消息
    scrollTimer = setTimeout(() => {
      if (message.messageClientId) {
        const targetElementId = `message-item-${message.messageClientId}`;
        const targetElement = document.getElementById(targetElementId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });

          // 滚动完成后触发高亮事件
          highlightTimer = setTimeout(() => {
            emitter.emit("highlightMessage", {
              messageId: message.messageClientId,
              duration: 800,
            });
          }, 500); // 等待滚动动画完成
        } else {
          // 如果找不到元素，直接触发高亮事件
          emitter.emit("highlightMessage", { messageId: message.messageClientId, duration: 800 });
        }
      }
    }, 200); // 等待消息列表渲染完成

    // 5. 清空搜索结果
    clearSearch();
  } catch (error) {
    console.error("Jump to message failed:", error);
    toast.error(t("jumpToMessageError"));
  }
};

// 滚动处理函数
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  const scrollTop = target.scrollTop;
  const scrollHeight = target.scrollHeight;
  const clientHeight = target.clientHeight;

  // 距离底部小于50px时加载更多
  const threshold = 50;
  const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold;

  if (isNearBottom && hasMoreResults.value && !loadingMore.value && !searchLoading.value) {
    handleSearch(true); // 加载更多
  }
};

// 生命周期
onMounted(() => {
  // 清空之前的搜索状态
  clearSearch();
});

onUnmounted(() => {
  // 清理所有定时器
  clearAllTimers();
  // 清空搜索状态
  clearSearch();
});

const handleConfirm = () => {};

const handleCancel = () => {};
</script>

<style scoped>
.custom-header {
  display: flex;
  align-items: center;
  width: 100%;
  cursor: pointer;
}

.header-title {
  font-size: 16px;
  font-weight: bolder;
  color: #333;
  margin-left: 5px;
}

.chat-history-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
}

/* 搜索输入区域 */
.search-section {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: #f8f8f8;
  border-radius: 8px;
  padding: 8px 12px;
  height: 32px;
  margin-bottom: 12px;
  box-sizing: border-box;
}

.search-icon {
  margin-right: 8px;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: #333;
  box-sizing: border-box;
}

.search-input::placeholder {
  color: #999;
}

.clear-icon {
  margin-left: 8px;
  cursor: pointer;
}

.clear-icon:hover {
  color: #666 !important;
}

/* 搜索结果区域 */
.search-results {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.search-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: #999;
  font-size: 14px;
}

.loading-icon {
  margin-right: 8px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.results-list {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.results-header {
  padding: 12px 16px;
  background: #f8f8f8;
  color: #666;
  font-size: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
  color: #999;
  font-size: 14px;
  text-align: center;
}

.no-results span {
  margin-top: 12px;
}

/* 默认内容 */
.default-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.search-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #ccc;
  font-size: 14px;
  text-align: center;
}

.search-tip span {
  margin-top: 12px;
}

/* 虚拟列表样式 */
.results-virtual-list {
  flex: 1;
  height: 0; /* 让 flex: 1 生效 */
}

.results-virtual-list .scroller {
  width: 100%;
  height: 100%;
}

/* 加载更多和结束提示样式 */
.loading-more,
.no-more-data {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  color: #999;
  font-size: 12px;
  background: #fafafa;
}

.loading-more .loading-icon {
  margin-right: 6px;
  animation: spin 1s linear infinite;
}

/* 虚拟列表内部项目样式 */
.loading-more-item,
.no-more-data-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  padding: 12px 16px;
  color: #999;
  font-size: 12px;
  background: #fafafa;
}

.loading-more-item .loading-icon {
  margin-right: 6px;
  animation: spin 1s linear infinite;
}

.input-clear {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 14px;
  border-radius: 50%;
  text-align: center;
}
</style>
