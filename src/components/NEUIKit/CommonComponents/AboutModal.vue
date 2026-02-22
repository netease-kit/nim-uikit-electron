<template>
  <Modal
    :visible="visible"
    :title="t('trayAboutText')"
    :show-default-footer="false"
    :show-close="true"
    :mask-closable="true"
    :width="600"
    @update:visible="handleClose"
  >
    <div class="about-modal-content">
      <div class="about-header">
        <img src="/logo.png" alt="Logo" class="about-logo" />
        <h2 class="about-title">{{ appInfo.name }}</h2>
        <p class="about-version">{{ t('aboutVersionText') }}: {{ appInfo.version }}</p>
      </div>

      <div class="about-body">
        <div class="about-section">
          <h3 class="section-title">{{ t('aboutDescriptionText') }}</h3>
          <p class="section-text">{{ appInfo.description }}</p>
        </div>

        <div class="about-section">
          <h3 class="section-title">{{ t('aboutDeveloperText') }}</h3>
          <p class="section-text">{{ appInfo.author }}</p>
        </div>

        <div class="about-section">
          <h3 class="section-title">{{ t('aboutContactText') }}</h3>
          <p class="section-text">
            <a :href="`mailto:${appInfo.email}`" class="about-link">{{ appInfo.email }}</a>
          </p>
        </div>

        <div class="about-section">
          <h3 class="section-title">{{ t('aboutWebsiteText') }}</h3>
          <p class="section-text">
            <a :href="appInfo.homepage" target="_blank" class="about-link">{{ appInfo.homepage }}</a>
          </p>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Modal from '@/components/NEUIKit/CommonComponents/Modal.vue'
import { t } from '@/components/NEUIKit/utils/i18n'

interface Props {
  visible: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

// 应用信息
const appInfo = ref({
  name: '云信 IM UIKit',
  version: '0.1.0',
  description: '网易云信 Electron IMUIKit',
  author: 'Yunxin',
  email: 'im@service.netease.com',
  homepage: 'https://yunxin.163.com',
})

// 从主进程获取版本号
onMounted(async () => {
  try {
    if (window.electronAPI) {
      const version = await window.electronAPI.version.getAppVersion()
      if (version) {
        appInfo.value.version = version
      }
    }
  } catch (error) {
    console.error('Failed to get app version:', error)
  }
})

const handleClose = () => {
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.about-modal-content {
  padding: 20px;
}

.about-header {
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e0e0e0;
}

.about-logo {
  width: 80px;
  height: 80px;
  margin-bottom: 16px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.about-title {
  font-size: 24px;
  font-weight: 600;
  color: #333333;
  margin: 0 0 8px 0;
}

.about-version {
  font-size: 14px;
  color: #666666;
  margin: 0;
}

.about-body {
  margin-bottom: 16px;
}

.about-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333333;
  margin: 0 0 8px 0;
}

.section-text {
  font-size: 14px;
  color: #666666;
  margin: 0;
  line-height: 1.6;
}

.about-link {
  color: #667eea;
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: #764ba2;
    text-decoration: underline;
  }
}
</style>
