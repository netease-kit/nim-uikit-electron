import { describe, expect, it, vi } from "vitest";
import { isUserStatusOnline } from "./user-status";
import type { V2NIMUserStatus } from "node-nim/types/v2_def/v2_nim_struct_def";

vi.mock("node-nim", () => ({
  V2NIMUserStatusType: {
    V2NIM_USER_STATUS_TYPE_LOGIN: 1,
  },
}));

const createStatus = (overrides: Partial<V2NIMUserStatus> = {}): V2NIMUserStatus =>
  ({
    accountId: "user-1",
    statusType: 3,
    clientType: 1,
    publishTime: Date.now(),
    ...overrides,
  }) as V2NIMUserStatus;

describe("isUserStatusOnline", () => {
  it("treats non-empty serverExtension.online as online even when statusType is disconnect", () => {
    const status = createStatus({
      statusType: 3,
      serverExtension: JSON.stringify({ online: [4] }),
    });

    expect(isUserStatusOnline(status)).toBe(true);
  });

  it("treats empty serverExtension.online as offline even when statusType is login", () => {
    const status = createStatus({
      statusType: 1,
      serverExtension: JSON.stringify({ online: [] }),
    });

    expect(isUserStatusOnline(status)).toBe(false);
  });

  it("falls back to login statusType when serverExtension.online is absent", () => {
    expect(isUserStatusOnline(createStatus({ statusType: 1 }))).toBe(true);
    expect(isUserStatusOnline(createStatus({ statusType: 3 }))).toBe(false);
  });

  it("falls back to login statusType when serverExtension cannot be parsed", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(isUserStatusOnline(createStatus({ statusType: 1, serverExtension: "{" }))).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  it("returns false for missing status", () => {
    expect(isUserStatusOnline()).toBe(false);
  });
});
