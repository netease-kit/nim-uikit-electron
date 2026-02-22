<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { t } from '@/components/NEUIKit/utils/i18n'

const router = useRouter()

// 从 package.json 读取的应用信息
const appInfo = ref({
  name: '云信 IM UIKit',
  version: '0.1.0',
  description: '网易云信 Electron IMUIKit',
  author: 'Yunxin',
  email: 'im@service.netease.com',
  homepage: 'https://yunxin.163.com',
})

const handleBack = () => {
  router.back()
}
</script>

<template>
  <div class="about-page">
    <div class="about-container">
      <div class="about-header">
        <img src="/logo.png" alt="Logo" class="about-logo" />
        <h1 class="about-title">{{ appInfo.name }}</h1>
        <p class="about-version">{{ t('aboutVersionText') }} {{ appInfo.version }}</p>
      </div>

      <div class="about-content">
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

      <div class="about-footer">
        <button class="back-button" @click="handleBack">{{ t('aboutBackText') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.about-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.about-container {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  padding: 48px 40px;
  animation: fadeIn 0.4s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.about-header {
  text-align: center;
  margin-bottom: 40px;
  padding-bottom: 32px;
  border-bottom: 1px solid #e0e0e0;
}

.about-logo {
  width: 96px;
  height: 96px;
  margin-bottom: 20px;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.about-title {
  font-size: 28px;
  font-weight: 600;
  color: #333333;
  margin: 0 0 8px 0;
}

.about-version {
  font-size: 14px;
  color: #666666;
  margin: 0;
}

.about-content {
  margin-bottom: 32px;
}

.about-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 16px;
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

.about-footer {
  display: flex;
  justify-content: center;
  padding-top: 32px;
  border-top: 1px solid #e0e0e0;
}

.back-button {
  padding: 12px 32px;
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
