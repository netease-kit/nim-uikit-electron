<template>
  <!-- 发送中状态（包含上传阶段）：统一显示预览图，上传时叠加进度环 -->
  <div v-if="isSending" class="message-video-sending">
    <div class="video-preview-wrapper" :style="previewWrapperStyle">
      <img
        class="msg-video-frame"
        :class="{ 'uploading-preview': isUploading }"
        :src="previewImageSrc"
      />
      <!-- 上传进度信息：仅在上传中显示 -->
      <div v-if="isUploading" class="upload-overlay">
        <!-- 圆形进度环 + 取消按钮 -->
        <div class="circular-progress-wrapper">
          <CircularProgress :progress="uploadProgress" :size="56" />
          <div class="cancel-button" @click="handleCancel">
            <Icon type="icon-guanbi" :size="16" color="#fff"></Icon>
          </div>
        </div>
        <!-- 底部信息栏 -->
        <div class="upload-footer">
          <!-- 左下角文件大小 -->
          <div class="file-size-badge">{{ formattedSize }}</div>
          <!-- 右下角视频时长 -->
          <div class="video-duration-badge">{{ formattedDuration }}</div>
        </div>
      </div>
    </div>
  </div>
  <!-- 非发送中状态：发送成功、失败、未知等 -->
  <div v-else class="message-video-container" @click="handleVideoClick">
    <div class="video-frame-wrapper">
      <img
        class="msg-video-frame"
        :src="videoFirstFrameDataUrl || msg.previewImg"
      />
      <!-- 播放按钮覆盖层 -->
      <div class="play-button-overlay">
        <!-- 下载中：显示圆形进度条 -->
        <CircularProgress
          v-if="isDownloading"
          :progress="downloadProgress"
          :size="56"
          :strokeWidth="3"
          color="#337EFF"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </CircularProgress>
        <!-- 非下载中：显示播放按钮 -->
        <div v-else class="play-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  </div>

  <!-- 视频播放 Modal -->
  <Modal
    v-model:visible="isVideoModalVisible"
    :title="t('videoPlayText')"
    :width="800"
    :height="600"
    :showDefaultFooter="false"
    :maskClosable="true"
    :maskOpacity="0"
    :bodyStyle="{
      padding: '0 16px 16px 16px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }"
  >
    <div class="video-modal-content">
      <video
        ref="videoRef"
        class="modal-video"
        controls
        autoplay
        :src="videoUrl"
        @loadedmetadata="handleVideoLoaded"
      >
        您的浏览器不支持视频播放。
      </video>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
/** 消息视频组件 */
import { ref, computed, onMounted, watch } from "vue";
import { parseFileSize } from "@xkit-yx/utils";
import type { V2NIMMessageForUI } from "../../store/types";
import type { V2NIMMessageVideoAttachment } from "node-nim/types/v2_def/v2_nim_struct_def";
import { V2NIMConst } from "../../utils/constants";
import { isMessageNoError } from "../../utils/msg";
import Modal from "../../CommonComponents/Modal.vue";
import CircularProgress from "../../CommonComponents/CircularProgress.vue";
import Icon from "../../CommonComponents/Icon.vue";
import { t } from "../../utils/i18n";
import { getContextState } from "../../utils/init";
import {
  downloadVideoCover,
  downloadVideoSource,
  checkLocalFileExists,
  toLocalFileUrl,
} from "../../utils/attachment-download";

// Props
interface Props {
  msg: V2NIMMessageForUI;
}

const props = defineProps<Props>();

const { store } = getContextState();

// 判断是否正在发送中（包含上传和发送两个阶段）
const isSending = computed(() => {
  return (
    props.msg.sendingState ===
    V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_SENDING
  );
});

// 判断是否正在上传（发送中且进度小于100%时显示进度条）
const isUploading = computed(() => {
  const progress = props.msg.uploadProgress;
  // 只有进度小于 100% 且正在发送中才显示上传进度组件
  return (
    isSending.value &&
    typeof progress === "number" &&
    progress >= 0 &&
    progress < 100
  );
});

// 上传进度
const uploadProgress = computed(() => props.msg.uploadProgress ?? 0);

// 视频附件信息
const videoAttachment = computed(
  () => props.msg.attachment as V2NIMMessageVideoAttachment,
);
const videoSize = computed(() => videoAttachment.value?.size || 0);
const videoDuration = computed(() => videoAttachment.value?.duration || 0);

// 格式化文件大小
const formattedSize = computed(() => {
  return parseFileSize(videoSize.value);
});

// 格式化视频时长（秒转为 m:ss 或 h:mm:ss 格式）
// 注意：SDK 的 duration 字段单位是秒
const formattedDuration = computed(() => {
  const durationSec = videoDuration.value;
  if (!durationSec || durationSec <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(durationSec);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// 取消上传
const handleCancel = async () => {
  try {
    await store?.msgStore.cancelMessageAttachmentUploadActive(props.msg);
  } catch (error) {
    console.error('Cancel upload failed:', error);
  }
};

// 响应式数据
const isVideoModalVisible = ref(false);
// 本地封面路径
const localCoverPath = ref("");
// 本地视频源文件路径
const localVideoPath = ref("");
// 是否正在下载视频源文件
const isDownloading = ref(false);
// 下载进度 (0-100)
const downloadProgress = ref(0);

// 视频尺寸信息：上传过程中优先使用 previewWidth/previewHeight
const videoWidth = computed(() => {
  // 上传过程中，attachment 可能还没有正确的宽高，使用 previewWidth
  if (isSending.value && props.msg.previewWidth) {
    return props.msg.previewWidth;
  }
  return videoAttachment.value?.width || 0;
});

const videoHeight = computed(() => {
  // 上传过程中，attachment 可能还没有正确的宽高，使用 previewHeight
  if (isSending.value && props.msg.previewHeight) {
    return props.msg.previewHeight;
  }
  return videoAttachment.value?.height || 0;
});

// 默认视频占位图（灰色背景 + 视频图标）
const defaultVideoPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiM0QTRBNEEiLz48cGF0aCBkPSJNODAgNzBWMTMwTDEzMCAxMDBMODAgNzBaIiBmaWxsPSIjOTk5Ii8+PC9zdmc+';

// 上传中预览图片源：优先使用本地预览图
const previewImageSrc = computed(() => {
  // 上传过程中优先使用本地预览图（base64 格式）
  if (props.msg.previewImg && props.msg.previewImg.startsWith('data:')) {
    return props.msg.previewImg;
  }
  // 如果有远程URL，使用首帧
  if (videoFirstFrameDataUrl.value) {
    return videoFirstFrameDataUrl.value;
  }
  // 使用默认占位图
  return defaultVideoPlaceholder;
});

// 预览容器样式：根据视频宽高比计算
const previewWrapperStyle = computed(() => {
  const maxHeight = 200;
  const minWidth = 80;
  const maxWidth = 300;

  // 如果没有宽高信息，使用默认尺寸
  if (!videoWidth.value || !videoHeight.value) {
    return {
      width: `${maxHeight}px`,
      height: `${maxHeight}px`,
    };
  }

  // 按比例计算宽度
  const aspectRatio = videoWidth.value / videoHeight.value;
  let calcWidth = Math.round(maxHeight * aspectRatio);

  // 限制宽度范围
  calcWidth = Math.max(minWidth, Math.min(maxWidth, calcWidth));

  return {
    width: `${calcWidth}px`,
    height: `${maxHeight}px`,
  };
});

// 计算属性
/** 获取视频首帧（优先使用本地路径） */
const videoFirstFrameDataUrl = computed(() => {
  // 优先使用本地封面路径
  if (localCoverPath.value) {
    return localCoverPath.value;
  }

  //@ts-ignore
  const url = props.msg.attachment?.url;

  return url ? `${url}${url.includes("?") ? "&" : "?"}vframe&offset=1` : "";
});

/** 视频播放URL（优先使用本地路径） */
const videoUrl = computed(() => {
  // 优先使用本地视频路径
  if (localVideoPath.value) {
    return localVideoPath.value;
  }

  //@ts-ignore
  const baseUrl = props.msg.attachment?.url || "";
  //@ts-ignore
  const fileName = `${props.msg.messageClientId}-video-${props.msg.attachment?.ext}`;

  // 如果 URL 没有文件扩展名，尝试添加
  if (baseUrl && !baseUrl.match(/\.(mp4|webm|ogg|avi|mov)$/i)) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}filename=${encodeURIComponent(fileName)}`;
  }

  return baseUrl;
});

// 下载视频封面到本地
const handleDownloadCover = async () => {
  const attachment = videoAttachment.value;
  if (!attachment) return;

  const result = await downloadVideoCover(
    attachment,
    props.msg.messageClientId,
  );

  if (result.success && result.localPath) {
    localCoverPath.value = toLocalFileUrl(result.localPath);
  }
};

// 事件处理
const handleVideoClick = async () => {
  // 暂停所有音频播放
  const audio = document.getElementById("yx-audio-message") as HTMLAudioElement;
  audio?.pause();

  if (
    !(
      isMessageNoError(props.msg.messageStatus?.errorCode) ||
      props.msg.sendingState ===
        V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_UNKNOWN
    )
  ) {
    return;
  }

  const attachment = videoAttachment.value;
  if (!attachment) return;

  // 如果正在下载，不做任何处理
  if (isDownloading.value) {
    return;
  }

  // 检查本地视频是否已存在
  if (attachment.path) {
    const exists = await checkLocalFileExists(attachment.path);
    if (exists) {
      localVideoPath.value = toLocalFileUrl(attachment.path);
      isVideoModalVisible.value = true;
      return;
    }
  }

  // 如果已有本地视频路径，直接播放
  if (localVideoPath.value) {
    isVideoModalVisible.value = true;
    return;
  }

  // 需要下载视频源文件
  isDownloading.value = true;
  downloadProgress.value = 0;

  const result = await downloadVideoSource(
    attachment,
    props.msg.messageClientId,
    (progress) => {
      downloadProgress.value = progress;
    },
  );

  isDownloading.value = false;

  if (result.success && result.localPath) {
    localVideoPath.value = toLocalFileUrl(result.localPath);
    isVideoModalVisible.value = true;
  } else {
    // 下载失败，尝试使用远程URL播放
    isVideoModalVisible.value = true;
  }
};

const handleVideoLoaded = () => {
  // 视频加载完成后的处理
  console.log("视频加载完成");
};

// 生命周期
onMounted(() => {
  handleDownloadCover();
});

// 监听消息变化（发送成功后重新下载封面）
watch(
  () => props.msg,
  () => {
    handleDownloadCover();
  },
);
</script>

<style scoped lang="scss">
/* 发送中容器（包含上传阶段） */
.message-video-sending {
  position: relative;
  height: 200px;
}

.video-preview-wrapper {
  position: relative;
  display: inline-block;
  height: 200px;
  min-width: 80px;
  max-width: 300px;
  border-radius: 8px;
  overflow: hidden;
}

.uploading-preview {
  opacity: 0.7;
  filter: brightness(0.6);
}

.upload-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 圆形进度环容器 */
.circular-progress-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 取消按钮（覆盖在进度环中心） */
.cancel-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
}

/* 底部信息栏 */
.upload-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  padding: 8px;
}

/* 左下角文件大小徽章 */
.file-size-badge {
  padding: 2px 6px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
}

/* 右下角视频时长徽章 */
.video-duration-badge {
  padding: 2px 6px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
}

.message-video-container {
  cursor: pointer;
  position: relative;
  height: 200px;
}

.video-frame-wrapper {
  position: relative;
  display: inline-block;
  height: 200px;
  min-width: 80px;
  max-width: 300px;
}

.msg-video-frame {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 8px;
  object-fit: cover;
}

.play-button-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.play-button-overlay:hover {
  background-color: rgba(0, 0, 0, 0.5);
}

.play-button {
  width: 48px;
  height: 48px;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.play-button:hover {
  background-color: rgba(0, 0, 0, 0.8);
  transform: scale(1.3);
}

.video-modal-content {
  width: fit-content;
  height: 520px;
  max-width: 800px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-video {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  outline: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .msg-video-frame {
    max-width: 250px;
  }

  .play-button {
    width: 40px;
    height: 40px;
  }

  .play-button svg {
    width: 20px;
    height: 20px;
  }
}
</style>
