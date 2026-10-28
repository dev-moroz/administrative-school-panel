import { describe, expect, it } from "vitest";
import { cancelSchema, toStatusPayload, type CancelFormValues } from "./cancel-schema";

const valid: CancelFormValues = { status: "CANCELLED", reason: "ILLNESS", charged: false, comment: "" };

const errorPaths = (patch: Partial<CancelFormValues>) => {
  const result = cancelSchema.safeParse({ ...valid, ...patch });
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("cancelSchema", () => {
  it("accepts a valid cancellation", () => {
    expect(errorPaths({})).toEqual([]);
  });

  it("requires a reason for CANCELLED", () => {
    expect(errorPaths({ reason: "" })).toContain("reason");
  });

  it("does not require a reason for NO_SHOW", () => {
    expect(errorPaths({ status: "NO_SHOW", reason: "" })).toEqual([]);
  });

  it("limits the comment to 1000 characters", () => {
    expect(errorPaths({ comment: "a".repeat(1000) })).toEqual([]);
    expect(errorPaths({ comment: "a".repeat(1001) })).toContain("comment");
  });
});

describe("toStatusPayload", () => {
  it("always sends charged explicitly: the checkbox has the final say", () => {
    expect(toStatusPayload(valid)).toEqual({ status: "CANCELLED", reason: "ILLNESS", charged: false });
    expect(toStatusPayload({ ...valid, charged: true }).charged).toBe(true);
  });

  it("trims the comment and drops an empty one", () => {
    expect(toStatusPayload({ ...valid, comment: "  sick " }).comment).toBe("sick");
    expect(toStatusPayload({ ...valid, comment: "  " })).not.toHaveProperty("comment");
  });

  it("does not send a reason for NO_SHOW", () => {
    expect(toStatusPayload({ status: "NO_SHOW", reason: "ILLNESS", charged: true, comment: "" })).toEqual({ status: "NO_SHOW", charged: true });
  });
});
