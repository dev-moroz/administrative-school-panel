"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { absenceSchema, type AbsenceFormValues } from "../model/absence-schema";

type Props = {
  defaultValues: AbsenceFormValues;
  rules: { canEditStart: boolean; minStart: string | null; minEnd: string };
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: AbsenceFormValues) => void;
  onCancel: () => void;
};

export function AbsenceForm({ defaultValues, rules, isSubmitting, errorMessage, onSubmit, onCancel }: Props) {
  const t = useTranslations("Absences");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AbsenceFormValues>({ resolver: zodResolver(absenceSchema(rules)), defaultValues });

  return (
    <form className="grid gap-4 rounded-md border p-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="absence-from">{t("fieldFrom")}</Label>
          <Input
            id="absence-from"
            type="date"
            min={rules.minStart ?? undefined}
            disabled={!rules.canEditStart}
            aria-invalid={!!errors.startsOn}
            {...register("startsOn")}
          />
          {errors.startsOn?.message && <p className="text-sm text-destructive">{t(errors.startsOn.message)}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="absence-to">{t("fieldTo")}</Label>
          <Input id="absence-to" type="date" min={rules.minEnd} aria-invalid={!!errors.endsOn} {...register("endsOn")} />
          {errors.endsOn?.message && <p className="text-sm text-destructive">{t(errors.endsOn.message)}</p>}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="absence-comment">{t("fieldComment")}</Label>
        <Textarea id="absence-comment" rows={2} placeholder={t("commentPlaceholder")} {...register("comment")} />
        {errors.comment?.message && <p className="text-sm text-destructive">{t(errors.comment.message)}</p>}
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
