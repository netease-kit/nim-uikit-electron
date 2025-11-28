import { makeAutoObservable } from "mobx";
import RootStore from ".";
import { V2NIMClient } from "node-nim";
import { V2NIMConst } from "../utils/constants";

import {
  V2NIMTeamMember,
  V2NIMTeamMemberListResult,
  V2NIMTeamMemberQueryOption,
  V2NIMUpdateSelfMemberInfoParams,
} from "node-nim/types/v2_def/v2_nim_struct_def";
import { V2NIMTeamType } from "node-nim";
import * as storeUtils from "./utils";

/**Mobx 可观察对象，负责管理群组成员的子 store*/
export class TeamMemberStore {
  teamMembers: Map<string, Map<string, V2NIMTeamMember>> = new Map();
  logger: typeof storeUtils.logger | null = null;

  constructor(private rootStore: RootStore, private nim: V2NIMClient) {
    makeAutoObservable(this);
    this.logger = this.rootStore.logger;
  }

  resetState(): void {
    this.teamMembers.clear();
  }

  /**
   * 销毁TeamMemberStore，会取消相关事件监听
   */
  destroy(): void {
    this.resetState();
  }

  /**
   * 拉人入群
   * @param options
   * options.teamId - 群id <br>
   * options.type - 群类型, 默认高级群 <br>
   * options.accounts - 要拉进群的成员的帐号列表 <br>
   * options.ps - 邀请附言 <br>
   */
  async addTeamMemberActive(options: {
    teamId: string;
    type?: V2NIMTeamType;
    accounts: string[];
    ps?: string;
  }): Promise<void> {
    try {
      this.logger?.log("addTeamMemberActive", options);
      const {
        teamId,
        type = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
        accounts,
        ps,
      } = options;

      await this.nim.teamService?.inviteMember(
        teamId,
        type,
        accounts,
        ps as string
      );
      // 事件中处理
      this.logger?.log("addTeamMemberActive success", options);
    } catch (error) {
      this.logger?.error("addTeamMemberActive failed: ", options, error);
      throw error;
    }
  }

  /**
   * 踢人出群
   * @param options
   * options.teamId - 群id <br>
   * options.type - 群类型, 默认高级群 <br>
   * options.accounts - 要拉进群的成员的帐号列表 <br>
   */
  async removeTeamMemberActive(options: {
    teamId: string;
    type?: V2NIMTeamType;
    accounts: string[];
  }): Promise<void> {
    try {
      this.logger?.log("removeTeamMemberActive", options);
      const {
        teamId,
        type = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
        accounts,
      } = options;

      await this.nim.teamService?.kickMember(teamId, type, accounts);
      // 事件中处理
      this.logger?.log("removeTeamMemberActive success", options);
    } catch (error) {
      this.logger?.error("removeTeamMemberActive failed: ", options, error);
      throw error;
    }
  }

  /**
   * 获取群成员
   * @param options
   * options.teamId - 群id <br>
   * options.queryOption - 查询选项 <br>
   * options.type - 群类型, 默认高级群 <br>
   */
  async getTeamMemberActive(options: {
    teamId: string;
    queryOption: V2NIMTeamMemberQueryOption;
    type?: V2NIMTeamType;
  }): Promise<V2NIMTeamMemberListResult> {
    try {
      this.logger?.log("getTeamMemberActive", options);
      const {
        teamId,
        queryOption,
        type = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
      } = options;
      const res = await this.nim.teamService?.getTeamMemberList(
        teamId,
        type,
        queryOption
      );

      this.logger?.log(
        "getTeamMemberActive success: ",
        teamId,
        type,
        queryOption,
        res
      );
      this.setTeamMembers(teamId, res.memberList);
      return res;
    } catch (error) {
      this.logger?.error("getTeamMemberActive failed: ", options, error);
      throw error;
    }
  }

  /**
   * 更新我在群中的信息
   * @param options
   * options.teamId - 群id <br>
   * options.type - 群类型, 默认高级群 <br>
   * options.memberInfo - 更新的信息 <br>
   */
  async updateMyMemberInfoActive(options: {
    teamId: string;
    type?: V2NIMTeamType;
    memberInfo: V2NIMUpdateSelfMemberInfoParams;
  }): Promise<void> {
    try {
      this.logger?.log("updateMyMemberInfo", options);
      const {
        teamId,
        type = V2NIMConst.V2NIMTeamType.V2NIM_TEAM_TYPE_NORMAL,
        memberInfo,
      } = options;

      await this.nim.teamService?.updateSelfTeamMemberInfo(
        teamId,
        type,
        memberInfo
      );
      this.logger?.log("updateMyMemberInfo success: ", options);
    } catch (error) {
      this.logger?.error("updateMyMemberInfo failed: ", options, error);
      throw error;
    }
  }

  /**
   * 内存中设置群成员，会覆盖原有的成员
   * @param teamId - 群id
   * @param members - 群成员
   */
  setTeamMembers(teamId: string, members: V2NIMTeamMember[]): void {
    const teamMembers = new Map<string, V2NIMTeamMember>();

    members.forEach((item) => {
      teamMembers.set(item.accountId as string, item);
    });
    this.teamMembers.set(teamId, teamMembers);
  }

  /**
   * 内存中添加群成员
   * @param teamId - 群id
   * @param members - 群成员
   */
  addTeamMember(teamId: string, members: V2NIMTeamMember[]): void {
    let teamMembers = this.teamMembers.get(teamId);

    if (!teamMembers) {
      teamMembers = new Map<string, V2NIMTeamMember>();
    }

    members
      .filter((item) => !!item.inTeam)
      .filter((item) => !!item.accountId)
      .forEach((item) => {
        teamMembers!.set(item.accountId as string, item);
      });
    this.teamMembers.set(teamId, teamMembers);
  }

  /**
   * 内存中移除群成员
   * @param teamId - 群id
   * @param accounts - 群成员数组
   */
  removeTeamMember(teamId: string, accounts?: string[]): void {
    if (!accounts || !accounts.length) {
      this.teamMembers.delete(teamId);
      return;
    }

    const teamMembers = this.teamMembers.get(teamId);

    if (!teamMembers) {
      return;
    }

    accounts.forEach((item) => {
      teamMembers.delete(item);
    });
    this.teamMembers.set(teamId, teamMembers);
  }

  /**
   * 内存中更新群成员处理函数
   * @param teamId - 群id
   * @param members - 群成员
   */
  updateTeamMember(teamId: string, members: Partial<V2NIMTeamMember>[]): void {
    const teamMembers = this.teamMembers.get(teamId);

    if (!teamMembers) {
      return;
    }

    members.forEach((item) => {
      let m = teamMembers.get(item.accountId!);

      if (m) {
        m = { ...m, ...item };
        teamMembers.set(item.accountId!, m);
      }
    });
    this.teamMembers.set(teamId, teamMembers);
  }

  /**
   * 从内存中获取群成员信息
   * @param teamId - 群id
   * @param accounts - 群成员数组
   */
  getTeamMember(teamId: string, accounts?: string[]): V2NIMTeamMember[] {
    const teamMembers = [...(this.teamMembers.get(teamId)?.values() || [])];

    if (!accounts || !accounts.length) {
      return teamMembers;
    }

    return teamMembers.filter((item) =>
      accounts.some((j) => j === item.accountId)
    );
  }
}
