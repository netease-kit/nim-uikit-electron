<template>
  <a class="msg-file-wrapper" :href="downloadHref" :download="downloadName">
    <div
      :class="!msg.isSelf ? 'msg-file msg-file-in' : 'msg-file msg-file-out'"
    >
      <Icon :type="iconType" :size="32"></Icon>
      <div class="msg-file-content">
        <div class="msg-file-title">
          <div class="msg-file-title-prefix">{{ baseName }}</div>
          <div class="msg-file-title-suffix">{{ dotExt }}</div>
        </div>
        <div class="msg-file-size">{{ parseFileSize(size) }}</div>
      </div>
    </div>
  </a>
</template>

<script lang="ts" setup>
/** 文件消息 */
import { getFileType, parseFileSize } from "@xkit-yx/utils";
import Icon from "../../CommonComponents/Icon.vue";
import type { V2NIMMessageForUI } from "../../store/types";
import type { V2NIMMessageFileAttachment } from "node-nim/types/v2_def/v2_nim_struct_def";
import { computed } from "vue";
const props = withDefaults(defineProps<{ msg: V2NIMMessageForUI }>(), {});
// 文件类型图标映射
const fileIconMap = {
  pdf: "icon-PPT",
  word: "icon-Word",
  excel: "icon-Excel",
  ppt: "icon-PPT",
  zip: "icon-RAR1",
  txt: "icon-qita",
  img: "icon-tupian2",
  audio: "icon-yinle",
  video: "icon-shipin",
};

const {
  name = "",
  ext = "",
  size = 0,
} = (props.msg.attachment as V2NIMMessageFileAttachment) || {};

// 文件名后缀
const dotExt = computed(() =>
  ext ? (ext.startsWith(".") ? ext : `.${ext}`) : ""
);

// 文件名前缀
const baseName = computed(() => {
  const n = name || "";
  const e = dotExt.value;
  if (!e) return n;
  if (n.toLowerCase().endsWith(e.toLowerCase())) {
    return n.slice(0, -e.length);
  }
  return n;
});

// 添加url参数
const addUrlSearch = (url: string, search: string): string => {
  const urlObj = new URL(url);

  urlObj.search += (urlObj.search.startsWith("?") ? "&" : "?") + search;
  return urlObj.href;
};

// 获取文件类型
const iconType =
  fileIconMap[getFileType(ext) as keyof typeof fileIconMap] ||
  "icon-weizhiwenjian";

// 下载链接
const downloadHref = computed(() => {
  const _url = (props.msg.attachment as V2NIMMessageFileAttachment)?.url;
  if (_url) {
    return addUrlSearch(_url, `download=${name}`);
  }
});

// 下载文件名
/**
 * Generates a display name for a file attachment by combining the base filename with its extension
 * @param {V2NIMMessageFileAttachment} props.msg.attachment - The file attachment object containing the base filename
 * @param {string} ext - The file extension to append to the filename
 * @returns {string} The complete filename combining the base name and extension
 */
const downloadName = computed(() => {
  return (props.msg.attachment as V2NIMMessageFileAttachment)?.name;
});

// 下载文件
// const handleDownload = async () => {
//   try {
//     const url = downloadHref.value as string;
//     if (!url) return;
//     const response = await fetch(url, { mode: "cors", credentials: "omit" });
//     if (!response.ok) throw new Error(String(response.status));
//     const blob = await response.blob();
//     const link = document.createElement("a");
//     const objectUrl = window.URL.createObjectURL(blob);
//     link.href = objectUrl;
//     link.download = downloadName.value || "file";
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     window.URL.revokeObjectURL(objectUrl);
//   } catch {
//     const url = downloadHref.value as string;
//     if (url) {
//       const link = document.createElement("a");
//       link.href = url;
//       link.download = downloadName.value || "file";
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//     }
//   }
// };
</script>

<style scoped>
.msg-file-wrapper {
  height: 56px;
  display: inline-block;
  padding: 0px;
  text-decoration: none;
}

/* 文件消息基础样式 */
.msg-file {
  height: 56px;
  display: flex;
  flex-direction: row;
  align-items: center;
  border-radius: 8px;
}

/* 接收的文件消息 */
.msg-file-in {
  margin-left: 8px;
}

/* 发送的文件消息 */
.msg-file-out {
  margin-right: 8px;
}

/* 文件内容区域 */
.msg-file-content {
  margin-left: 15px;
  max-width: 300px;
  min-width: 0;
}

/* 文件标题区域 */
.msg-file-title {
  color: #1890ff;
  font-size: 14px;
  font-weight: 400;
  display: flex;
}

/* 文件名前缀 */
.msg-file-title-prefix {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

/* 文件名后缀 */
.msg-file-title-suffix {
  white-space: nowrap;
  flex-shrink: 0;
}

/* 文件名 */
.msg-file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 文件大小 */
.msg-file-size {
  color: #999;
  font-size: 13px;
  margin-top: 4px;
}
</style>
