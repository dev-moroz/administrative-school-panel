"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cancelSchema, type CancelFormValues } from "../model/cancel-schema";
import { useCancelPreview, useCancelReasons } from "../model/use-lessons";

type Props = {
  lessonId: string;
  status: CancelFormValues["status"];
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: CancelFormValues) => void;
  onBack: () => void;
};

export function CancelForm({ lessonId, status, isSubmitting, errorMessage, onSubmit, onBack }: Props) {
  const t = useTranslations("Lessons");
  const isCancel = status === "CANCELLED";
  const reasons = useCancelReasons();
  const preview = useCancelPreview(lessonId, isCancel);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<CancelFormValues>({
    resolver: zodResolver(cancelSchema),
    // A no-show is charged by default; a cancellation waits for the server's suggestion.
    defaultValues: { status, reason: "", charged: !isCancel, comment: "" },
  });

  const suggested = preview.data?.suggestedCharged;
  useEffect(() => {
    if (suggested !== undefined && !getFieldState("charged").isDirty) setValue("charged", suggested);
  }, [suggested, getFieldState, setValue]);

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      {isCancel && (
        <div className="grid gap-2">
          <Label htmlFor="reason">{t("fieldReason")}</Label>
          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="reason" className="w-full" aria-invalid={!!errors.reason}>
                  <SelectValue placeholder={t("reasonPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {reasons.data?.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.reason && <p className="text-sm text-destructive">{t("errReason")}</p>}
        </div>
      )}

      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="charged"
            render={({ field }) => <Switch id="charged" checked={field.value} onCheckedChange={(v) => field.onChange(v)} />}
          />
          <Label htmlFor="charged">{t("fieldCharged")}</Label>
        </div>
        {isCancel && suggested && <p className="text-sm text-muted-foreground">{t("suggestCharge")}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="comment">{t("fieldComment")}</Label>
        <Textarea id="comment" rows={2} {...register("comment")} />
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          {t("back")}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {t(isCancel ? "confirmCancel" : "confirmNoShow")}
        </Button>
      </div>
    </form>
  );
}
