<template>
  <div class="highlighted-msg-text" :style="{ fontSize: (fontSize || 14) + 'px' }">
    <template v-for="item in highlightedTextArr" :key="item.key">
      <template v-if="item.type === 'text'">
        <span class="msg-text" v-html="item.value"></span>
      </template>
      <template v-else-if="item.type === 'Ait'">
        <span class="msg-text ait-text">
          {{ " " + item.value + " " }}
        </span>
      </template>
      <template v-else-if="item.type === 'emoji'">
        <Icon
          :type="EMOJI_ICON_MAP_CONFIG[item.value]"
          :size="fontSize || 22"
          :style="{ margin: '0 2px 2px 2px', verticalAlign: 'bottom' }"
        />
      </template>
      <template v-else-if="item.type === 'link'">
        <a
          :href="item.value"
          target="_blank"
          rel="noopener noreferrer"
          class="link-text"
          :style="{
            fontSize: (fontSize || 14) + 'px',
          }"
          v-html="item.value"
        >
        </a>
      </template>
    </template>
  </div>
</template>

<script lang="ts" setup>
/** 支持高亮的消息文本组件 */
import { computed } from "vue";
import Icon from "../../CommonComponents/Icon.vue";
import { parseText } from "../../utils/parseText";
import { EMOJI_ICON_MAP_CONFIG } from "../../utils/emoji";
import type { V2NIMMessageForUI } from "../../store/types";

const props = withDefaults(
  defineProps<{
    msg: V2NIMMessageForUI;
    keyword: string;
    fontSize?: number;
  }>(),
  {
    keyword: "",
  }
);

// 高亮关键字的函数
const highlightKeyword = (text: string, keyword: string): string => {
  if (!keyword || !keyword.trim()) {
    return text;
  }

  const keywordTrimmed = keyword.trim();
  // 使用全局替换，不区分大小写
  const regex = new RegExp(`(${keywordTrimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.replace(regex, '<span class="keyword-highlight">$1</span>');
};

// 解析文本并添加高亮
const highlightedTextArr = computed(() => {
  const textArr = parseText(props.msg?.text || "", props.msg?.serverExtension);

  return textArr.map((item, index) => {
    if (item.type === "text") {
      return {
        ...item,
        value: highlightKeyword(item.value, props.keyword),
        key: `${item.type}-${index}`,
      };
    } else if (item.type === "link") {
      return {
        ...item,
        value: highlightKeyword(item.value, props.keyword),
        key: `${item.type}-${index}`,
      };
    } else {
      return {
        ...item,
        key: `${item.type}-${index}`,
      };
    }
  });
});
</script>

<style scoped>
.highlighted-msg-text {
  color: #000;
  text-align: left;
  word-break: break-all;
  word-wrap: break-word;
  white-space: break-spaces;
  line-height: 20px;
}

.msg-text {
  color: #000;
}

.ait-text {
  color: #1861df;
}

.link-text {
  color: #1861df;
  text-decoration: none;
}

.link-text:hover {
  text-decoration: underline;
}

/* 高亮关键字样式 - 优化为纯文本颜色高亮 */
.highlighted-msg-text :deep(.keyword-highlight) {
  color: #337ecc;
  font-weight: 600;
}
</style>
