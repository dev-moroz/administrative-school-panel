import { describe, expect, it } from "vitest";
import type { Currency } from "@/features/students/model/types";
import { createPaymentSchema, toPayload, type PaymentFormValues } from "./payment-schema";

const currencies: Currency[] = [
  { code: "EUR", name: "Euro", decimals: 2, isActive: true },
  { code: "JPY", name: "Yen", decimals: 0, isActive: true },
];
const schema = createPaymentSchema(currencies);

const valid: PaymentFormValues = {
  studentId: "s1",
  amount: "400",
  currencyCode: "EUR",
  method: "CASH",
  lessonsGranted: "8",
  paidAt: "",
  comment: "",
  proofMode: "none",
  proofUrl: "",
  proofFile: null,
};

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type });
const errorPaths = (patch: Partial<PaymentFormValues>) => {
  const result = schema.safeParse({ ...valid, ...patch });
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("createPaymentSchema", () => {
  it("accepts a valid payment", () => {
    expect(errorPaths({})).toEqual([]);
  });

  it("requires a student, a currency and a method", () => {
    expect(errorPaths({ studentId: "" })).toContain("studentId");
    expect(errorPaths({ currencyCode: "" })).toContain("currencyCode");
    expect(errorPaths({ method: "" as PaymentFormValues["method"] })).toContain("method");
  });

  it("rejects a currency that is not in the list", () => {
    expect(errorPaths({ currencyCode: "XXX" })).toContain("currencyCode");
  });

  it.each(["10", "10.5", "10.50", "0.01", "1234567.89"])("accepts amount %s for 2 decimals", (amount) => {
    expect(errorPaths({ amount })).toEqual([]);
  });

  it.each(["", " ", "0", "0.00", "-5", "10.555", "10,5", "1e3", ".5", "10.", "abc"])("rejects amount %j for 2 decimals", (amount) => {
    expect(errorPaths({ amount })).toContain("amount");
  });

  it("uses the decimals of the chosen currency", () => {
    expect(errorPaths({ currencyCode: "JPY", amount: "500" })).toEqual([]);
    expect(errorPaths({ currencyCode: "JPY", amount: "500.5" })).toContain("amount");
  });

  it.each(["1", "8", "100"])("accepts lessons %s", (lessonsGranted) => {
    expect(errorPaths({ lessonsGranted })).toEqual([]);
  });

  it.each(["", "0", "-1", "101", "1.5", "abc"])("rejects lessons %j", (lessonsGranted) => {
    expect(errorPaths({ lessonsGranted })).toContain("lessonsGranted");
  });

  describe("proof", () => {
    it("ignores link and file in 'none' mode", () => {
      expect(errorPaths({ proofMode: "none", proofUrl: "garbage", proofFile: file("a.txt", "text/plain") })).toEqual([]);
    });

    it("link mode needs an http(s) url", () => {
      expect(errorPaths({ proofMode: "link", proofUrl: "https://example.com/r/1" })).toEqual([]);
      expect(errorPaths({ proofMode: "link", proofUrl: "http://example.com" })).toEqual([]);
      expect(errorPaths({ proofMode: "link", proofUrl: "" })).toContain("proofUrl");
      expect(errorPaths({ proofMode: "link", proofUrl: "example.com" })).toContain("proofUrl");
      expect(errorPaths({ proofMode: "link", proofUrl: "ftp://example.com" })).toContain("proofUrl");
      expect(errorPaths({ proofMode: "link", proofUrl: "javascript:alert(1)" })).toContain("proofUrl");
    });

    it("file mode needs a file", () => {
      expect(errorPaths({ proofMode: "file", proofFile: null })).toContain("proofFile");
    });

    it.each([
      ["a.png", "image/png"],
      ["a.jpg", "image/jpeg"],
      ["a.webp", "image/webp"],
      ["a.pdf", "application/pdf"],
    ])("file mode accepts %s", (name, type) => {
      expect(errorPaths({ proofMode: "file", proofFile: file(name, type) })).toEqual([]);
    });

    it("file mode rejects other types, empty files and files above 5 MB", () => {
      expect(errorPaths({ proofMode: "file", proofFile: file("a.txt", "text/plain") })).toContain("proofFile");
      expect(errorPaths({ proofMode: "file", proofFile: file("a.gif", "image/gif") })).toContain("proofFile");
      expect(errorPaths({ proofMode: "file", proofFile: file("a.png", "image/png", 0) })).toContain("proofFile");
      expect(errorPaths({ proofMode: "file", proofFile: file("a.png", "image/png", 5 * 1024 * 1024) })).toEqual([]);
      expect(errorPaths({ proofMode: "file", proofFile: file("a.png", "image/png", 5 * 1024 * 1024 + 1) })).toContain("proofFile");
    });
  });
});

describe("toPayload", () => {
  it("builds the minimal body: no paidAt, comment or proofUrl when empty", () => {
    expect(toPayload(valid)).toEqual({ studentId: "s1", amount: "400", currencyCode: "EUR", method: "CASH", lessonsGranted: 8 });
  });

  it("trims amount and comment and converts lessons to a number", () => {
    expect(toPayload({ ...valid, amount: " 400.50 ", comment: "  October ", lessonsGranted: " 8 " })).toMatchObject({
      amount: "400.50",
      comment: "October",
      lessonsGranted: 8,
    });
  });

  it("drops a whitespace-only comment", () => {
    expect(toPayload({ ...valid, comment: "   " })).not.toHaveProperty("comment");
  });

  it("sends paidAt as an ISO string only when the date was set", () => {
    expect(toPayload({ ...valid, paidAt: "2026-10-25T14:10" }).paidAt).toBe(new Date("2026-10-25T14:10").toISOString());
    expect(toPayload(valid)).not.toHaveProperty("paidAt");
  });

  it("sends proofUrl only in link mode, never the file", () => {
    expect(toPayload({ ...valid, proofMode: "link", proofUrl: " https://example.com/r " }).proofUrl).toBe("https://example.com/r");
    expect(toPayload({ ...valid, proofMode: "none", proofUrl: "https://example.com/r" })).not.toHaveProperty("proofUrl");
    expect(toPayload({ ...valid, proofMode: "file", proofUrl: "https://example.com/r", proofFile: file("a.pdf", "application/pdf") })).not.toHaveProperty("proofUrl");
    expect(toPayload({ ...valid, proofMode: "file", proofFile: file("a.pdf", "application/pdf") })).not.toHaveProperty("proofFile");
  });
});
