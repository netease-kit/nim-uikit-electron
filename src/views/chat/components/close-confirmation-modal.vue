<template>
  <Modal
    :visible="visible"
    :title="t('closeWindowTitleText')"
    :confirmText="t('okText')"
    :cancelText="t('cancelText')"
    :width="460"
    :height="270"
    :showClose="false"
    :showDefaultFooter="false"
    :maskClosable="false"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="close-confirmation-wrapper">
      <div class="content-wrapper">
        <Icon type="icon-warning" :size="48" class="warning-icon" />
        <div class="right-content">
          <div class="message">{{ t('closeWindowConfirmText') }}</div>
          <div class="radio-group">
            <label class="radio-item">
              <input 
                type="radio" 
                name="close-action" 
                value="minimize"
                v-model="selectedAction"
              />
              <span class="radio-label">{{ t('minimizeToTrayText') }}</span>
            </label>
            <label class="radio-item">
              <input 
                type="radio" 
                name="close-action" 
                value="quit"
                v-model="selectedAction"
              />
              <span class="radio-label">{{ t('quitAppText') }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="custom-footer">
        <div class="remember-choice">
          <input 
            type="checkbox" 
            id="remember-choice" 
            v-model="rememberChoice"
          />
          <label for="remember-choice">{{ t('rememberChoiceText') }}</label>
        </div>
        <div class="footer-buttons">
          <Button type="default" @click="handleCancel">
            {{ t('cancelText') }}
          </Button>
          <Button type="primary" @click="handleConfirm">
            {{ t('okText') }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script lang="ts" setup>
import { ref, onUnmounted, watch } from 'vue';
import Modal from '../../../components/NEUIKit/CommonComponents/Modal.vue';
import Button from '../../../components/NEUIKit/CommonComponents/Button.vue';
import Icon from '../../../components/NEUIKit/CommonComponents/Icon.vue';
import { t } from '../../../components/NEUIKit/utils/i18n';

interface Props {
  visible: boolean;
}

interface Emits {
  (e: 'close-action-selected', action: 'minimize' | 'quit' | 'cancel', remember: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
});

const emit = defineEmits<Emits>();

const rememberChoice = ref(false);
const selectedAction = ref<'minimize' | 'quit'>('quit');

const handleConfirm = () => {
  emit('close-action-selected', selectedAction.value, rememberChoice.value);
  rememberChoice.value = false;
  selectedAction.value = 'quit';
};

const handleCancel = () => {
  // 取消时触发 cancel action，不保存任何配置
  emit('close-action-selected', 'cancel', false);
  // 重置状态
  rememberChoice.value = false;
  selectedAction.value = 'quit';
};

// ESC 键监听
const handleKeyDown = (event: KeyboardEvent) => {
  if (props.visible && event.key === 'Escape') {
    event.preventDefault();
    handleCancel();
  }
};

// 监听 visible 变化，添加/移除键盘监听
watch(() => props.visible, (newValue) => {
  if (newValue) {
    document.addEventListener('keydown', handleKeyDown);
  } else {
    document.removeEventListener('keydown', handleKeyDown);
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped lang="scss">
.close-confirmation-wrapper {
  padding: 10px 20px 0;

  .content-wrapper {
    display: flex;
    gap: 12px;
    align-items: flex-start;

    .warning-icon {
      flex-shrink: 0;
      margin-top: 2px;
    }

    .right-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .message {
        font-size: 14px;
        color: #333;
        line-height: 1.5;
        margin-bottom: 0;
      }

      .radio-group {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .radio-item {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;

          input[type="radio"] {
            width: 16px;
            height: 16px;
            cursor: pointer;
            margin: 0;
          }

          .radio-label {
            font-size: 14px;
            color: #333;
            line-height: 1.4;
          }
        }
      }
    }
  }
}

.custom-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0 0 12px;
  border-top: 1px solid #e8e8e8;
  margin: 0;

  .remember-choice {
    display: flex;
    align-items: center;
    gap: 6px;

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      cursor: pointer;
      margin: 0;
    }

    label {
      font-size: 13px;
      color: #666;
      cursor: pointer;
      user-select: none;
    }
  }

  .footer-buttons {
    display: flex;
    gap: 8px;
  }
}
</style>
