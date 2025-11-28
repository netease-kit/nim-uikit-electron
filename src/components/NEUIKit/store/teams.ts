import RootStore from ".";
import { makeAutoObservable } from "mobx";
import { LocalOptions } from "./types";
import { V2NIMConst } from "../utils/constants";

import {
  V2NIMTeam,
  V2NIMTeamJoinActionInfo,
  V2NIMTeamJoinActionInfoQueryOption,
  V2NIMTeamJoinActionInfoResult,
  V2NIMTeamMember,
  V2NIMUpdateTeamInfoParams,
  V2NIMError,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import {
  V2NIMTeamAgreeMode,
  V2NIMTeamChatBannedMode,
  V2NIMTeamJoinMode,
  V2NIMTeamMemberRole,
  V2NIMTeamType,
  V2NIMTeamUpdateExtensionMode,
  V2NIMTeamUpdateInfoMode,
  V2NIMTeamInviteMode,
  V2NIMClient,
  V2NIMTeamMessageMuteMode,
} from "node-nim";
import * as storeUtils from "./utils";

/**Mobx 可观察对象，负责管理群组的子 store */
export class TeamStore {
  teams: Map<string, V2NIMTeam> = new Map();
  logger: typeof storeUtils.logger | null = null;

  constructor(
    private rootStore: RootStore,
    private nim: V2NIMClient,
    private localOptions: LocalOptions
  ) {
    makeAutoObservable(this);
    this.logger = rootStore.logger;

    this._onReceiveTeamJoinActionInfo =
      this._onReceiveTeamJoinActionInfo.bind(this);
    this._onSyncFailed = this._onSyncFailed.bind(this);
    this._onSyncFinished = this._onSyncFinished.bind(this);
    this._onSyncStarted = this._onSyncStarted.bind(this);
    this._onTeamCreated = this._onTeamCreated.bind(this);
    this._onTeamDismissed = this._onTeamDismissed.bind(this);
    this._onTeamInfoUpdated = this._onTeamInfoUpdated.bind(this);
    this._onTeamJoined = this._onTeamJoined.bind(this);
    this._onTeamLeft = this._onTeamLeft.bind(this);
    this._onTeamMemberInfoUpdated = this._onTeamMemberInfoUpdated.bind(this);
    this._onTeamMemberJoined = this._onTeamMemberJoined.bind(this);
    this._onTeamMemberKicked = this._onTeamMemberKicked.bind(this);
    this._onTeamMemberLeft = this._onTeamMemberLeft.bind(this);

    /** 群组申请动作回调 */
    nim.teamService?.on(
      "receiveTeamJoinActionInfo",
      this._onReceiveTeamJoinActionInfo
    );
    /** 群组信息数据同步失败 */
    nim.teamService?.on("syncFailed", this._onSyncFailed);
    /** 群组信息数据同步完成 */
    nim.teamService?.on("syncFinished", this._onSyncFinished);
    /** 群组信息数据同步开始 */
    nim.teamService?.on("syncStarted", this._onSyncStarted);
    /** 创建群组回调 */
    nim.teamService?.on("teamCreated", this._onTeamCreated);
    /** 解散群组回调 */
    nim.teamService?.on("teamDismissed", this._onTeamDismissed);
    /** 更新群组信息回调 */
    nim.teamService?.on("teamInfoUpdated", this._onTeamInfoUpdated);
    /** 自己被邀请后接受邀请， 或申请通过，或直接被拉入群组回调 */
    nim.teamService?.on("teamJoined", this._onTeamJoined);
    /** 自己主动离开群组或被管理员踢出回调 */
    nim.teamService?.on("teamLeft", this._onTeamLeft);
    /** 群组成员信息更新回调 */
    nim.teamService?.on("teamMemberInfoUpdated", this._onTeamMemberInfoUpdated);
    /** 群组成员加入回调(非自己) */
    nim.teamService?.on("teamMemberJoined", this._onTeamMemberJoined);
    /** 群组成员被踢回调(非自己) */
    nim.teamService?.on("teamMemberKicked", this._onTeamMemberKicked);
    /** 群组成员离开回调(非自己) */
    nim.teamService?.on("teamMemberLeft", this._onTeamMemberLeft);
    /** 监听群消息免打扰模式变更事件 */
    nim.settingService?.on(
      "teamMessageMuteModeChanged",
      this._onTeamMessageMuteModeChanged
    );
  }

  resetState(): void {
    this.teams.clear();
  }

  /**
   * 销毁TeamStore，会取消群组相关事件监听
   */
  destroy(): void {
    this.resetState();
    this.nim.teamService?.off(
      "receiveTeamJoinActionInfo",
      this._onReceiveTeamJoinActionInfo
    );
    this.nim.teamService?.off("syncFailed", this._onSyncFailed);
    this.nim.teamService?.off("syncFinished", this._onSyncFinished);
    this.nim.teamService?.off("syncStarted", this._onSyncStarted);
    this.nim.teamService?.off("teamCreated", this._onTeamCreated);
    this.nim.teamService?.off("teamDismissed", this._onTeamDismissed);
    this.nim.teamService?.off("teamInfoUpdated", this._onTeamInfoUpdated);
    this.nim.teamService?.off("teamJoined", this._onTeamJoined);
    this.nim.teamService?.off("teamLeft", this._onTeamLeft);
    this.nim.teamService?.off(
      "teamMemberInfoUpdated",
      this._onTeamMemberInfoUpdated
    );
    this.nim.teamService?.off("teamMemberJoined", this._onTeamMemberJoined);
    this.nim.teamService?.off("teamMemberKicked", this._onTeamMemberKicked);
    this.nim.teamService?.off("teamMemberLeft", this._onTeamMemberLeft);
    this.nim.settingService?.off(
      "teamMessageMuteModeChanged",
      this._onTeamMessageMuteModeChanged
    );
  }

  /**
   * TeamStore 内存中增加群组
   * @param teams - 群组
   */
  addTeam(teams: V2NIMTeam[]): void {
    teams
      .filter((item) => !!item.isValidTeam)
      .filter((item) => !!item.teamId)
      .forEach((item) => {
        this.teams.set(item.teamId as string, item);
      });
  }

  /**
   * TeamStore 内存中移除群组
   * @param teamIds - 群id数组
   */
  removeTeam(teamIds: string[]): void {
    teamIds.forEach((item) => {
      this.teams.delete(item);
    });
  }

  /**
   * TeamStore 内存中更新群组
   * @param data - 群组信息
   */
  updateTeam(data: Partial<V2NIMTeam>[]): void {
    data
      .filter((item) => !!item.teamId)
      .forEach((item) => {
        const oldTeam = this.teams.get(item.teamId!);

        if (oldTeam) {
          const newTeam = { ...oldTeam, ...item };

          this.teams.set(item.teamId!, newTeam);
        }
      });
  }

  /**
   * 创建群
   * @param __namedParameters.accounts - 要拉进群的成员的帐号列表
   * @param __namedParameters.type - 群类型，默认高级群
   * @param __namedParameters.avatar - 群头像
   * @param __namedParameters.name - 群名称
   * @param __namedParameters.intro - 群简介
   * @param __namedParameters.serverExtension - 群扩展字段
   */
  async createTeamActive({
    accounts,
    type = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
    avatar,
    name,
    intro,
    serverExtension,
    joinMode,
    agreeMode,
    inviteMode,
    updateInfoMode,
    updateExtensionMode,
  }: {
    accounts: string[];
    type?: V2NIMTeamType;
    avatar: string;
    name: string;
    intro?: V2NIMTeam["intro"];
    serverExtension?: V2NIMTeam["serverExtension"];
    joinMode?: V2NIMTeamJoinMode;
    agreeMode?: V2NIMTeamAgreeMode;
    inviteMode?: V2NIMTeamInviteMode;
    updateInfoMode?: V2NIMTeamUpdateInfoMode;
    updateExtensionMode?: V2NIMTeamUpdateExtensionMode;
  }): Promise<V2NIMTeam> {
    try {
      this.logger?.log("createTeamActive", {
        accounts,
        type,
        avatar,
        name,
        intro,
        serverExtension,
      });
      const { team } = await this.nim.teamService?.createTeam(
        {
          avatar,
          teamType: type,
          joinMode: joinMode || this.localOptions.teamJoinMode,
          agreeMode: agreeMode || this.localOptions.teamAgreeMode,
          inviteMode: inviteMode || this.localOptions.teamInviteMode,
          updateInfoMode:
            updateInfoMode || this.localOptions.teamUpdateTeamMode,
          updateExtensionMode:
            updateExtensionMode || this.localOptions.teamUpdateExtMode,
          name,
          intro,
          serverExtension,
        },
        accounts,
        "",
        {}
      );

      this.logger?.log("createTeamActive success", team);
      return team;
    } catch (error: any) {
      this.logger?.error(
        "createTeamActive failed: ",
        { accounts, type, avatar, name, intro, serverExtension },
        error,
        error.code,
        error.detail
      );
      throw error;
    }
  }

  /**
   * 申请入群
   * @param teamId - 群id
   * @param type - 群类型，默认高级群
   */
  async applyTeamActive(
    teamId: string,
    type: V2NIMTeamType = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL
  ): Promise<V2NIMTeam> {
    try {
      this.logger?.log("applyTeamActive", teamId);
      const team = await this.nim.teamService?.applyJoinTeam(teamId, type, "");

      this.logger?.log("applyTeamActive success", teamId);

      return team;
    } catch (error) {
      this.logger?.error("applyTeamActive failed: ", teamId, error);
      throw error;
    }
  }

  /**
   * 主动退群
   * @param teamId - 群id
   * @param type - 群类型，默认高级群
   */
  async leaveTeamActive(
    teamId: string,
    type: V2NIMTeamType = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL
  ): Promise<void> {
    try {
      this.logger?.log("leaveTeamActive", teamId);
      await this.nim.teamService?.leaveTeam(teamId, type);
      this.logger?.log("leaveTeamActive success", teamId);
    } catch (error) {
      this.logger?.error("leaveTeamActive failed: ", teamId, error);
      throw error;
    }
  }

  /**
   * 解散群
   * @param teamId - 群id
   * @param type - 群类型，默认高级群
   */
  async dismissTeamActive(
    teamId: string,
    type: V2NIMTeamType = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL
  ): Promise<void> {
    try {
      this.logger?.log("dismissTeamActive", teamId);
      await this.nim.teamService?.dismissTeam(teamId, type);
      // 会收到一条 onDissmiss 事件
      this.logger?.log("dismissTeamActive success", teamId);
    } catch (error) {
      this.logger?.error("dismissTeamActive failed: ", teamId, error);
      throw error;
    }
  }

  /**
   * 转让群主
   * @param teamId - 群id
   * @param type - 群类型，默认高级群
   * @param account - 新群主帐号
   * @param leave - 是否同时退出群聊，默认 false
   */
  async transferTeamActive({
    teamId,
    type = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
    account,
    leave,
  }: {
    teamId: string;
    type?: V2NIMTeamType;
    account: string;
    leave?: boolean;
  }): Promise<void> {
    try {
      this.logger?.log("transferTeamActive", { teamId, type, account, leave });
      await this.nim.teamService?.transferTeamOwner(
        teamId,
        type,
        account,
        leave ?? (this.localOptions.leaveOnTransfer as boolean)
      );
      this.logger?.log("transferTeamActive success", {
        teamId,
        type,
        account,
        leave,
      });
    } catch (error) {
      this.logger?.error(
        "transferTeamActive failed: ",
        { teamId, type, account, leave },
        error
      );
      throw error;
    }
  }

  /**
   * 群禁言
   * @param options
   * options.teamId - 群id <br>
   * options.type - 群类型，默认高级群 <br>
   * options.chatBannedMode - 禁言模式
   */
  async setTeamChatBannedActive(options: {
    teamId: string;
    type?: V2NIMTeamType;
    chatBannedMode: V2NIMTeamChatBannedMode;
  }): Promise<void> {
    try {
      this.logger?.log("muteTeamActive", options);
      await this.nim.teamService?.setTeamChatBannedMode(
        options.teamId,
        options.type || V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
        options.chatBannedMode
      );
      this.logger?.log("muteTeamActive success", options);
    } catch (error) {
      this.logger?.error("muteTeamActive failed: ", options, error);
      throw error;
    }
  }

  /**
   * 更新群
   * @param options
   * options.teamId - 群id <br>
   * options.type - 群类型，默认高级群  <br>
   * options.info - 群信息 <br>
   */
  async updateTeamActive(options: {
    teamId: string;
    type?: V2NIMTeamType;
    info: V2NIMUpdateTeamInfoParams;
  }): Promise<void> {
    try {
      this.logger?.log("updateTeamActive", options);
      const {
        teamId,
        type = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
        info,
      } = options;

      await this.nim.teamService?.updateTeamInfo(teamId, type, info, {});
      // 后续在事件中处理
      this.logger?.log("updateTeamActive success", options);
    } catch (error) {
      this.logger?.error("updateTeamActive failed: ", options, error);
      throw error;
    }
  }

  /**
   * 从内存中获取群信息
   * @param teamId - 群id
   * @param type - 群类型，默认高级群
   */
  async getTeamActive(
    teamId: string,
    type: V2NIMTeamType = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL
  ): Promise<V2NIMTeam> {
    this.logger?.log("getTeamActive: ", teamId);
    let team = this.teams.get(teamId);

    if (team) {
      return team;
    }

    team = await this.getTeamForceActive(teamId, type);
    this.addTeam([team]);
    return team;
  }

  /**
   * 从服务端获取群信息
   * @param teamId - 群id
   * @param type - 群类型，默认高级群
   */
  async getTeamForceActive(
    teamId: string,
    type: V2NIMTeamType = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL
  ): Promise<V2NIMTeam> {
    try {
      this.logger?.log("getTeamForceActive: ", teamId);
      const res = await this.nim.teamService?.getTeamInfo(teamId, type);

      this.logger?.log("getTeamForceActive success", res);
      // 这里不能存入 teamStore，因为 teamStore 只有在群中的内容
      return res;
    } catch (error) {
      this.logger?.error("getTeamForceActive failed: ", teamId, error);
      throw error;
    }
  }

  /**
   * 设置群消息免打扰
   * @param teamId - 群id
   * @param teamType - 群类型，默认高级群
   * @param muteMode - 消息免打扰模式
   */
  async setTeamMessageMuteModeActive(
    teamId: string,
    teamType: V2NIMTeamType,
    muteMode: V2NIMTeamMessageMuteMode
  ): Promise<void> {
    try {
      this.logger?.log("setTeamMessageMuteModeActive", {
        teamId,
        teamType,
        muteMode,
      });
      await this.nim.settingService?.setTeamMessageMuteMode(
        teamId,
        teamType,
        muteMode
      );

      this.logger?.log("setTeamMessageMuteModeActive success", {
        teamId,
        teamType,
        muteMode,
      });
    } catch (error) {
      this.logger?.error(
        "setTeamMessageMuteModeActive failed: ",
        { teamId, teamType, muteMode },
        error
      );
      throw error;
    }
  }

  /**
   * 被邀请者接受入群邀请
   * @param options V2NIMTeamJoinActionInfo
   */
  async acceptTeamInviteActive(
    options: V2NIMTeamJoinActionInfo
  ): Promise<void> {
    try {
      this.logger?.log("acceptTeamInviteActive: ", options);
      await this.nim.teamService?.acceptInvitation(options);
      this.logger?.log("acceptTeamInviteActive success", options);
    } catch (error) {
      this.logger?.error("acceptTeamInviteActive failed: ", options, error);
      throw error;
    }
  }

  /**
   * 被邀请者拒绝入群邀请
   * @param options V2NIMTeamJoinActionInfo
   */
  async rejectTeamInviteActive(
    options: V2NIMTeamJoinActionInfo
  ): Promise<void> {
    try {
      this.logger?.log("rejectTeamInviteActive: ", options);
      await this.nim.teamService?.rejectInvitation(options, "");
      this.logger?.log("rejectTeamInviteActive success", options);
    } catch (error) {
      this.logger?.error("rejectTeamInviteActive failed: ", options, error);
      throw error;
    }
  }

  /**
   * 管理员通过入群申请
   * @param options V2NIMTeamJoinActionInfo
   */
  async acceptJoinApplicationActive(
    options: V2NIMTeamJoinActionInfo
  ): Promise<void> {
    try {
      this.logger?.log("acceptJoinApplicationActive: ", options);
      await this.nim.teamService?.acceptJoinApplication(options);
      this.logger?.log("acceptJoinApplicationActive success", options);
    } catch (error) {
      this.logger?.error(
        "acceptJoinApplicationActive failed: ",
        options,
        error
      );
      throw error;
    }
  }

  /**
   * 管理员拒绝入群申请
   * @param options V2NIMTeamJoinActionInfo
   */
  async rejectTeamApplyActive(options: V2NIMTeamJoinActionInfo): Promise<void> {
    try {
      this.logger?.log("rejectTeamApplyActive: ", options);
      await this.nim.teamService?.rejectJoinApplication(options, "");
      this.logger?.log("rejectTeamApplyActive success", options);
    } catch (error) {
      this.logger?.error("rejectTeamApplyActive failed: ", options, error);
      throw error;
    }
  }

  /**
   * 设置成员角色
   * @param options
   * options.teamId - 群id <br>
   * options.type - 群类型，默认高级群 <br>
   * options.accounts - 群管理员 accid
   * options.role - 角色
   */
  async updateTeamMemberRoleActive(options: {
    teamId: string;
    type?: V2NIMTeamType;
    accounts: string[];
    role: V2NIMTeamMemberRole;
  }): Promise<void> {
    try {
      this.logger?.log("addTeamManagersActive: ", options);
      const {
        teamId,
        type = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
        accounts,
        role,
      } = options;

      await this.nim.teamService?.updateTeamMemberRole(
        teamId,
        type,
        accounts,
        role
      );
      this.logger?.log("addTeamManagersActive success", options);
    } catch (error) {
      this.logger?.error("addTeamManagersActive failed: ", options, error);
      throw error;
    }
  }

  /** 获取群组申请动作信息 */
  async getTeamJoinActionInfoListActive(
    options: V2NIMTeamJoinActionInfoQueryOption
  ): Promise<V2NIMTeamJoinActionInfoResult> {
    try {
      this.logger?.log("getTeamJoinActionInfoListActive: ", options);
      const res = await this.nim.teamService?.getTeamJoinActionInfoList(
        options
      );
      this.rootStore.sysMsgStore.addTeamJoinActionMsg(res.infos);
      this.logger?.log("getTeamJoinActionInfoListActive success", res);
      return res;
    } catch (error) {
      this.logger?.error(
        "getTeamJoinActionInfoListActive failed: ",
        options,
        error
      );
      throw error;
    }
  }

  /** 获取已加入的群组列表 */
  async getJoinedTeamListActive(): Promise<V2NIMTeam[]> {
    try {
      this.logger?.log("getJoinedTeamListActive");
      const teams = await this.nim.teamService?.getJoinedTeamList([1]);

      this.addTeam(teams as V2NIMTeam[]);
      this.logger?.log("getJoinedTeamListActive success", teams);
      return teams as V2NIMTeam[];
    } catch (error) {
      this.logger?.error("getJoinedTeamListActive failed: ", error);
      throw error;
    }
  }

  /**
   * 获取群消息免打扰状态
   * @param teamId - 群id <br>
   * @param teamType - 群组类型，包括高级群和超大群。 <br>
   */

  async getTeamMessageMuteModeActive(
    teamId: string,
    teamType: V2NIMTeamType
  ): Promise<V2NIMTeamMessageMuteMode> {
    try {
      this.logger?.log("getTeamMessageMuteModeActive", teamId, teamType);
      const muteMode = await this.nim.settingService?.getTeamMessageMuteMode(
        teamId,
        teamType
      );

      this.logger?.log(
        "getTeamMessageMuteModeActive success",
        teamId,
        teamType
      );
      return muteMode;
    } catch (error) {
      this.logger?.error(
        "getTeamMessageMuteModeActive failed: ",
        teamId,
        teamType,
        error
      );
      throw error;
    }
  }

  private _onReceiveTeamJoinActionInfo(data: V2NIMTeamJoinActionInfo) {
    this.logger?.log("_onReceiveTeamJoinActionInfo: ", data);
    this.rootStore.sysMsgStore.addTeamJoinActionMsg([data]);
  }

  private _onSyncFailed(data: V2NIMError) {
    this.logger?.log("teamService _onSyncFailed: ", data);
  }

  private async _onSyncFinished() {
    // 获取会话列表
    this.rootStore.conversationStore?.getConversationListActive(
      0,
      this.rootStore.localOptions.conversationLimit || 100
    );
    this.logger?.log("teamService _onSyncFinished");
  }

  private _onSyncStarted() {
    this.logger?.log("teamService _onSyncStarted");
  }

  private _onTeamCreated(data: V2NIMTeam) {
    this.logger?.log("teamService _onTeamCreated: ", data);
    this.addTeam([data]);
    // 不用自己插入会话了，因为 SDK 会有会话创建回调
  }

  private _onTeamDismissed(data: { teamId: string }) {
    this.logger?.log("teamService _onTeamDismissed: ", data);
    this._handleRemoveTeam(data.teamId);
  }

  private _onTeamInfoUpdated(data: V2NIMTeam) {
    this.logger?.log("teamService _onTeamInfoUpdated: ", data);
    this.updateTeam([data]);
  }

  private _onTeamJoined(data: V2NIMTeam) {
    this.logger?.log("teamService _onTeamJoined: ", data);
    this.addTeam([data]);
    // 不用自己插入会话了，因为 SDK 会有会话创建回调
  }

  private async _onTeamLeft(data: { teamId: string }) {
    this.logger?.log("teamService _onTeamLeft: ", data);
    this._handleRemoveTeam(data.teamId);
  }

  private _onTeamMemberInfoUpdated(data: V2NIMTeamMember[]) {
    this.logger?.log("teamService _onTeamMemberInfoUpdated: ", data);
    const teamId = data[0].teamId;

    this.rootStore.teamMemberStore.updateTeamMember(teamId as string, data);
  }

  private async _onTeamMemberJoined(data: V2NIMTeamMember[]) {
    this.logger?.log("teamService _onTeamMemberJoined: ", data);
    const teamId = data[0].teamId;

    this.rootStore.teamMemberStore.addTeamMember(teamId as string, data);
  }

  private async _onTeamMemberKicked(
    opeartorId: string,
    data: V2NIMTeamMember[]
  ) {
    this.logger?.log("teamService _onTeamMemberKicked: ", opeartorId, data);
    const teamId = data[0].teamId;

    this.rootStore.teamMemberStore.removeTeamMember(
      teamId as string,
      data.map((item) => item.accountId) as string[]
    );
  }

  private async _onTeamMemberLeft(data: V2NIMTeamMember[]) {
    this.logger?.log("teamService _onTeamMemberLeft: ", data);
    const teamId = data[0].teamId;

    this.rootStore.teamMemberStore.removeTeamMember(
      teamId as string,
      data.map((item) => item.accountId) as string[]
    );
  }

  private _handleRemoveTeam(teamId: string) {
    this.removeTeam([teamId]);
    // 手动释放内存
    this.rootStore.teamMemberStore.removeTeamMember(teamId);
  }

  private _onTeamMessageMuteModeChanged(
    teamId: string,
    teamType: V2NIMTeamType,
    muteMode: V2NIMTeamMessageMuteMode
  ) {
    this.logger?.log(
      "teamService _onTeamMessageMuteModeChanged: ",
      teamId,
      teamType,
      muteMode
    );
  }
}
