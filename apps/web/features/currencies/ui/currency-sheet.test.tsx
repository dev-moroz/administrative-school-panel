import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import type { Currency } from "../model/types";
import { makeCurrency } from "../test/fixtures";
import { CurrencySheet } from "./currency-sheet";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function mockApi({ error }: { error?: ApiError } = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "POST" && path === "/currencies") {
      if (error) throw error;
      return makeCurrency(JSON.parse(String(init?.body)));
    }
    if (method === "PATCH" && path.startsWith("/currencies/")) {
      if (error) throw error;
      return makeCurrency({ code: path.split("/")[2], ...JSON.parse(String(init?.body)) });
    }
    if (path === "/currencies") return [makeCurrency()];
    throw new Error(`unexpected ${method} ${path}`);
  });
}

const writes = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => ["POST", "PATCH"].includes((init as RequestInit | undefined)?.method ?? ""))
    .map(([path, init]) => ({ path: path as string, method: (init as RequestInit).method, body: JSON.parse(String((init as RequestInit).body)) }));

function setup(currency: Currency | null) {
  const onOpenChange = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<CurrencySheet open onOpenChange={onOpenChange} currency={currency} />);
  return { user, onOpenChange };
}

describe("CurrencySheet", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  describe("create", () => {
    it("shows editable code, name and decimals, and no status switch", () => {
      setup(null);
      expect(screen.getByLabelText("Code")).toBeEnabled();
      expect(screen.getByLabelText("Name")).toBeEnabled();
      expect(screen.getByLabelText("Decimals")).toBeEnabled();
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("sends POST /currencies with an uppercased code and numeric decimals, then toasts and closes", async () => {
      mockApi();
      const { user, onOpenChange } = setup(null);
      await user.type(screen.getByLabelText("Code"), "usdt");
      await user.type(screen.getByLabelText("Name"), "Tether");
      await user.clear(screen.getByLabelText("Decimals"));
      await user.type(screen.getByLabelText("Decimals"), "6");
      await user.click(screen.getByRole("button", { name: "Create currency" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(writes()).toEqual([{ path: "/currencies", method: "POST", body: { code: "USDT", name: "Tether", decimals: 6 } }]);
      expect(toast.success).toHaveBeenCalledWith("Currency created");
    });

    it("does not send anything when the form is invalid and shows field errors", async () => {
      mockApi();
      const { user } = setup(null);
      await user.type(screen.getByLabelText("Code"), "E");
      await user.click(screen.getByRole("button", { name: "Create currency" }));
      expect(await screen.findByText("Use 2 to 10 letters or digits")).toBeInTheDocument();
      expect(screen.getByText("Enter a name")).toBeInTheDocument();
      expect(writes()).toEqual([]);
    });

    it("409 puts 'This code already exists' on the code field and keeps the sheet open", async () => {
      mockApi({ error: new ApiError(409) });
      const { user, onOpenChange } = setup(null);
      await user.type(screen.getByLabelText("Code"), "EUR");
      await user.type(screen.getByLabelText("Name"), "Euro");
      await user.click(screen.getByRole("button", { name: "Create currency" }));
      expect(await screen.findByText("This code already exists")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("other errors show an error toast and keep the sheet open", async () => {
      mockApi({ error: new ApiError(500) });
      const { user, onOpenChange } = setup(null);
      await user.type(screen.getByLabelText("Code"), "EUR");
      await user.type(screen.getByLabelText("Name"), "Euro");
      await user.click(screen.getByRole("button", { name: "Create currency" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save the currency"));
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  describe("edit", () => {
    it("fills the form; code and decimals are read only, name and status are editable", () => {
      setup(makeCurrency({ code: "CHF", name: "Swiss franc", decimals: 2, isActive: false }));
      expect(screen.getByLabelText("Code")).toHaveValue("CHF");
      expect(screen.getByLabelText("Code")).toBeDisabled();
      expect(screen.getByLabelText("Decimals")).toHaveValue("2");
      expect(screen.getByLabelText("Decimals")).toBeDisabled();
      expect(screen.getByLabelText("Name")).toHaveValue("Swiss franc");
      expect(screen.getByLabelText("Name")).toBeEnabled();
      expect(screen.getByRole("switch", { name: "Active" })).not.toBeChecked();
    });

    it("sends PATCH /currencies/:code with only name and isActive", async () => {
      mockApi();
      const { user, onOpenChange } = setup(makeCurrency({ code: "EUR" }));
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Euro (EU)");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(writes()).toEqual([{ path: "/currencies/EUR", method: "PATCH", body: { name: "Euro (EU)", isActive: true } }]);
      expect(toast.success).toHaveBeenCalledWith("Currency saved");
    });

    it("reactivation is sent as isActive: true", async () => {
      mockApi();
      const { user } = setup(makeCurrency({ code: "CHF", isActive: false }));
      await user.click(screen.getByRole("switch", { name: "Active" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0].body).toEqual({ name: "Euro", isActive: true });
    });

    it("409 on deactivation shows the 'in use' toast, resets the switch and keeps the sheet open", async () => {
      mockApi({ error: new ApiError(409) });
      const { user, onOpenChange } = setup(makeCurrency({ code: "EUR" }));
      await user.click(screen.getByRole("switch", { name: "Active" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This currency is in use, it cannot be deactivated"));
      expect(screen.getByRole("switch", { name: "Active" })).toBeChecked();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it("404 shows an error toast", async () => {
      mockApi({ error: new ApiError(404) });
      const { user } = setup(makeCurrency());
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Other");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Currency not found"));
    });
  });

  describe("discard changes", () => {
    it("closing a clean form asks nothing", async () => {
      const { user, onOpenChange } = setup(makeCurrency());
      await user.keyboard("{Escape}");
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    });

    it("closing a dirty form asks first; Keep editing stays, Discard closes", async () => {
      const { user, onOpenChange } = setup(makeCurrency());
      await user.type(screen.getByLabelText("Name"), "x");
      await user.keyboard("{Escape}");
      expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Keep editing" }));
      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
      await user.keyboard("{Escape}");
      await user.click(await screen.findByRole("button", { name: "Discard" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
