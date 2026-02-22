<template>
  <div 
    class="upload-progress-bar-container"
    :style="containerStyle"
  >
    <div
      class="upload-progress-bar-fill"
      :style="{ width: `${progress}%` }"
    ></div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

/**
 * 上传进度条组件（底部边框样式）
 * 显示一个简洁的底部进度条，类似边框效果
 */

const props = withDefaults(defineProps<{
  /** 上传进度 0-100 */
  progress: number;
  /** 父容器的左右 padding 值（用于补偿以实现贴边效果） */
  parentPadding?: number;
}>(), {
  progress: 0,
  parentPadding: 0
});

// 计算容器样式，根据父容器 padding 调整位置
const containerStyle = computed(() => {
  if (props.parentPadding > 0) {
    return {
      marginLeft: `-${props.parentPadding}px`,
      marginRight: `-${props.parentPadding}px`,
      width: `calc(100% + ${props.parentPadding * 2}px)`
    };
  }
  return {};
});
</script>

<style scoped lang="scss">
.upload-progress-bar-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.upload-progress-bar-fill {
  height: 100%;
  background-color: #1890ff;
  transition: width 0.2s ease-out;
}
</style>
