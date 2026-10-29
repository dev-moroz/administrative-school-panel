"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ListPage } from "@/components/list-page";
import { PageMessage } from "@/components/page-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { toAbsencePayload, type AbsenceFormValues } from "../model/absence-schema";
import { absenceRules, absenceState, todayInBase } from "../model/absence-state";
import type { Absence, AbsenceOwner, AbsencePeriodPayload, AbsenceResult } from "../model/types";
import { useAbsences, useCreateAbsence, useUpdateAbsence } from "../model/use-absences";
import { AbsenceForm } from "./absence-form";
import { DeleteAbsenceDialog } from "./delete-absence-dialog";

const EMPTY: AbsenceFormValues = { startsOn: "", endsOn: "", comment: "" };

// Only changed fields are sent: a started absence must not resend its start.
function changes(absence: Absence, values: AbsenceFormValues): AbsencePeriodPayload {
  const comment = values.comment.trim();
  return {
    ...(values.startsOn !== absence.startsOn && { startsOn: values.startsOn }),
    ...(values.endsOn !== absence.endsOn && { endsOn: values.endsOn }),
    ...(comment !== (absence.comment ?? "") && { comment }),
  };
}

type Props = { owner: AbsenceOwner; variant?: "page" | "embedded" };

// "page": a full page (title, toolbar button, centered empty state); "embedded": a section inside a card.
export function AbsenceList({ owner, variant = "embedded" }: Props) {
  const t = useTranslations("Absences");
  const format = useFormatter();
  const absences = useAbsences(owner);
  const create = useCreateAbsence();
  const update = useUpdateAbsence();
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const today = todayInBase();

  function reportWarnings({ warnings = [] }: AbsenceResult) {
    if (warnings.length === 0) return;
    const reasons = warnings.map((w) => t(`notRestoredReason.${w.reason}`));
    toast.warning(t("notRestored", { count: warnings.length }), { description: [...new Set(reasons)].join(", ") });
  }

  function done(result: AbsenceResult) {
    setEditing(null);
    toast.success(t("toastSaved"));
    reportWarnings(result);
  }

  function errorMessage(error: Error | null) {
    if (!error) return null;
    const code = error instanceof ApiError && (error.body as { code?: string } | undefined)?.code;
    return t(code === "ABSENCE_OVERLAP" ? "errOverlap" : "saveFailed");
  }

  function close() {
    create.reset();
    update.reset();
    setEditing(null);
  }

  const day = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return format.dateTime(new Date(y, m - 1, d), { dateStyle: "medium" });
  };

  function body() {
    if (absences.isError) {
      return (
        <div role="alert" className="grid justify-items-start gap-2">
          <p className="text-sm text-muted-foreground">{t("loadError")}</p>
          <Button variant="outline" size="sm" onClick={() => absences.refetch()}>
            {t("retry")}
          </Button>
        </div>
      );
    }
    if (absences.isPending) return <Skeleton aria-busy="true" className="h-14 w-full" />;
    if (absences.data.length === 0 && editing !== "new") {
      const empty = <p className="text-sm text-muted-foreground">{t("empty")}</p>;
      if (variant === "page") return <PageMessage>{empty}</PageMessage>;
      return <div className="grid place-items-center py-8">{empty}</div>;
    }

    return (
      <ul className="grid gap-3">
        {absences.data.map((absence) => {
          const state = absenceState(absence, today);
          const rules = absenceRules(state, today);
          if (editing === absence.id && rules.minEnd) {
            return (
              <li key={absence.id}>
                <AbsenceForm
                  defaultValues={{ startsOn: absence.startsOn, endsOn: absence.endsOn, comment: absence.comment ?? "" }}
                  rules={{ ...rules, minEnd: rules.minEnd }}
                  isSubmitting={update.isPending}
                  errorMessage={errorMessage(update.error)}
                  onSubmit={(values) => update.mutate({ id: absence.id, payload: changes(absence, values) }, { onSuccess: done })}
                  onCancel={close}
                />
              </li>
            );
          }
          return (
            <li key={absence.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {day(absence.startsOn)} – {day(absence.endsOn)}
                  </span>
                  <Badge variant={state === "past" ? "outline" : "secondary"}>{t(`state.${state}`)}</Badge>
                </div>
                {absence.comment && <p className="text-sm text-muted-foreground">{absence.comment}</p>}
              </div>
              <div className="flex gap-2">
                {rules.canEditEnd && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(absence.id)}>
                    {t("edit")}
                  </Button>
                )}
                {rules.canDelete && (
                  <Button variant="outline" size="sm" onClick={() => setDeleting(absence.id)}>
                    {t("delete")}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  const kind = "studentId" in owner ? "STUDENT_FREEZE" : "TEACHER_VACATION";
  const isPage = variant === "page";

  const newForm = editing === "new" && (
    <AbsenceForm
      defaultValues={EMPTY}
      rules={{ canEditStart: true, minStart: today, minEnd: today }}
      isSubmitting={create.isPending}
      errorMessage={errorMessage(create.error)}
      onSubmit={(values) => create.mutate({ kind, ...owner, ...toAbsencePayload(values) }, { onSuccess: done })}
      onCancel={close}
    />
  );

  const deleteDialog = (
    <DeleteAbsenceDialog
        absenceId={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={(result) => {
          setDeleting(null);
          toast.success(t("toastDeleted"));
          reportWarnings(result);
        }}
      />
  );

  if (isPage) {
    return (
      <ListPage
        title={t("title")}
        toolbar={
          <div className="flex justify-end">
            <Button disabled={editing === "new"} onClick={() => setEditing("new")}>
              {t("add")}
            </Button>
          </div>
        }
      >
        {newForm}
        {body()}
        {deleteDialog}
      </ListPage>
    );
  }

  return (
    <section className="grid gap-3">
      {newForm || (
        <Button variant="outline" size="sm" className="justify-self-end" onClick={() => setEditing("new")}>
          {t("add")}
        </Button>
      )}
      {body()}
      {deleteDialog}
    </section>
  );
}
