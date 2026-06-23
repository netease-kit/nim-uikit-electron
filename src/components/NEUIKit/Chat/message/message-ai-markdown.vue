<template>
  <div
    class="ai-markdown-container"
    @click="handleMarkdownClick"
  >
    <div
      v-if="renderFailed"
      class="ai-markdown-fallback"
    >
      {{ messageText }}
    </div>
    <MarkdownRender
      v-else
      :content="messageText"
      :final="true"
      :is-dark="false"
      :max-live-nodes="0"
      :parse-options="parseOptions"
      :render-code-blocks-as-pre="true"
      :show-tooltips="false"
      class="ai-markdown-content"
    />
  </div>
</template>

<script lang="ts" setup>
/** AI/机器人回复 markdown 消息 */
import { computed, onErrorCaptured, ref } from "vue";
import MarkdownRender from "markstream-vue";
import "markstream-vue/index.css";
import type { ParseOptions } from "markstream-vue";
import type { V2NIMMessageForUI } from "../../store/types";

const props = defineProps<{
  msg: V2NIMMessageForUI;
}>();

const messageText = computed(() => props.msg?.text || "");
const renderFailed = ref(false);

onErrorCaptured(() => {
  renderFailed.value = true;
  return false;
});

const safeLinkProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);

const isSafeMarkdownLink = (href: string): boolean => {
  const value = href.trim();

  if (!value) {
    return false;
  }

  try {
    const url = new URL(value, window.location.href);
    return safeLinkProtocols.has(url.protocol);
  } catch {
    return false;
  }
};

const parseOptions: ParseOptions = {
  validateLink: isSafeMarkdownLink,
};

const handleMarkdownClick = (event: MouseEvent) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const link = target.closest("a");
  const href = link?.getAttribute("href") || "";

  if (!href) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (!isSafeMarkdownLink(href)) {
    return;
  }

  window.open(href, "_blank", "noopener,noreferrer");
};
</script>

<style scoped>
.ai-markdown-container {
  max-width: 100%;
  color: #000000;
  text-align: left;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ai-markdown-content {
  max-width: 100%;
  font-size: 14px;
  line-height: 1.6;
}

.ai-markdown-fallback {
  max-width: 100%;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.ai-markdown-content :deep(*) {
  box-sizing: border-box;
}

.ai-markdown-content :deep(h1),
.ai-markdown-content :deep(h2),
.ai-markdown-content :deep(h3),
.ai-markdown-content :deep(h4),
.ai-markdown-content :deep(h5),
.ai-markdown-content :deep(h6) {
  margin: 12px 0 8px;
  color: #111827;
  font-weight: 600;
  line-height: 1.4;
}

.ai-markdown-content :deep(h1) {
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 1.45em;
}

.ai-markdown-content :deep(h2) {
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 1.3em;
}

.ai-markdown-content :deep(h3) {
  font-size: 1.18em;
}

.ai-markdown-content :deep(h4) {
  font-size: 1.08em;
}

.ai-markdown-content :deep(h5),
.ai-markdown-content :deep(h6) {
  font-size: 1em;
}

.ai-markdown-content :deep(p) {
  margin: 8px 0;
}

.ai-markdown-content :deep(p:first-child),
.ai-markdown-content :deep(h1:first-child),
.ai-markdown-content :deep(h2:first-child),
.ai-markdown-content :deep(h3:first-child),
.ai-markdown-content :deep(ul:first-child),
.ai-markdown-content :deep(ol:first-child),
.ai-markdown-content :deep(blockquote:first-child),
.ai-markdown-content :deep(pre:first-child),
.ai-markdown-content :deep(table:first-child) {
  margin-top: 0;
}

.ai-markdown-content :deep(p:last-child),
.ai-markdown-content :deep(ul:last-child),
.ai-markdown-content :deep(ol:last-child),
.ai-markdown-content :deep(blockquote:last-child),
.ai-markdown-content :deep(pre:last-child),
.ai-markdown-content :deep(table:last-child) {
  margin-bottom: 0;
}

.ai-markdown-content :deep(strong) {
  color: #111827;
  font-weight: 600;
}

.ai-markdown-content :deep(em) {
  font-style: italic;
}

.ai-markdown-content :deep(del) {
  text-decoration: line-through;
  opacity: 0.75;
}

.ai-markdown-content :deep(code:not(pre code)) {
  padding: 2px 5px;
  border-radius: 3px;
  background-color: rgba(31, 41, 55, 0.08);
  color: #b91c1c;
  font-family: Consolas, Monaco, "Courier New", monospace;
  font-size: 0.9em;
  word-break: break-word;
}

.ai-markdown-content :deep(pre) {
  max-width: 100%;
  margin: 12px 0;
  padding: 12px;
  overflow-x: auto;
  border: 1px solid #30363d;
  border-radius: 6px;
  background-color: #0d1117 !important;
  color: #c9d1d9;
}

.ai-markdown-content :deep(pre code) {
  display: block;
  min-width: max-content;
  padding: 0;
  background-color: transparent !important;
  color: inherit !important;
  font-family: Consolas, Monaco, "Courier New", monospace;
  font-size: 0.95em;
  line-height: 1.5;
  white-space: pre;
}

.ai-markdown-content :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 12px;
  border-left: 4px solid #2f80ed;
  border-radius: 0 4px 4px 0;
  background-color: #f6f8fa;
  color: #4b5563;
}

.ai-markdown-content :deep(blockquote p) {
  margin: 4px 0;
}

.ai-markdown-content :deep(ul),
.ai-markdown-content :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}

.ai-markdown-content :deep(li) {
  margin: 4px 0;
  line-height: 1.6;
}

.ai-markdown-content :deep(li > p) {
  margin: 4px 0;
}

.ai-markdown-content :deep(ul ul),
.ai-markdown-content :deep(ul ol),
.ai-markdown-content :deep(ol ul),
.ai-markdown-content :deep(ol ol) {
  margin: 4px 0;
}

.ai-markdown-content :deep(table) {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 12px 0;
  overflow-x: auto;
  border-collapse: collapse;
  border-spacing: 0;
}

.ai-markdown-content :deep(th),
.ai-markdown-content :deep(td) {
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  white-space: nowrap;
}

.ai-markdown-content :deep(th) {
  background-color: #f3f4f6;
  color: #111827;
  font-weight: 600;
  text-align: left;
}

.ai-markdown-content :deep(td) {
  background-color: #ffffff;
  color: #1f2937;
}

.ai-markdown-content :deep(a) {
  color: #1f6feb;
  font-weight: 500;
  text-decoration: none;
}

.ai-markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.ai-markdown-content :deep(hr) {
  height: 1px;
  margin: 14px 0;
  border: 0;
  background-color: #e5e7eb;
}

.ai-markdown-content :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 8px 0;
  border-radius: 6px;
}
</style>
