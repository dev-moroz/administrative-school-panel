"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adjustSchema, type AdjustFormValues } from "../model/adjust-schema";

type Props = {
  balance: number | undefined;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: AdjustFormValues) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

export function AdjustBalanceForm({ balance, isSubmitting, errorMessage, onSubmit, onCancel, onDirtyChange }: Props) {
  const t = useTranslations("Ledger");
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AdjustFormValues>({ resolver: zodResolver(adjustSchema), defaultValues: { delta: "", comment: "" } });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const deltaValue = useWatch({ control, name: "delta" });
  const parsed = adjustSchema.shape.delta.safeParse(deltaValue);
  const after = parsed.success && balance !== undefined ? balance + Number(parsed.data) : null;

  return (
    <form className="grid gap-4 rounded-md border bg-muted/30 p-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-2">
        <Label htmlFor="adjust-delta">{t("fieldChange")}</Label>
        <Input
          id="adjust-delta"
          inputMode="numeric"
          autoComplete="off"
          placeholder="+1 / -1"
          aria-invalid={!!errors.delta}
          {...register("delta")}
        />
        {errors.delta && <p className="text-sm text-destructive">{t("errChange")}</p>}
        {after !== null && <p className="text-sm text-muted-foreground">{t("balanceAfter", { value: after })}</p>}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="adjust-comment">{t("fieldComment")}</Label>
        <Textarea id="adjust-comment" rows={2} aria-invalid={!!errors.comment} {...register("comment")} />
        {errors.comment && <p className="text-sm text-destructive">{t("errComment")}</p>}
      </div>
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
