import { V2NIMUserStatusType } from "node-nim";
import type { V2NIMUserStatus } from "node-nim/types/v2_def/v2_nim_struct_def";

type ServerExtension = {
  online?: unknown;
};

const parseOnlineClientTypes = (serverExtension?: string): unknown[] | undefined => {
  if (!serverExtension) {
    return undefined;
  }

  try {
    const extension = JSON.parse(serverExtension) as ServerExtension;
    return Array.isArray(extension.online) ? extension.online : undefined;
  } catch (error) {
    console.warn("parse user status serverExtension failed", error);
    return undefined;
  }
};

export const isUserStatusOnline = (status?: V2NIMUserStatus): boolean => {
  if (!status) {
    return false;
  }

  const onlineClientTypes = parseOnlineClientTypes(status.serverExtension);
  if (onlineClientTypes) {
    return onlineClientTypes.length > 0;
  }

  return status.statusType === V2NIMUserStatusType.V2NIM_USER_STATUS_TYPE_LOGIN;
};
