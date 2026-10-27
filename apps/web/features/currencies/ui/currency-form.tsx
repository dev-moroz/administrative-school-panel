"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api";
import { currencySchema, type CurrencyFormValues } from "../model/currency-schema";

type Props = {
  mode: "create" | "edit";
  defaultValues: CurrencyFormValues;
  // Rejects with the API error; the form maps it to a field error or a toast.
  onSubmit: (values: CurrencyFormValues) => Promise<void>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
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

export function CurrencyForm({ mode, defaultValues, onSubmit, onCancel, onDirtyChange }: Props) {
  const t = useTranslations("Currencies");
  const tc = useTranslations("Common");
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CurrencyFormValues>({ resolver: zodResolver(currencySchema), defaultValues });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function submit(values: CurrencyFormValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null;
      if (mode === "create" && status === 409) {
        setError("code", { type: "duplicate", message: t("errCodeExists") });
      } else if (mode === "edit" && status === 409) {
        // Deactivation was refused: put the switch back to what is stored.
        setValue("isActive", defaultValues.isActive, { shouldDirty: true });
        toast.error(t("inUse"));
      } else if (status === 404) {
        toast.error(t("notFound"));
      } else {
        toast.error(t("saveFailed"));
      }
    }
  }

  const codeError = errors.code && (errors.code.type === "duplicate" ? errors.code.message : t("errCode"));

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit(submit)}>
      <Field label={t("fieldCode")} htmlFor="code" error={codeError}>
        <Input id="code" autoComplete="off" disabled={mode === "edit"} aria-invalid={!!errors.code} {...register("code")} />
      </Field>

      <Field label={t("fieldName")} htmlFor="name" error={errors.name && t("errName")}>
        <Input id="name" autoComplete="off" aria-invalid={!!errors.name} {...register("name")} />
      </Field>

      <Field label={t("fieldDecimals")} htmlFor="decimals" error={errors.decimals && t("errDecimals")}>
        <Input id="decimals" inputMode="numeric" autoComplete="off" disabled={mode === "edit"} aria-invalid={!!errors.decimals} {...register("decimals")} />
      </Field>

      {mode === "edit" && (
        <div className="flex items-center gap-3">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <Switch id="isActive" checked={field.value ?? true} onCheckedChange={field.onChange} />}
          />
          <Label htmlFor="isActive">{t("fieldActive")}</Label>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {mode === "create" ? t("create") : t("save")}
        </Button>
      </div>
    </form>
  );
}
