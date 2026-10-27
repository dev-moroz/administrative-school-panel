"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useActiveCurrencies } from "@/features/currencies/model/use-currencies";
import { useActivePaymentMethods } from "@/features/payment-methods/model/use-payment-methods";
import { PaymentMethodIcon } from "@/features/payment-methods/ui/payment-method-icon";
import { useStudent } from "@/features/students/model/use-student";
import { useStudents } from "@/features/students/model/use-students";
import type { Student } from "@/features/students/model/types";
import {
  ALLOWED_PROOF_TYPES,
  PROOF_MODES,
  createPaymentSchema,
  emptyPaymentValues,
  proofFileProblem,
  type PaymentFormValues,
} from "../model/payment-schema";
import { suggestLessons } from "../model/suggest-lessons";

type Props = {
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (values: PaymentFormValues) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="relative grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        hint && <p className="absolute -bottom-3.5 text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function MethodLabel({ method }: { method: { name: string; icon: string } }) {
  return (
    <span className="flex items-center gap-2">
      <PaymentMethodIcon name={method.icon} />
      {method.name}
    </span>
  );
}

export function PaymentForm({ isSubmitting, errorMessage, onSubmit, onCancel, onDirtyChange }: Props) {
  const t = useTranslations("Payments");
  const students = useStudents({ page: 1, pageSize: 100, isActive: true });
  const currenciesQuery = useActiveCurrencies(true);
  const currencies = useMemo(() => currenciesQuery.data ?? [], [currenciesQuery.data]);
  const methods = useActivePaymentMethods(true).data ?? [];
  const schema = useMemo(() => createPaymentSchema(currencies), [currencies]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<PaymentFormValues>({ resolver: zodResolver(schema), defaultValues: emptyPaymentValues });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const studentId = useWatch({ control, name: "studentId" });
  const proofMode = useWatch({ control, name: "proofMode" });
  const proofFile = useWatch({ control, name: "proofFile" });
  const student = useStudent(studentId || null).data;

  // Lessons are suggested until the user types a number of their own.
  const lessonsManual = useRef(false);
  const applySuggestion = useCallback(
    (forStudent: Student | undefined, override: { amount?: string; currency?: string } = {}) => {
      if (lessonsManual.current) return;
      const values = getValues();
      const currency = override.currency ?? values.currencyCode;
      const suggested = forStudent
        ? suggestLessons({
            amount: override.amount ?? values.amount,
            price: forStudent.lessonPrice,
            paymentCurrency: currency,
            priceCurrency: forStudent.defaultCurrencyCode,
            decimals: currencies.find((c) => c.code === currency)?.decimals ?? 2,
          })
        : null;
      setValue("lessonsGranted", suggested === null ? "" : String(suggested));
    },
    [currencies, getValues, setValue],
  );

  // The student's default currency is applied once per chosen student.
  const appliedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!student || !currenciesQuery.isSuccess || appliedFor.current === student.id) return;
    appliedFor.current = student.id;
    // A deactivated default currency is not applied: the user picks an active one.
    const code = student.defaultCurrencyCode;
    const usable = code && currencies.some((c) => c.code === code) ? code : undefined;
    if (usable) setValue("currencyCode", usable);
    applySuggestion(student, { currency: usable });
  }, [student, currenciesQuery.isSuccess, currencies, applySuggestion, setValue]);

  const priceHint = student?.lessonPrice
    ? t("lessonPrice", { value: [student.lessonPrice, student.defaultCurrencyCode].filter(Boolean).join(" ") })
    : undefined;

  const amountField = register("amount");
  const lessonsField = register("lessonsGranted");

  function fileError() {
    const problem = proofFileProblem(proofFile);
    return t(problem === "type" ? "errFileType" : problem === "size" ? "errFileSize" : "errFileRequired");
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <Field label={t("fieldStudent")} htmlFor="studentId" error={errors.studentId && t("errStudent")}>
        <Controller
          control={control}
          name="studentId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="studentId" className="w-full" aria-invalid={!!errors.studentId}>
                <SelectValue placeholder={t("studentPlaceholder")}>
                  {students.data?.items.find((s) => s.id === field.value)?.fullName}
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
        <Field label={t("fieldAmount")} htmlFor="amount" error={errors.amount && t("errAmount")} hint={priceHint}>
          <Input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={!!errors.amount}
            {...amountField}
            onChange={(event) => {
              void amountField.onChange(event);
              applySuggestion(student, { amount: event.target.value });
            }}
          />
        </Field>
        <Field label={t("fieldCurrency")} htmlFor="currencyCode" error={errors.currencyCode && t("errCurrency")}>
          <Controller
            control={control}
            name="currencyCode"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(code) => {
                  field.onChange(code);
                  applySuggestion(student, { currency: code });
                }}
              >
                <SelectTrigger id="currencyCode" className="w-full" aria-invalid={!!errors.currencyCode}>
                  <SelectValue placeholder="—">{field.value || undefined}</SelectValue>
                </SelectTrigger>
                <SelectContent>
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t("fieldMethod")} htmlFor="method" error={errors.method && t("errMethod")}>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="method" className="w-full" aria-invalid={!!errors.method}>
                  <SelectValue placeholder="—">
                    {(() => {
                      const selected = methods.find((m) => m.code === field.value);
                      return selected && <MethodLabel method={selected} />;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.code} value={m.code}>
                      <MethodLabel method={m} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label={t("fieldLessons")} htmlFor="lessonsGranted" error={errors.lessonsGranted && t("errLessons")}>
          <Input
            id="lessonsGranted"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={!!errors.lessonsGranted}
            {...lessonsField}
            onChange={(event) => {
              lessonsManual.current = event.target.value.trim() !== "";
              void lessonsField.onChange(event);
            }}
          />
        </Field>
      </div>

      <Field label={t("fieldPaidAt")} htmlFor="paidAt">
        <Input id="paidAt" type="datetime-local" {...register("paidAt")} />
      </Field>

      <Field label={t("fieldComment")} htmlFor="comment">
        <Textarea id="comment" rows={2} {...register("comment")} />
      </Field>

      <div className="grid gap-2">
        <span className="text-sm font-medium">{t("fieldProof")}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          value={proofMode}
          onValueChange={(mode) => {
            if (!mode) return;
            setValue("proofMode", mode as (typeof PROOF_MODES)[number], { shouldDirty: true });
            setValue("proofUrl", "");
            setValue("proofFile", null);
          }}
        >
          {PROOF_MODES.map((mode) => (
            <ToggleGroupItem key={mode} value={mode}>
              {t(`proof.${mode}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {proofMode === "link" && (
        <Field label={t("fieldProofLink")} htmlFor="proofUrl" error={errors.proofUrl && t("errLink")}>
          <Input id="proofUrl" type="url" autoComplete="off" aria-invalid={!!errors.proofUrl} {...register("proofUrl")} />
        </Field>
      )}
      {proofMode === "file" && (
        <Field label={t("fieldProofFile")} htmlFor="proofFile" error={errors.proofFile && fileError()}>
          <Input
            id="proofFile"
            type="file"
            accept={ALLOWED_PROOF_TYPES.join(",")}
            aria-invalid={!!errors.proofFile}
            onChange={(event) => setValue("proofFile", event.target.files?.[0] ?? null, { shouldDirty: true })}
          />
        </Field>
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
