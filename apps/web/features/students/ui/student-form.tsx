"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ENGLISH_LEVELS, studentSchema, type StudentFormValues } from "../model/student-schema";
import type { Currency } from "@/features/currencies/model/types";
import type { Teacher } from "../model/types";

type Props = {
  mode: "create" | "edit";
  defaultValues: StudentFormValues;
  currencies: Currency[];
  teachers: Teacher[];
  canAssignTeacher: boolean;
  teacherName: string | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: StudentFormValues) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

// Radix Select forbids an empty item value, so "not set" travels as a sentinel.
const NONE = "__none__";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function StudentForm({
  mode,
  defaultValues,
  currencies,
  teachers,
  canAssignTeacher,
  teacherName,
  isSubmitting,
  errorMessage,
  onSubmit,
  onCancel,
  onDirtyChange,
}: Props) {
  const t = useTranslations("Students");
  const tc = useTranslations("Common");
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<StudentFormValues>({ resolver: zodResolver(studentSchema), defaultValues });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function submit(values: StudentFormValues) {
    if (mode === "create" && canAssignTeacher && !values.teacherId) {
      setError("teacherId", { message: t("errTeacher") });
      return;
    }
    onSubmit(values);
  }

  const currencyCodes = currencies.map((c) => c.code);
  const currentCurrency = defaultValues.defaultCurrencyCode;
  // A currency the student already has may be missing from the list (deactivated): keep it selectable.
  const extraCurrency = currentCurrency && !currencyCodes.includes(currentCurrency) ? currentCurrency : null;

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit(submit)}>
      <Field label={t("fieldFullName")} htmlFor="fullName" error={errors.fullName && t("errName")}>
        <Input id="fullName" autoComplete="off" aria-invalid={!!errors.fullName} {...register("fullName")} />
      </Field>

      <Field
        label={t("fieldNickname")}
        htmlFor="telegramUsername"
        error={errors.telegramUsername && t("errNickname")}
      >
        <Input
          id="telegramUsername"
          autoComplete="off"
          aria-invalid={!!errors.telegramUsername}
          {...register("telegramUsername")}
        />
      </Field>

      <Field label={t("fieldLevel")} htmlFor="englishLevel">
        <Controller
          control={control}
          name="englishLevel"
          render={({ field }) => (
            <Select value={field.value} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
              <SelectTrigger id="englishLevel" className="w-full">
                <SelectValue placeholder="—">{field.value || undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("notSet")}</SelectItem>
                {ENGLISH_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("fieldCurrency")} htmlFor="defaultCurrencyCode">
          <Controller
            control={control}
            name="defaultCurrencyCode"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                <SelectTrigger id="defaultCurrencyCode" className="w-full">
                  <SelectValue placeholder="—">{field.value || undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("notSet")}</SelectItem>
                  {extraCurrency && <SelectItem value={extraCurrency}>{extraCurrency}</SelectItem>}
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label={t("fieldPrice")} htmlFor="lessonPrice" error={errors.lessonPrice && t("errPrice")}>
          <Input
            id="lessonPrice"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!errors.lessonPrice}
            {...register("lessonPrice")}
          />
        </Field>
      </div>

      {canAssignTeacher && mode === "create" && (
        <Field label={t("fieldTeacher")} htmlFor="teacherId" error={errors.teacherId?.message}>
          <Controller
            control={control}
            name="teacherId"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id="teacherId" className="w-full" aria-invalid={!!errors.teacherId}>
                  <SelectValue placeholder={t("teacherPlaceholder")}>
                    {teachers.find((x) => x.id === field.value)?.fullName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      )}
      {mode === "edit" && teacherName && (
        <div className="grid gap-1">
          <span className="text-sm font-medium">{t("fieldTeacher")}</span>
          <span>{teacherName}</span>
        </div>
      )}

      <Field label={t("fieldComment")} htmlFor="comment">
        <Textarea id="comment" rows={4} {...register("comment")} />
      </Field>

      {mode === "edit" && (
        <div className="flex items-center gap-3">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor="isActive">{t("fieldActive")}</Label>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
