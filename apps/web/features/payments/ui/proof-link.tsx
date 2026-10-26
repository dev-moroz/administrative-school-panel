"use client";

import type { MouseEvent } from "react";
import { ExternalLink, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import type { Payment } from "../model/types";

const LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ProofLink({ payment }: { payment: Payment }) {
  const t = useTranslations("Payments");

  if (payment.proofUrl) {
    return (
      <a href={payment.proofUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        <ExternalLink className="size-4" aria-hidden />
        <span className="sr-only">{t("openLink")}</span>
        <span>{`${t("link")} · ${hostOf(payment.proofUrl)}`}</span>
      </a>
    );
  }

  if (payment.proofFile) {
    const href = `/api/payments/${payment.id}/proof`;

    // A plain navigation cannot refresh an expired session, so check it before the file tab loads.
    async function open(event: MouseEvent<HTMLAnchorElement>) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const tab = window.open("", "_blank");
      if (!tab) return;
      event.preventDefault();
      try {
        await apiFetch("/auth/me");
        tab.location.href = href;
      } catch {
        tab.close();
      }
    }

    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={payment.proofFile.originalName} onClick={open} className={LINK_CLASS}>
        <Paperclip className="size-4" aria-hidden />
        <span className="sr-only">{t("openFile")}</span>
        <span>{`${t("receipt")} · ${t(`fileKind.${payment.proofFile.mimeType === "application/pdf" ? "pdf" : "image"}`)}`}</span>
      </a>
    );
  }

  return null;
}
