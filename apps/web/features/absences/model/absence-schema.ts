import { z } from "zod";

const MAX_COMMENT = 1000;

export type AbsenceFormValues = { startsOn: string; endsOn: string; comment: string };

// minStart null: the start is locked (the absence has started) and not checked.
export function absenceSchema({ minStart, minEnd }: { minStart: string | null; minEnd: string }) {
  return z
    .object({
      startsOn: z.string().min(1, "errRequired"),
      endsOn: z.string().min(1, "errRequired"),
      comment: z.string().max(MAX_COMMENT, "errComment"),
    })
    .superRefine((v, ctx) => {
      if (minStart && v.startsOn && v.startsOn < minStart) ctx.addIssue({ code: "custom", path: ["startsOn"], message: "errPastStart" });
      if (v.endsOn && v.endsOn < minEnd) ctx.addIssue({ code: "custom", path: ["endsOn"], message: "errPastEnd" });
      else if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) ctx.addIssue({ code: "custom", path: ["endsOn"], message: "errEndBeforeStart" });
    });
}

export function toAbsencePayload(values: AbsenceFormValues) {
  const comment = values.comment.trim();
  return { startsOn: values.startsOn, endsOn: values.endsOn, ...(comment && { comment }) };
}
