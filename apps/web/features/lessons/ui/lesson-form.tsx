"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useStudents } from "@/features/students/model/use-students";
import { lessonSchema, type LessonFormValues } from "../model/lesson-schema";

type Props = {
  defaultValues: LessonFormValues;
  // An existing lesson keeps its student; only a new one can repeat weekly.
  existingStudent?: { id: string; fullName: string } | null;
  canRepeat: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: LessonFormValues) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function LessonForm({ defaultValues, existingStudent, canRepeat, isSubmitting, errorMessage, onSubmit, onCancel, onDirtyChange }: Props) {
  const t = useTranslations("Lessons");
  const isNew = existingStudent === undefined;
  const students = useStudents({ page: 1, pageSize: 100, isActive: true });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<LessonFormValues>({ resolver: zodResolver(lessonSchema), defaultValues });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <Field label={t("fieldStudent")} htmlFor="studentId" error={errors.studentId && t("errStudent")}>
        <Controller
          control={control}
          name="studentId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={!isNew}>
              <SelectTrigger id="studentId" className="w-full" aria-invalid={!!errors.studentId}>
                <SelectValue placeholder={t("studentPlaceholder")}>
                  {isNew ? students.data?.items.find((s) => s.id === field.value)?.fullName : existingStudent?.fullName}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {students.data?.items.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("fieldDate")} htmlFor="date" error={errors.date && t("errDate")}>
          <Input id="date" type="date" aria-invalid={!!errors.date} {...register("date")} />
        </Field>
        <Field label={t("fieldTime")} htmlFor="time" error={errors.time && t("errTime")}>
          <Input id="time" type="time" aria-invalid={!!errors.time} {...register("time")} />
        </Field>
      </div>

      <Field label={t("fieldDuration")} htmlFor="durationMin" error={errors.durationMin && t("errDuration")}>
        <Input id="durationMin" inputMode="numeric" autoComplete="off" aria-invalid={!!errors.durationMin} {...register("durationMin")} />
      </Field>

      {isNew && canRepeat && (
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="repeatWeekly"
            render={({ field }) => <Switch id="repeatWeekly" checked={field.value} onCheckedChange={field.onChange} />}
          />
          <Label htmlFor="repeatWeekly">{t("repeatWeekly")}</Label>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
