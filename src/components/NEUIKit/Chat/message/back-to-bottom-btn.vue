<template>
  <div v-if="visible" class="back-to-bottom-btn" @click="handleClick">
    <div class="back-to-bottom-content" :class="{ 'has-new-message': hasNewMessage }">
      <span>{{ buttonText }}</span>
      <Icon type="icon-down-arrow" :size="16" />
      <div v-if="hasNewMessage" class="new-message-indicator"></div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { t } from "../../utils/i18n";
import Icon from "../../CommonComponents/Icon.vue";

const props = defineProps<{
  visible: boolean;
  hasNewMessage?: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

// 根据是否有新消息动态显示文案
const buttonText = computed(() => {
  return props.hasNewMessage ? t("receiveText") : t("backToBottomText");
});

const handleClick = () => {
  emit("click");
};
</script>

<style scoped>
.back-to-bottom-btn {
  position: absolute;
  right: 20px;
  bottom: 80px;
  z-index: 1000;
  cursor: pointer;
  animation: slideUp 0.3s ease-out;
}

.back-to-bottom-content {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  color: #000;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(51, 126, 255, 0.3);
  transition: all 0.2s ease;
  white-space: nowrap;
  position: relative;
}

.back-to-bottom-btn:hover .back-to-bottom-content {
  background: #ebeff1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(51, 126, 255, 0.4);
}

.new-message-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  background: #ff4757;
  border-radius: 50%;
  border: 2px solid #ffffff;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
