import { z } from "zod";
import type { StatusPayload } from "./types";

const MAX_COMMENT_LENGTH = 1000;

export const cancelSchema = z
  .object({
    status: z.enum(["CANCELLED", "NO_SHOW"]),
    reason: z.string(),
    charged: z.boolean(),
    comment: z.string().max(MAX_COMMENT_LENGTH),
  })
  .refine((v) => v.status !== "CANCELLED" || v.reason !== "", { path: ["reason"] });

export type CancelFormValues = z.infer<typeof cancelSchema>;

export function toStatusPayload(v: CancelFormValues): StatusPayload {
  const comment = v.comment.trim();
  return {
    status: v.status,
    ...(v.status === "CANCELLED" && { reason: v.reason }),
    charged: v.charged,
    ...(comment && { comment }),
  };
}
