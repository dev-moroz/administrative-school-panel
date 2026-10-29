import { ApiError } from "@/lib/api";
import type { LessonOverlap } from "./types";

export function getOverlaps(error: unknown): LessonOverlap[] | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as { code?: string; overlaps?: LessonOverlap[] } | undefined;
  return body?.code === "LESSON_OVERLAP" && Array.isArray(body.overlaps) ? body.overlaps : null;
}
