<template>
  <label class="switch-wrapper" :class="{ disabled }" @click.prevent="handleClick">
    <input
      type="checkbox"
      class="switch-input"
      :checked="checked"
      :disabled="disabled"
      @click.prevent
    />
    <div class="switch-core"></div>
  </label>
</template>

<script lang="ts" setup>
const props = defineProps<{
  checked: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "change", value: boolean): void;
}>();

const handleClick = () => {
  if (props.disabled) return;
  // 只触发事件，不改变内部状态，让父组件决定是否更新 checked
  emit("change", !props.checked);
};
</script>

<style scoped>
.switch-wrapper {
  display: inline-block;
  position: relative;
  cursor: pointer;
}

.switch-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}

.switch-core {
  display: inline-block;
  position: relative;
  width: 44px;
  height: 22px;
  border: 1px solid #dcdfe6;
  outline: none;
  border-radius: 11px;
  box-sizing: border-box;
  background: #dcdfe6;
  cursor: pointer;
  transition:
    border-color 0.3s,
    background-color 0.3s;
}

.switch-core::after {
  content: "";
  position: absolute;
  top: 1px;
  left: 1px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #fff;
  transition: all 0.3s;
}

.switch-input:checked + .switch-core {
  background-color: #337eff;
  border-color: #337eff;
}

.switch-input:checked + .switch-core::after {
  left: 100%;
  transform: translateX(-19px);
}

.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.disabled .switch-core {
  cursor: not-allowed;
}
</style>
