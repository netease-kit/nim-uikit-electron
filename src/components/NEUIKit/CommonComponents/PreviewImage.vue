<template>
  <Modal
    :visible="visible"
    :title="''"
    :showDefaultFooter="false"
    :height="640"
    :width="modalWidth"
    :showMask="true"
    :showClose="false"
    :top="80"
    :maskOpacity="0"
    :bodyStyle="{ padding: 20 }"
    @close="handleClose"
    @cancel="handleClose"
    @update:visible="handleUpdateVisible"
  >
    <div v-if="visible" class="preview-image-container" @click="handleClose">
      <div
        class="preview-image-wrapper"
        :style="{ height: maxBodyHeight + 'px' }"
      >
        <img
          :src="imageUrl"
          class="preview-image"
          :style="{ width: displayWidth + 'px', height: displayHeight + 'px' }"
          @click.stop
        />
        <!-- 加载中状态遮罩 -->
        <div v-if="isLoading" class="loading-overlay" @click.stop>
          <div class="loading-spinner"></div>
          <span class="loading-text">{{ t('loadingSourceImage') }}</span>
        </div>
        <div class="close-button" @click="handleClose">×</div>
      </div>
      <div class="controls">
        <div class="control-btn" @click.stop="zoomOut">−</div>
        <div class="control-btn" @click.stop="zoomIn">＋</div>
        <div
          class="control-btn download"
          @click.stop="handleDownload"
          title="下载图片"
        >
          <Icon type="icon-down-arrow" :size="20"></Icon>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
import Icon from "./Icon.vue";
import type { V2NIMMessageForUI } from "../store/types";
import { computed, ref } from "vue";
import { t } from "../utils/i18n";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    downloadFileName: string;
    msg: V2NIMMessageForUI;
    imageUrl: string;
    originHeight: number;
    originWidth: number;
    onClose: () => void;
    /** 是否正在加载源文件 */
    isLoading?: boolean;
  }>(),
  {
    visible: false,
    downloadFileName: "",
    msg: undefined,
    onClose: undefined,
    imageUrl: "",
    isLoading: false,
  }
);

import Modal from "./Modal.vue";

const emit = defineEmits(["update:visible", "close"]);

const handleClose = () => {
  emit("update:visible", false);
  emit("close");
};

const handleUpdateVisible = (value: boolean) => {
  emit("update:visible", value);
};

const maxBodyHeight = 600 - 40;

const fitScale = computed(() => {
  if (!props.originHeight || !props.originWidth) return 1;
  return Math.min(1, maxBodyHeight / props.originHeight);
});
const zoomScale = ref(1);
const minZoom = 0.2;
const maxZoom = 3;
const applyZoom = (next: number) => {
  zoomScale.value = Math.min(maxZoom, Math.max(minZoom, next));
};
const zoomIn = () => applyZoom(zoomScale.value + 0.1);
const zoomOut = () => applyZoom(zoomScale.value - 0.1);
const baseHeight = computed(() =>
  Math.round((props.originHeight || maxBodyHeight) * fitScale.value)
);
const baseWidth = computed(() =>
  Math.round((props.originWidth || maxBodyHeight) * fitScale.value)
);
const displayHeight = computed(() =>
  Math.round(baseHeight.value * zoomScale.value)
);
const displayWidth = computed(() =>
  Math.round(baseWidth.value * zoomScale.value)
);
const modalWidth = computed(() => Math.max(900, baseWidth.value + 40));

// 下载图片功能
const handleDownload = async () => {
  try {
    // 使用fetch获取图片数据
    const response = await fetch(props.imageUrl, {
      mode: "cors",
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();

    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = props.downloadFileName || "image.jpg";

    // 添加到DOM并触发下载
    document.body.appendChild(link);
    link.click();

    // 清理
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch {
    // 如果fetch失败，尝试直接打开链接
    try {
      const link = document.createElement("a");
      link.href = props.imageUrl;
      link.download = props.downloadFileName || "image.jpg";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("下载失败，请尝试右键保存图片");
    }
  }
};
</script>

<style scoped>
.preview-image-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
}

.preview-image-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 10px 0;
}

.preview-image {
  height: auto;
  object-fit: contain;
}

.controls {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  z-index: 10000;
}

.control-btn {
  width: 40px;
  height: 40px;
  color: #000;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background: rgba(221, 218, 218, 0.65);
}

.close-button {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 40px;
  height: 40px;
  color: #000;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  z-index: 10000;
  transition: background-color 0.2s;
}

/* 加载中状态遮罩 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #fff;
  font-size: 14px;
  margin-top: 12px;
}
</style>
