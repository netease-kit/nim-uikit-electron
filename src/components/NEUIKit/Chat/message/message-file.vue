<template>
  <!-- 文件消息卡片 -->
  <div
    class="msg-file-wrapper"
    :class="{
      'is-uploading': isUploading,
      'msg-file-in': !msg.isSelf,
      'msg-file-out': msg.isSelf,
    }"
  >
    <!-- 文件信息区域（始终显示） -->
    <a
      class="msg-file-link"
      :href="isUploading ? undefined : downloadHref"
      :download="isUploading ? undefined : downloadName"
      :class="{ disabled: isUploading }"
    >
      <div class="msg-file">
        <Icon :type="iconType" :size="32"></Icon>
        <div class="msg-file-content">
          <div class="msg-file-title">
            <div class="msg-file-title-prefix">{{ baseName }}</div>
            <div class="msg-file-title-suffix">{{ dotExt }}</div>
          </div>
          <div class="msg-file-info">
            <span class="msg-file-size">{{ parseFileSize(size) }}</span>
            <!-- 上传时显示状态信息 -->
            <template v-if="isUploading">
              <span class="msg-file-status">{{ t("uploadingText") }}</span>
              <span class="msg-file-speed">{{ formattedSpeed }}</span>
            </template>
          </div>
        </div>
      </div>
    </a>
    <!-- 上传时显示取消按钮 -->
    <div v-if="isUploading" class="msg-file-cancel" @click="handleCancel">
      <Icon type="icon-guanbi" :size="14" color="#999"></Icon>
    </div>
    <!-- 底部进度条 -->
    <UploadProgressBar v-if="isUploading" :progress="uploadProgress" :parentPadding="12" />
  </div>
</template>

<script lang="ts" setup>
/** 文件消息 */
import { getFileType, parseFileSize } from "@xkit-yx/utils";
import Icon from "../../CommonComponents/Icon.vue";
import UploadProgressBar from "../../CommonComponents/UploadProgressBar.vue";
import type { V2NIMMessageForUI } from "../../store/types";
import type { V2NIMMessageFileAttachment } from "node-nim/types/v2_def/v2_nim_struct_def";
import { computed } from "vue";
import { V2NIMConst } from "../../utils/constants";
import { t } from "../../utils/i18n";
import { getContextState } from "../../utils/init";

const { store } = getContextState();

const props = withDefaults(defineProps<{ msg: V2NIMMessageForUI }>(), {});

// 判断是否正在上传
const isUploading = computed(() => {
  const progress = props.msg.uploadProgress;
  const isSending =
    props.msg.sendingState ===
    V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING;
  // 只有进度小于 100% 且正在发送中才显示上传进度组件
  return typeof progress === "number" && progress >= 0 && progress < 100 && isSending;
});

// 上传进度
const uploadProgress = computed(() => props.msg.uploadProgress ?? 0);

// 格式化上传速度
const formattedSpeed = computed(() => {
  const speed = props.msg.uploadSpeed;
  if (!speed || speed <= 0) {
    return "";
  }
  return `${parseFileSize(speed)}/s`;
});

// 取消上传
const handleCancel = async () => {
  try {
    await store?.msgStore.cancelMessageAttachmentUploadActive(props.msg);
  } catch (error) {
    console.error("Cancel upload failed:", error);
  }
};

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
const dotExt = computed(() => (ext ? (ext.startsWith(".") ? ext : `.${ext}`) : ""));

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
const iconType = fileIconMap[getFileType(ext) as keyof typeof fileIconMap] || "icon-weizhiwenjian";

// 下载链接
const downloadHref = computed(() => {
  const _url = (props.msg.attachment as V2NIMMessageFileAttachment)?.url;
  if (_url) {
    return addUrlSearch(_url, `download=${name}`);
  }
});

// 下载文件名
const downloadName = computed(() => {
  return (props.msg.attachment as V2NIMMessageFileAttachment)?.name;
});
</script>

<style scoped lang="scss">
.msg-file-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 240px;
  max-width: 360px;
  padding: 12px;
  padding-bottom: 12px;
  overflow: hidden;
}

.msg-file-wrapper.is-uploading {
  padding-bottom: 16px;
}

/* 接收的文件消息 */
.msg-file-in {
  border-radius: 0 8px 8px 8px;
  background-color: #e8eaed;
  margin-left: 8px;
}

/* 发送的文件消息 */
.msg-file-out {
  border-radius: 8px 0 8px 8px;
  background-color: #d6e5f6;
}

.msg-file-link {
  flex: 1;
  min-width: 0;
  text-decoration: none;

  &.disabled {
    pointer-events: none;
  }
}

/* 文件消息基础样式 */
.msg-file {
  display: flex;
  flex-direction: row;
  align-items: center;
}

/* 文件内容区域 */
.msg-file-content {
  margin-left: 12px;
  flex: 1;
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
}

/* 文件名后缀 */
.msg-file-title-suffix {
  white-space: nowrap;
  flex-shrink: 0;
}

/* 文件信息行 */
.msg-file-info {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #999;
  gap: 8px;
  margin-top: 4px;
}

/* 文件大小 */
.msg-file-size {
  flex-shrink: 0;
}

/* 上传状态 */
.msg-file-status {
  color: #1890ff;
}

/* 上传速度 */
.msg-file-speed {
  flex-shrink: 0;
}

/* 取消上传按钮 */
.msg-file-cancel {
  flex-shrink: 0;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  margin-left: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
}
</style>
