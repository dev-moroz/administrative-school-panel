"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SchoolSettings } from "../model/types";
import { schoolSettingsSchema, type SchoolSettingsFormValues } from "../model/school-settings-schema";
import { useUpdateSchoolSettings } from "../model/use-school-settings";

export function SchoolSettingsForm({ settings }: { settings: SchoolSettings }) {
  const t = useTranslations("SchoolSettings");
  const update = useUpdateSchoolSettings();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<SchoolSettingsFormValues>({
    mode: "onChange",
    resolver: zodResolver(schoolSettingsSchema),
    defaultValues: { lowBalanceThreshold: String(settings.lowBalanceThreshold) },
  });

  async function submit(values: SchoolSettingsFormValues) {
    try {
      const saved = await update.mutateAsync({ lowBalanceThreshold: Number(values.lowBalanceThreshold) });
      reset({ lowBalanceThreshold: String(saved.lowBalanceThreshold) });
      toast.success(t("toastSaved"));
    } catch {
      toast.error(t("saveFailed"));
    }
  }

  return (
    <form className="grid max-w-sm gap-4" noValidate onSubmit={handleSubmit(submit)}>
      <div className="grid gap-2">
        <Label htmlFor="lowBalanceThreshold">{t("fieldThreshold")}</Label>
        <Input
          id="lowBalanceThreshold"
          type="number"
          min={0}
          max={100}
          step={1}
          autoComplete="off"
          aria-invalid={!!errors.lowBalanceThreshold}
          {...register("lowBalanceThreshold")}
        />
        <p className="text-sm text-muted-foreground">{t("thresholdHint")}</p>
        {errors.lowBalanceThreshold && <p className="text-sm text-destructive">{t("errThreshold")}</p>}
      </div>
      <div>
        <Button type="submit" disabled={isSubmitting || !isValid || !isDirty}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
