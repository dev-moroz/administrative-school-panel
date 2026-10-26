"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth";
import { ApiError } from "@/lib/api";
import { toPayload, type StudentFormValues } from "../model/student-schema";
import { emptyFormValues, studentToFormValues } from "../model/student-to-form-values";
import { useCreateStudent } from "../model/use-create-student";
import { useCurrencies } from "../model/use-currencies";
import { useStudent } from "../model/use-student";
import { useTeachers } from "../model/use-teachers";
import { useUpdateStudent } from "../model/use-update-student";
import { StudentDetails } from "./student-details";
import { StudentForm } from "./student-form";
import { StudentSections } from "./student-sections";

export type SheetTarget = { kind: "closed" } | { kind: "create" } | { kind: "view"; id: string };

type Props = { target: SheetTarget; onTargetChange: (target: SheetTarget) => void };

type Confirm = "close" | "cancel" | "edit" | null;

export function StudentSheet({ target, onTargetChange }: Props) {
  const t = useTranslations("Students");
  const { data: me } = useMe();

  // Edit mode and dirtiness belong to the target they were set for; a new target starts clean.
  const key = target.kind === "view" ? `view:${target.id}` : target.kind;
  const [ui, setUi] = useState({ key, editing: false, dirty: false });
  const editing = ui.key === key && ui.editing;
  const [confirm, setConfirm] = useState<Confirm>(null);

  // Unsaved text in the balance adjustment form (view mode); keyed like `ui` so it never leaks to another target.
  const [adjust, setAdjust] = useState({ key, dirty: false });
  const setAdjustDirty = useCallback(
    (next: boolean) => setAdjust((prev) => (prev.key === key && prev.dirty === next ? prev : { key, dirty: next })),
    [key],
  );
  const adjustDirty = adjust.key === key && adjust.dirty;

  const formOpen = target.kind === "create" || (target.kind === "view" && editing);
  const profileDirty = formOpen && ui.key === key && ui.dirty;
  const dirty = profileDirty || (target.kind === "view" && !editing && adjustDirty);

  function setEditing(next: boolean) {
    setUi({ key, editing: next, dirty: false });
  }
  function setDirty(next: boolean) {
    setUi((prev) =>
      prev.key === key && prev.dirty === next
        ? prev
        : { key, editing: prev.key === key ? prev.editing : false, dirty: next },
    );
  }

  const permissions = me?.permissions ?? [];
  const canEdit = permissions.includes("students.update");
  const canAssignTeacher = permissions.includes("students.assign-teacher");

  const student = useStudent(target.kind === "view" ? target.id : null);
  const currencies = useCurrencies(formOpen && permissions.includes("currencies.read"));
  const teachers = useTeachers(formOpen && canAssignTeacher);
  const create = useCreateStudent();
  const update = useUpdateStudent(target.kind === "view" ? target.id : "");

  function saveError(error: unknown) {
    if (!error) return null;
    if (error instanceof ApiError && error.status === 400) return t("saveInvalid");
    if (error instanceof ApiError && error.status === 403) return t("saveForbidden");
    return t("saveFailed");
  }

  function requestClose() {
    if (dirty) setConfirm("close");
    else onTargetChange({ kind: "closed" });
  }

  function handleCancel() {
    if (target.kind === "create") return requestClose();
    if (dirty) return setConfirm("cancel");
    leaveEdit();
  }

  function leaveEdit() {
    update.reset();
    setEditing(false);
  }

  function requestEdit() {
    if (adjustDirty) setConfirm("edit");
    else setEditing(true);
  }

  function discard() {
    const action = confirm;
    setConfirm(null);
    setAdjustDirty(false);
    if (action === "edit") setEditing(true);
    if (action === "close") onTargetChange({ kind: "closed" });
    if (action === "cancel") leaveEdit();
  }

  function submitCreate(values: StudentFormValues) {
    create.mutate(toPayload(values, "create"), {
      onSuccess: (created) => {
        toast.success(t("toastCreated"));
        onTargetChange({ kind: "view", id: created.id });
      },
    });
  }

  function submitEdit(values: StudentFormValues) {
    update.mutate(toPayload(values, "edit"), {
      onSuccess: () => {
        toast.success(t("toastSaved"));
        setEditing(false);
      },
    });
  }

  const skeleton = (
    <div aria-busy="true" className="grid gap-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </div>
  );

  function renderBody() {
    if (!me) return skeleton;

    const formProps = {
      currencies: currencies.data ?? [],
      teachers: teachers.data ?? [],
      canAssignTeacher,
      onDirtyChange: setDirty,
      onCancel: handleCancel,
    };

    if (target.kind === "create") {
      return (
        <StudentForm
          {...formProps}
          mode="create"
          defaultValues={emptyFormValues}
          teacherName={null}
          isSubmitting={create.isPending}
          errorMessage={saveError(create.error)}
          onSubmit={submitCreate}
        />
      );
    }

    if (student.isPending) return skeleton;

    if (student.isError || !student.data) {
      const notFound = student.error instanceof ApiError && student.error.status === 404;
      return (
        <div role={notFound ? undefined : "alert"} className="grid justify-items-start gap-3">
          <p className="text-muted-foreground">{notFound ? t("notFound") : t("loadStudentError")}</p>
          {!notFound && (
            <Button variant="outline" onClick={() => student.refetch()}>
              {t("retry")}
            </Button>
          )}
        </div>
      );
    }

    if (editing) {
      return (
        <StudentForm
          {...formProps}
          mode="edit"
          defaultValues={studentToFormValues(student.data)}
          teacherName={student.data.teacher?.fullName ?? null}
          isSubmitting={update.isPending}
          errorMessage={saveError(update.error)}
          onSubmit={submitEdit}
        />
      );
    }

    return (
      <div className="grid gap-4">
        <StudentDetails student={student.data} canEdit={canEdit} onEdit={requestEdit} />
        <StudentSections studentId={student.data.id} onDirtyChange={setAdjustDirty} />
      </div>
    );
  }

  const title =
    target.kind === "create" ? t("sheetTitleCreate") : editing ? t("sheetTitleEdit") : t("sheetTitleView");
  const description =
    target.kind === "create" ? t("sheetDescCreate") : editing ? t("sheetDescEdit") : t("sheetDescView");

  return (
    <>
      <Sheet open={target.kind !== "closed"} onOpenChange={(open) => !open && requestClose()}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">{renderBody()}</div>
        </SheetContent>
      </Sheet>
      <DiscardChangesDialog open={confirm !== null} onKeep={() => setConfirm(null)} onDiscard={discard} />
    </>
  );
}
