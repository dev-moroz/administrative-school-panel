"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";

const COLLAPSE_LENGTH = 160;
const COLLAPSE_LINES = 3;

export function PaymentComment({ text }: { text: string }) {
  const t = useTranslations("Payments");
  const [expanded, setExpanded] = useState(false);
  const long = text.length > COLLAPSE_LENGTH || text.split("\n").length > COLLAPSE_LINES;

  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid min-w-0 justify-items-start gap-1">
        <p className={`whitespace-pre-wrap break-words ${long && !expanded ? "line-clamp-3" : ""}`}>{text}</p>
        {long && (
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => setExpanded((v) => !v)}>
            {t(expanded ? "readLess" : "readMore")}
          </button>
        )}
      </div>
    </div>
  );
}
