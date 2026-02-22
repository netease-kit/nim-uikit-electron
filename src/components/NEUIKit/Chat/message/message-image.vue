<template>
  <!-- 发送中状态（包含上传阶段）：统一显示预览图，上传时叠加进度环 -->
  <div v-if="isSending" class="message-image-sending">
    <div class="image-preview-wrapper">
      <img
        class="msg-image"
        :class="{ 'uploading-preview': isUploading }"
        :src="msg.previewImg || thumbImageUrl || imageUrl"
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
        <!-- 左下角文件大小 -->
        <div class="file-size-badge">{{ formattedSize }}</div>
      </div>
    </div>
  </div>
  <!-- 非发送中状态：发送成功、失败、未知等 -->
  <div v-else class="message-image-container" @click="handleImageClick">
    <!-- 发送成功或未知状态 -->
    <img
      v-if="
        isMessageNoError(msg.messageStatus?.errorCode) ||
        msg.sendingState ==
          V2NIMConst.V2NIMMessageSendingState
            .V2NIM_MESSAGE_SENDING_STATE_UNKNOWN
      "
      class="msg-image"
      :src="localThumbPath || thumbImageUrl || imageUrl || msg.previewImg"
    />
    <!-- 发送失败状态 -->
    <img
      v-else-if="
        msg.sendingState ==
        V2NIMConst.V2NIMMessageSendingState.V2NIM_MESSAGE_SENDING_STATE_FAILED
      "
      class="msg-image"
      :src="msg.previewImg || thumbImageUrl || imageUrl"
    />
  </div>

  <!-- 图片预览组件 -->
  <PreviewImage
    v-if="isPreviewVisible"
    v-model:visible="isPreviewVisible"
    :imageUrl="currentPreviewUrl"
    :msg="props.msg"
    :onClose="handlePreviewClose"
    :downloadFileName="downloadFileName"
    :originHeight="originHeight"
    :originWidth="originWidth"
    :isLoading="isSourceLoading"
  />
</template>

<script lang="ts" setup>
/** 图片消息 */
import { ref, computed, watch, onMounted } from "vue";
import { parseFileSize } from "@xkit-yx/utils";
import { V2NIMConst } from "../../utils/constants";
import { isMessageNoError } from "../../utils/msg";
import PreviewImage from "../../CommonComponents/PreviewImage.vue";
import CircularProgress from "../../CommonComponents/CircularProgress.vue";
import Icon from "../../CommonComponents/Icon.vue";
import type { V2NIMMessageImageAttachment } from "node-nim/types/v2_def/v2_nim_struct_def";
import type { V2NIMMessageForUI } from "../../store/types";
import {
  downloadImageThumbnail,
  downloadImageSource,
  checkLocalFileExists,
  toLocalFileUrl,
} from "../../utils/attachment-download";
import { getContextState } from "../../utils/init";

const props = withDefaults(
  defineProps<{
    msg: V2NIMMessageForUI;
  }>(),
  {},
);

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

// 图片附件信息
const imageAttachment = computed(
  () => props.msg.attachment as V2NIMMessageImageAttachment,
);
const imageSize = computed(() => imageAttachment.value?.size || 0);

// 格式化文件大小
const formattedSize = computed(() => {
  return parseFileSize(imageSize.value);
});

// 取消上传
const handleCancel = async () => {
  try {
    await store?.msgStore.cancelMessageAttachmentUploadActive(props.msg);
  } catch (error) {
    console.error('Cancel upload failed:', error);
  }
};

// 预览状态
const isPreviewVisible = ref(false);
// 当前预览的图片URL
const currentPreviewUrl = ref("");

// 缩略图URL
const thumbImageUrl = ref("");
// 本地缩略图路径（已转换为可用URL）
const localThumbPath = ref("");
// 本地源文件路径（已转换为可用URL）
const localSourcePath = ref("");
// 源文件是否正在加载
const isSourceLoading = ref(false);

const originHeight = computed(
  /**
   * 计算消息体的最大高度
   * @returns {number} 消息附件的高度（如果存在且有效）或默认的最大高度
   */
  () => Number(imageAttachment.value?.height) || 200,
);
const originWidth = computed(
  () =>
    Number(imageAttachment.value?.width) || 200 * (originHeight.value / 200),
);

// 点击图片处理
const handleImageClick = async () => {
  const attachment = imageAttachment.value;
  if (!attachment) return;

  // 先打开预览，显示缩略图
  currentPreviewUrl.value =
    localThumbPath.value || thumbImageUrl.value || imageUrl.value || "";
  isPreviewVisible.value = true;

  // 检查源文件是否已存在本地
  if (attachment.path) {
    const exists = await checkLocalFileExists(attachment.path);
    if (exists) {
      const localUrl = toLocalFileUrl(attachment.path);
      localSourcePath.value = localUrl;
      currentPreviewUrl.value = localUrl;
      return;
    }
  }

  // 如果已有本地源文件路径，直接使用
  if (localSourcePath.value) {
    currentPreviewUrl.value = localSourcePath.value;
    return;
  }

  // 需要下载源文件
  isSourceLoading.value = true;
  const result = await downloadImageSource(
    attachment,
    props.msg.messageClientId,
  );

  if (result.success && result.localPath) {
    const localUrl = toLocalFileUrl(result.localPath);
    localSourcePath.value = localUrl;
    currentPreviewUrl.value = localUrl;
  } else {
    // 下载失败，使用远程URL
    currentPreviewUrl.value = attachment.url || "";
  }
  isSourceLoading.value = false;
};

// 关闭预览
const handlePreviewClose = () => {
  isPreviewVisible.value = false;
  currentPreviewUrl.value = "";
  isSourceLoading.value = false;
};
// 图片URL计算属性
const imageUrl = computed(() => {
  // 被拉黑
  if (props.msg?.messageStatus?.errorCode == 102426) {
    return "https://yx-web-nosdn.netease.im/common/c1f278b963b18667ecba4ee9a6e68047/img-fail.png";
  }

  //@ts-ignore
  return props.msg?.attachment?.url || props.msg.attachment?.file;
});

// 生成下载文件名
const downloadFileName = computed(() => {
  const timestamp = props.msg.createTime || Date.now();
  const extension = getImageExtension(imageUrl.value);

  return `image_${timestamp}${extension}`;
});

// 获取图片扩展名
const getImageExtension = (url: string) => {
  // 尝试从URL中提取扩展名
  const urlMatch = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)($|\?)/i);
  if (urlMatch) {
    return `.${urlMatch[1].toLowerCase()}`;
  }

  // 从attachment中获取扩展名
  //@ts-ignore
  const fileName = props.msg.attachment?.name;
  //@ts-ignore
  const fileExt = props.msg.attachment?.ext;
  if (fileName) {
    const fileMatch = fileExt.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i);
    if (fileMatch) {
      return `.${fileMatch[1].toLowerCase()}`;
    }
  }

  // 默认使用jpg
  return ".jpg";
};

// 下载缩略图到本地
const handleImageThumbUrl = async (attachment: V2NIMMessageImageAttachment) => {
  if (!attachment) return;

  const size = attachment?.size || 0;
  const imgSizeConstant = 1024 * 1024 * 20;

  // 小于20M 才能使用缩略图功能，大于20M 直接下载源文件
  if (size < imgSizeConstant) {
    // 下载缩略图到本地
    const result = await downloadImageThumbnail(
      attachment,
      props.msg.messageClientId,
    );
    if (result.success && result.localPath) {
      localThumbPath.value = toLocalFileUrl(result.localPath);
    }
  } else {
    // 大于20M，直接下载源文件
    const result = await downloadImageSource(
      attachment,
      props.msg.messageClientId,
    );
    if (result.success && result.localPath) {
      localThumbPath.value = toLocalFileUrl(result.localPath);
    }
  }
};

onMounted(() => {
  const attachment = props.msg.attachment as V2NIMMessageImageAttachment;
  handleImageThumbUrl(attachment);
});

// 本端发送图片消息，发送成功后触发
watch(
  () => props.msg,
  () => {
    const attachment = props.msg.attachment as V2NIMMessageImageAttachment;
    handleImageThumbUrl(attachment);
  },
);
</script>

<style scoped lang="scss">
/* 发送中容器（包含上传阶段） */
.message-image-sending {
  position: relative;
}

.image-preview-wrapper {
  position: relative;
  display: inline-block;
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

/* 左下角文件大小徽章 */
.file-size-badge {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 6px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
}

.message-image-container {
  cursor: pointer;
}
.message-image-container:hover {
  opacity: 0.8;
}

.msg-image {
  max-width: 100%;
  min-width: 80px;
  height: 180px;
  display: block;
  border-radius: 8px;
}
</style>
