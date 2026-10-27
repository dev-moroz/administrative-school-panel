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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ApiError } from "@/lib/api";
import { PAYMENT_METHOD_ICONS } from "../model/payment-method-icons";
import { paymentMethodSchema, type PaymentMethodFormValues } from "../model/payment-method-schema";
import { PaymentMethodIcon } from "./payment-method-icon";

type Props = {
  mode: "create" | "edit";
  defaultValues: PaymentMethodFormValues;
  // Rejects with the API error; the form maps it to a field error or a toast.
  onSubmit: (values: PaymentMethodFormValues) => Promise<void>;
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

export function PaymentMethodForm({ mode, defaultValues, onSubmit, onCancel, onDirtyChange }: Props) {
  const t = useTranslations("PaymentMethods");
  const tc = useTranslations("Common");
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PaymentMethodFormValues>({ resolver: zodResolver(paymentMethodSchema), defaultValues });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  async function submit(values: PaymentMethodFormValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null;
      if (mode === "create" && status === 409) {
        setError("code", { type: "duplicate", message: t("errCodeExists") });
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

      <div className="grid gap-2">
        <Label id="icon-label">{t("fieldIcon")}</Label>
        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={1}
              aria-labelledby="icon-label"
              className="flex-wrap"
              value={field.value}
              // Radix reports "" when the selected item is clicked again; an icon is required, so keep it.
              onValueChange={(value) => value && field.onChange(value)}
            >
              {PAYMENT_METHOD_ICONS.map((name) => (
                <ToggleGroupItem key={name} value={name} aria-label={name} className="size-9 min-w-0 p-0">
                  <PaymentMethodIcon name={name} />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
        {errors.icon && <p className="text-sm text-destructive">{t("errIcon")}</p>}
      </div>

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
