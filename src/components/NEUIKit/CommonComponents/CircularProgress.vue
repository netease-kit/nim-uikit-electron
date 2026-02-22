<template>
  <svg
    class="circular-progress"
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
  >
    <!-- 背景轨道 -->
    <circle
      class="circular-progress-track"
      :cx="center"
      :cy="center"
      :r="radius"
      :stroke="trackColor"
      :stroke-width="strokeWidth"
      fill="none"
    />
    <!-- 进度环 -->
    <circle
      class="circular-progress-fill"
      :cx="center"
      :cy="center"
      :r="radius"
      :stroke="progressColor"
      :stroke-width="strokeWidth"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="dashOffset"
      fill="none"
      stroke-linecap="round"
    />
  </svg>
</template>

<script lang="ts" setup>
/**
 * 圆形进度环组件
 * 用于图片/视频上传进度显示
 */
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  /** 进度百分比 0-100 */
  progress: number;
  /** 环形尺寸（直径），单位 px */
  size?: number;
  /** 环形宽度，单位 px */
  strokeWidth?: number;
  /** 进度条颜色 */
  progressColor?: string;
  /** 轨道颜色 */
  trackColor?: string;
}>(), {
  progress: 0,
  size: 56,
  strokeWidth: 3,
  progressColor: '#fff',
  trackColor: 'rgba(255, 255, 255, 0.3)'
});

// 圆心坐标
const center = computed(() => props.size / 2);

// 半径（减去线宽的一半，确保不被裁剪）
const radius = computed(() => (props.size - props.strokeWidth) / 2);

// 周长
const circumference = computed(() => 2 * Math.PI * radius.value);

// 根据进度计算 stroke-dashoffset
const dashOffset = computed(() => {
  const normalizedProgress = Math.min(100, Math.max(0, props.progress));
  return circumference.value * (1 - normalizedProgress / 100);
});
</script>

<style scoped lang="scss">
.circular-progress {
  transform: rotate(-90deg); // 从顶部开始
  display: block;
}

.circular-progress-track {
  opacity: 1;
}

.circular-progress-fill {
  transition: stroke-dashoffset 0.2s ease-out;
}
</style>
