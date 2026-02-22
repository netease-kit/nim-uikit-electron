<template>
  <Modal
    v-if="visible"
    :visible="visible"
    :title="t('transformTeam')"
    :confirmText="t('confirmText')"
    :cancelText="t('cancelText')"
    :width="800"
    :height="600"
    :showDefaultFooter="true"
    :confirmDisabled="!selectedAccount"
    @confirm="handleTransfer"
    @cancel="handleClose"
    @close="handleClose"
  >
    <div class="transfer-owner-content">
      <!-- 左右分栏主内容 -->
      <div class="main-content">
        <!-- 左侧:群成员选择 + 搜索 -->
        <div class="left-panel">
          <div class="section-header">
            <span class="section-title">{{ t("teamMemberText") }}</span>
          </div>
          <div class="section-header">
            <Input
              :modelValue="searchKey"
              :placeholder="t('searchTeamMemberPlaceholder')"
              :showClear="searchKey.length > 0"
              @update:modelValue="onSearchChange"
              :inputStyle="{
                backgroundColor: '#F5F7FA',
                padding: '7px',
              }"
            />
          </div>
          <div class="person-select-container">
            <PersonSelect
              :personList="personListToRender"
              :selected="selectedAccount ? [selectedAccount] : []"
              @update:selected="onSelectedUpdate"
              @checkboxChange="onSelectedUpdate"
              :radio="true"
              :showBtn="false"
              avatarSize="32"
              :emptyText="t('searchNoResText')"
            />
          </div>
        </div>

        <!-- 右侧:已选成员 -->
        <div class="right-panel">
          <div class="selected-friends-section">
            <div class="selected-header">
              <span class="selected-count">
                {{ t("selectedText") }}: {{ selectedAccount ? 1 : 0 }}
                {{ t("personUnit") }}
              </span>
            </div>
            <div class="selected-friends-container">
              <div v-if="selectedAccount" class="selected-friends-list">
                <div class="selected-friend-item">
                  <Avatar class="selected-avatar" size="32" :account="selectedAccount" />
                  <div class="selected-friend-info">
                    <Appellation
                      class="selected-friend-name"
                      :account="selectedAccount"
                      :teamId="teamId"
                      :fontSize="14"
                    />
                  </div>
                  <div class="remove-selected-icon" @click="handleRemoveSelected">
                    <Icon type="icon-guanbi" :size="14" color="#999" />
                  </div>
                </div>
              </div>
              <div v-else class="empty-selected">
                <div class="empty-text">{{ t("pleaseSelectMember") }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script lang="ts" setup>
/** 转让群主弹窗组件 */
import Modal from "../../../CommonComponents/Modal.vue";
import PersonSelect, { type PersonSelectItem } from "../../../CommonComponents/PersonSelect.vue";
import Input from "../../../CommonComponents/Input.vue";
import Avatar from "../../../CommonComponents/Avatar.vue";
import Appellation from "../../../CommonComponents/Appellation.vue";
import Icon from "../../../CommonComponents/Icon.vue";
import { ref, computed, onMounted, onUnmounted } from "vue";
import { autorun } from "mobx";
import { t } from "../../../utils/i18n";
import { toast } from "../../../utils/toast";
import { V2NIMConst } from "../../../utils/constants";
import type { V2NIMTeamMember } from "node-nim/types/v2_def/v2_nim_struct_def";
import { getContextState } from "../../../utils/init";

interface Props {
  visible: boolean;
  teamId: string;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  "update:visible": [visible: boolean];
  close: [];
  success: [];
}>();

const { store } = getContextState();

// 原始成员列表
const personListRaw = ref<PersonSelectItem[]>([]);
// 搜索关键字
const searchKey = ref<string>("");
// 已选成员(单选,只有一个)
const selectedAccount = ref<string>("");

// 过滤后的成员列表
const filteredPersonList = computed(() => {
  const key = searchKey.value.trim().toLowerCase();
  if (!key) return personListRaw.value;
  return personListRaw.value.filter((p) => {
    const name = (
      store?.uiStore.getAppellation({
        account: p.accountId,
        teamId: props.teamId,
      }) || ""
    ).toLowerCase();
    return name.includes(key);
  });
});

// 传给 PersonSelect 的最终列表(包含 checked)
const personListToRender = computed<PersonSelectItem[]>(() =>
  filteredPersonList.value.map((p) => ({
    ...p,
    checked: selectedAccount.value === p.accountId,
  }))
);

let uninstallTeamMemberWatch = () => {};

const handleClose = () => {
  emit("close");
  emit("update:visible", false);
};

const onSearchChange = (val: string) => {
  searchKey.value = val;
};

// 单选更新入口
const onSelectedUpdate = (next: string[]) => {
  // 单选模式:只取第一个
  selectedAccount.value = next.length > 0 ? next[0] : "";
};

// 移除已选成员
const handleRemoveSelected = () => {
  selectedAccount.value = "";
};

// 转让群主
const handleTransfer = async () => {
  if (!selectedAccount.value) {
    toast.info(t("pleaseSelectMember"));
    return;
  }

  // 直接执行转让,不再需要二次确认
  try {
    await store?.teamStore.transferTeamActive({
      teamId: props.teamId,
      account: selectedAccount.value,
      leave: false,
      type: V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
    });
    toast.success(t("transformTeamSuccessText"));
    // 仅关闭弹窗,不触发 success 事件,保持在群设置页面
    handleClose();
  } catch (error) {
    toast.error(t("transformTeamFailedText"));
  }
};

onMounted(() => {
  // 同步当前群成员,展示所有成员,但标记群主和 AI 用户为不可选
  uninstallTeamMemberWatch = autorun(() => {
    const members = store?.teamMemberStore.getTeamMember(props.teamId) || [];
    const myAccountId = store?.userStore.myUserInfo.accountId;

    // 1. 先过滤有效成员
    const validMembers = members.filter((m: V2NIMTeamMember) => {
      // 必须有 accountId
      if (!m.accountId) return false;
      return true;
    });

    // 2. 按角色分组并排序
    const owner = validMembers.filter(
      (m) => m.memberRole === V2NIMConst.V2NIMTeamMemberRole.V2NIM_TEAM_MEMBER_ROLE_OWNER
    );
    const managers = validMembers
      .filter((m) => m.memberRole === V2NIMConst.V2NIMTeamMemberRole.V2NIM_TEAM_MEMBER_ROLE_MANAGER)
      .sort((a, b) => (a.joinTime || 0) - (b.joinTime || 0));
    const others = validMembers
      .filter(
        (m) =>
          m.memberRole !== V2NIMConst.V2NIMTeamMemberRole.V2NIM_TEAM_MEMBER_ROLE_OWNER &&
          m.memberRole !== V2NIMConst.V2NIMTeamMemberRole.V2NIM_TEAM_MEMBER_ROLE_MANAGER
      )
      .sort((a, b) => (a.joinTime || 0) - (b.joinTime || 0));

    // 3. 合并排序结果:群主 -> 管理员 -> 其他成员
    const sortedMembers = [...owner, ...managers, ...others];

    // 4. 转换为 PersonSelectItem 并标记 disabled
    const items: PersonSelectItem[] = sortedMembers.map((m: V2NIMTeamMember) => {
      // 判断是否需要禁用
      const isOwner = m.memberRole === V2NIMConst.V2NIMTeamMemberRole.V2NIM_TEAM_MEMBER_ROLE_OWNER;
      const isAIUser = store?.aiUserStore.aiUsers.has(m.accountId as string);
      const isMyself = m.accountId === myAccountId;

      return {
        accountId: m.accountId!,
        teamId: props.teamId,
        checked: false,
        // 群主、AI 用户、自己 都标记为不可选
        disabled: isOwner || isAIUser || isMyself,
      };
    });

    personListRaw.value = items;

    // 5. 校验已选成员是否仍在列表中,如果不在则清空选择
    if (selectedAccount.value) {
      const isStillInList = items.some((item) => item.accountId === selectedAccount.value);
      if (!isStillInList) {
        // 已选成员已退出群聊,清空选择
        selectedAccount.value = "";
      }
    }
  });
});

onUnmounted(() => {
  uninstallTeamMemberWatch();
});
</script>

<style scoped>
.transfer-owner-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 470px;
  overflow-y: hidden;
}

/* 主内容:左右分栏 */
.main-content {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 450px;
  padding: 0 20px;
}

/* 左侧 */
.left-panel {
  flex: 1;
  min-width: 0;
}

.left-panel :deep(.empty-wrapper) {
  margin-top: 50px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  background-color: #fff;
  z-index: 10;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.person-select-container {
  flex: 1;
  overflow-y: auto;
  max-height: calc(100% - 100px);
}

.selected-count {
  font-size: 12px;
  color: #666;
  background-color: #f0f0f0;
  padding: 2px 8px;
  border-radius: 8px;
  white-space: nowrap;
}

/* 右侧 */
.right-panel {
  flex: 1;
  border-left: 1px solid #f0f0f0;
  padding-left: 20px;
}

.selected-friends-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.selected-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.selected-friends-container {
  flex: 1;
  overflow-y: auto;
}

.selected-friends-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-friend-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s;
  position: relative;
  background-color: #f5f5f5;
}

.selected-avatar {
  margin-right: 12px;
  flex-shrink: 0;
}

.selected-friend-info {
  flex: 1;
  min-width: 0;
}

.selected-friend-name {
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
}

.empty-text {
  font-size: 14px;
}

.remove-selected-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: 8px;
}

.remove-selected-icon:hover {
  background-color: #e5e5e5;
}
</style>
