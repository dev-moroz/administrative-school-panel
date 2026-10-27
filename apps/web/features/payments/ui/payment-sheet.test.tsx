import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, apiFetch } from "@/lib/api";
import type { Currency } from "@/features/currencies/model/types";
import { currencies, makeStudent } from "@/features/students/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { makePayment } from "../test/fixtures";
import { PaymentSheet } from "./payment-sheet";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));

type Opts = { createError?: ApiError; proofError?: ApiError; currencyList?: Currency[]; s1Currency?: string };

function mockApi({ createError, proofError, currencyList, s1Currency = "EUR" }: Opts = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    const url = new URL(path, "http://x");
    const method = init?.method ?? "GET";
    if (url.pathname === "/auth/me") return { id: "u1", email: "a@b.c", role: "admin", permissions: ["payments.create", "students.read", "currencies.read"] };
    if (url.pathname === "/students" && method === "GET") {
      return {
        items: [
          { id: "s1", fullName: "Anna Petrova", telegramUsername: null, isActive: true },
          { id: "s2", fullName: "Max Kozlov", telegramUsername: null, isActive: true },
        ],
        total: 2,
        page: 1,
        pageSize: 100,
      };
    }
    if (url.pathname === "/students/s1") return makeStudent({ id: "s1", defaultCurrencyCode: s1Currency, lessonPrice: "50.00" });
    if (url.pathname === "/students/s2") return makeStudent({ id: "s2", fullName: "Max Kozlov", defaultCurrencyCode: null, lessonPrice: null });
    if (url.pathname === "/currencies") return currencyList ?? currencies;
    if (url.pathname === "/payments" && method === "POST") {
      if (createError) throw createError;
      return makePayment({ id: "p-new" });
    }
    if (url.pathname === "/payments/p-new/proof" && method === "POST") {
      if (proofError) {
        const err = proofError;
        proofError = undefined;
        throw err;
      }
      return makePayment({ id: "p-new" });
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
}

const posts = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    .map(([path, init]) => ({ path: path as string, init: init as RequestInit }));

const body = (call: { init: RequestInit }) => JSON.parse(String(call.init.body));

function setup() {
  const onOpenChange = vi.fn();
  const user = userEvent.setup({ applyAccept: false });
  renderWithProviders(<PaymentSheet open onOpenChange={onOpenChange} />);
  return { user, onOpenChange };
}

type User = ReturnType<typeof userEvent.setup>;

async function pick(user: User, label: string, option: string | RegExp) {
  await user.click(await screen.findByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function fillBasics(user: User, amount = "400") {
  await pick(user, "Student", "Anna Petrova");
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent("EUR"));
  await user.type(screen.getByLabelText("Amount"), amount);
  await pick(user, "Method", "Cash");
}

const pdf = () => new File(["%PDF-1.4"], "receipt.pdf", { type: "application/pdf" });

describe("PaymentSheet", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("loads active students for the select (up to 100)", async () => {
    mockApi();
    const { user } = setup();
    await user.click(await screen.findByRole("combobox", { name: "Student" }));
    expect(await screen.findByRole("option", { name: "Max Kozlov" })).toBeInTheDocument();
    const call = vi.mocked(apiFetch).mock.calls.map(([p]) => new URL(p as string, "http://x")).find((u) => u.pathname === "/students")!;
    expect(call.searchParams.get("isActive")).toBe("true");
    expect(call.searchParams.get("pageSize")).toBe("100");
  });

  describe("lessons suggestion", () => {
    it("picking a student preselects their default currency and the amount suggests lessons", async () => {
      mockApi();
      const { user } = setup();
      await fillBasics(user, "400");
      expect(screen.getByLabelText("Lessons")).toHaveValue("8");
    });

    it("switching to another currency removes the suggestion", async () => {
      mockApi();
      const { user } = setup();
      await fillBasics(user, "400");
      await pick(user, "Currency", /^GBP/);
      expect(screen.getByLabelText("Lessons")).toHaveValue("");
    });

    it("a value typed by hand is not overwritten when the amount changes", async () => {
      mockApi();
      const { user } = setup();
      await fillBasics(user, "400");
      await user.clear(screen.getByLabelText("Lessons"));
      await user.type(screen.getByLabelText("Lessons"), "5");
      await user.clear(screen.getByLabelText("Amount"));
      await user.type(screen.getByLabelText("Amount"), "500");
      expect(screen.getByLabelText("Lessons")).toHaveValue("5");
    });
  });

  describe("lesson price hint", () => {
    it("shows the student's lesson price under the amount", async () => {
      mockApi();
      const { user } = setup();
      await pick(user, "Student", "Anna Petrova");
      expect(await screen.findByText("Lesson price: 50.00 EUR")).toBeInTheDocument();
    });

    it("shows nothing for a student without a price", async () => {
      mockApi();
      const { user } = setup();
      await pick(user, "Student", "Max Kozlov");
      await waitFor(() => expect(vi.mocked(apiFetch).mock.calls.some(([p]) => p === "/students/s2")).toBe(true));
      expect(screen.queryByText(/lesson price/i)).not.toBeInTheDocument();
    });
  });

  describe("submit", () => {
    it("without proof: one POST /payments with the minimal body, then closes", async () => {
      mockApi();
      const { user, onOpenChange } = setup();
      await fillBasics(user);
      await user.click(screen.getByRole("button", { name: "Save payment" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(posts().map((p) => p.path)).toEqual(["/payments"]);
      expect(body(posts()[0])).toEqual({ studentId: "s1", amount: "400", currencyCode: "EUR", method: "CASH", lessonsGranted: 8 });
    });

    it("does not call the API while the form is invalid and shows field errors", async () => {
      mockApi();
      const { user } = setup();
      await user.click(await screen.findByRole("button", { name: "Save payment" }));
      expect(posts()).toHaveLength(0);
      expect(await screen.findAllByText(/required|enter|choose/i)).not.toHaveLength(0);
    });

    it("link proof goes into the payment body", async () => {
      mockApi();
      const { user, onOpenChange } = setup();
      await fillBasics(user);
      await user.click(screen.getByRole("radio", { name: "Link" }));
      await user.type(screen.getByLabelText("Proof link"), "https://example.com/r/1");
      await user.click(screen.getByRole("button", { name: "Save payment" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(body(posts()[0]).proofUrl).toBe("https://example.com/r/1");
      expect(posts()).toHaveLength(1);
    });

    it("an invalid link blocks the request", async () => {
      mockApi();
      const { user } = setup();
      await fillBasics(user);
      await user.click(screen.getByRole("radio", { name: "Link" }));
      await user.type(screen.getByLabelText("Proof link"), "example.com");
      await user.click(screen.getByRole("button", { name: "Save payment" }));
      expect(await screen.findByText("Enter a valid link starting with http:// or https://")).toBeInTheDocument();
      expect(posts()).toHaveLength(0);
    });

    it("file proof: creates the payment first, then uploads the file to it", async () => {
      mockApi();
      const { user, onOpenChange } = setup();
      await fillBasics(user);
      await user.click(screen.getByRole("radio", { name: "File" }));
      await user.upload(screen.getByLabelText("Proof file"), pdf());
      await user.click(screen.getByRole("button", { name: "Save payment" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(posts().map((p) => p.path)).toEqual(["/payments", "/payments/p-new/proof"]);
      expect(body(posts()[0])).not.toHaveProperty("proofUrl");
      expect(((posts()[1].init.body as FormData).get("file") as File).name).toBe("receipt.pdf");
    });

    it("rejects a file of the wrong type before any request", async () => {
      mockApi();
      const { user } = setup();
      await fillBasics(user);
      await user.click(screen.getByRole("radio", { name: "File" }));
      await user.upload(screen.getByLabelText("Proof file"), new File(["x"], "notes.txt", { type: "text/plain" }));
      await user.click(screen.getByRole("button", { name: "Save payment" }));
      expect(await screen.findByText("Use a png, jpg, webp or pdf file")).toBeInTheDocument();
      expect(posts()).toHaveLength(0);
    });

    it("rejects a file above 5 MB before any request", async () => {
      mockApi();
      const { user } = setup();
      await fillBasics(user);
      await user.click(screen.getByRole("radio", { name: "File" }));
      await user.upload(screen.getByLabelText("Proof file"), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));
      await user.click(screen.getByRole("button", { name: "Save payment" }));
      expect(await screen.findByText("The file is larger than 5 MB")).toBeInTheDocument();
      expect(posts()).toHaveLength(0);
    });

    it("a failed create shows an alert and keeps the form open", async () => {
      mockApi({ createError: new ApiError(500) });
      const { user, onOpenChange } = setup();
      await fillBasics(user);
      await user.click(screen.getByRole("button", { name: "Save payment" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Could not save the payment");
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe("upload fails after the payment was created", () => {
    async function submitWithFile(user: User) {
      await fillBasics(user);
      await user.click(screen.getByRole("radio", { name: "File" }));
      await user.upload(screen.getByLabelText("Proof file"), pdf());
      await user.click(screen.getByRole("button", { name: "Save payment" }));
    }

    it("keeps the form open and says the payment was saved", async () => {
      mockApi({ proofError: new ApiError(500) });
      const { user, onOpenChange } = setup();
      await submitWithFile(user);
      expect(await screen.findByText("Payment saved, but the file was not uploaded")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Save payment" })).not.toBeInTheDocument();
    });

    it("Retry upload repeats only the upload and closes on success", async () => {
      mockApi({ proofError: new ApiError(500) });
      const { user, onOpenChange } = setup();
      await submitWithFile(user);
      await user.click(await screen.findByRole("button", { name: "Retry upload" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(posts().map((p) => p.path)).toEqual(["/payments", "/payments/p-new/proof", "/payments/p-new/proof"]);
    });

    it("Close leaves without another request", async () => {
      mockApi({ proofError: new ApiError(500) });
      const { user, onOpenChange } = setup();
      await submitWithFile(user);
      await user.click(await screen.findByRole("button", { name: "Close" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(posts()).toHaveLength(2);
    });
  });

  describe("discarding", () => {
    it("Cancel on a clean form closes without a dialog", async () => {
      mockApi();
      const { user, onOpenChange } = setup();
      await user.click(await screen.findByRole("button", { name: "Cancel" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByText(/discard changes/i)).not.toBeInTheDocument();
    });

    it("Cancel on a dirty form asks first", async () => {
      mockApi();
      const { user, onOpenChange } = setup();
      await user.type(await screen.findByLabelText("Amount"), "10");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(await screen.findByText(/discard changes/i)).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
  describe("inactive currencies", () => {
    const withInactive: Currency[] = [...currencies, { code: "CHF", name: "Swiss franc", decimals: 2, isActive: false }];

    it("an inactive currency is not offered in the Currency select", async () => {
      mockApi({ currencyList: withInactive });
      const { user } = setup();
      await user.click(await screen.findByRole("combobox", { name: "Currency" }));
      expect(await screen.findByRole("option", { name: /^GBP/ })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: /CHF/ })).not.toBeInTheDocument();
    });

    it("a student whose default currency is inactive: the currency is not preselected, the price hint stays", async () => {
      mockApi({ currencyList: withInactive, s1Currency: "CHF" });
      const { user } = setup();
      await pick(user, "Student", "Anna Petrova");
      expect(await screen.findByText("Lesson price: 50.00 CHF")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Currency" })).not.toHaveTextContent("CHF");
      await user.type(screen.getByLabelText("Amount"), "400");
      expect(screen.getByLabelText("Lessons")).toHaveValue("");
    });

    it("a student whose default currency is inactive: submitting without choosing a currency is blocked", async () => {
      mockApi({ currencyList: withInactive, s1Currency: "CHF" });
      const { user } = setup();
      await pick(user, "Student", "Anna Petrova");
      await user.type(screen.getByLabelText("Amount"), "400");
      await pick(user, "Method", "Cash");
      await user.click(screen.getByRole("button", { name: "Save payment" }));
      expect(await screen.findByText("Choose a currency")).toBeInTheDocument();
      expect(posts()).toEqual([]);
    });
  });
});
