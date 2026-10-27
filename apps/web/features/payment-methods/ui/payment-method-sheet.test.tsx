import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import type { PaymentMethod } from "../model/types";
import { makePaymentMethod } from "../test/fixtures";
import { PaymentMethodSheet } from "./payment-method-sheet";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function mockApi({ error }: { error?: ApiError } = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "POST" && path === "/payment-methods") {
      if (error) throw error;
      return makePaymentMethod(JSON.parse(String(init?.body)));
    }
    if (method === "PATCH" && path.startsWith("/payment-methods/")) {
      if (error) throw error;
      return makePaymentMethod({ code: path.split("/")[2], ...JSON.parse(String(init?.body)) });
    }
    if (path === "/payment-methods") return [makePaymentMethod()];
    throw new Error(`unexpected ${method} ${path}`);
  });
}

const writes = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => ["POST", "PATCH"].includes((init as RequestInit | undefined)?.method ?? ""))
    .map(([path, init]) => ({ path: path as string, method: (init as RequestInit).method, body: JSON.parse(String((init as RequestInit).body)) }));

function setup(method: PaymentMethod | null) {
  const onOpenChange = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<PaymentMethodSheet open onOpenChange={onOpenChange} method={method} />);
  return { user, onOpenChange };
}

const icon = (name: string) => screen.getByRole("radio", { name });

describe("PaymentMethodSheet", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  describe("icon picker", () => {
    it("offers all 28 icons in one group, each with its name", () => {
      setup(null);
      const group = screen.getByRole("radiogroup", { name: "Icon" });
      expect(within(group).getAllByRole("radio")).toHaveLength(28);
      expect(icon("credit-card")).toBeInTheDocument();
      expect(icon("qr-code")).toBeInTheDocument();
    });

    it("only one icon can be selected at a time", async () => {
      const { user } = setup(null);
      await user.click(icon("wallet"));
      expect(icon("wallet")).toBeChecked();
      await user.click(icon("globe"));
      expect(icon("globe")).toBeChecked();
      expect(icon("wallet")).not.toBeChecked();
    });

    it("clicking the selected icon does not clear it", async () => {
      const { user } = setup(null);
      await user.click(icon("wallet"));
      await user.click(icon("wallet"));
      expect(icon("wallet")).toBeChecked();
    });
  });

  describe("create", () => {
    it("shows editable code and name, no icon selected, and no status switch", () => {
      setup(null);
      expect(screen.getByLabelText("Code")).toBeEnabled();
      expect(screen.getByLabelText("Name")).toBeEnabled();
      expect(within(screen.getByRole("radiogroup", { name: "Icon" })).queryAllByRole("radio", { checked: true })).toHaveLength(0);
      expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it("sends POST /payment-methods with an uppercased code, name and icon, then toasts and closes", async () => {
      mockApi();
      const { user, onOpenChange } = setup(null);
      await user.type(screen.getByLabelText("Code"), "wise");
      await user.type(screen.getByLabelText("Name"), "Wise");
      await user.click(icon("globe"));
      await user.click(screen.getByRole("button", { name: "Create payment method" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(writes()).toEqual([{ path: "/payment-methods", method: "POST", body: { code: "WISE", name: "Wise", icon: "globe" } }]);
      expect(toast.success).toHaveBeenCalledWith("Payment method created");
    });

    it("does not send anything when invalid; shows errors for code, name and icon", async () => {
      mockApi();
      const { user } = setup(null);
      await user.type(screen.getByLabelText("Code"), "W");
      await user.click(screen.getByRole("button", { name: "Create payment method" }));
      expect(await screen.findByText("Use 2 to 20 letters, digits or underscores")).toBeInTheDocument();
      expect(screen.getByText("Enter a name")).toBeInTheDocument();
      expect(screen.getByText("Choose an icon")).toBeInTheDocument();
      expect(writes()).toEqual([]);
    });

    it("409 puts 'This code already exists' on the code field and keeps the sheet open", async () => {
      mockApi({ error: new ApiError(409) });
      const { user, onOpenChange } = setup(null);
      await user.type(screen.getByLabelText("Code"), "CASH");
      await user.type(screen.getByLabelText("Name"), "Cash");
      await user.click(icon("banknote"));
      await user.click(screen.getByRole("button", { name: "Create payment method" }));
      expect(await screen.findByText("This code already exists")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("other errors show an error toast and keep the sheet open", async () => {
      mockApi({ error: new ApiError(500) });
      const { user, onOpenChange } = setup(null);
      await user.type(screen.getByLabelText("Code"), "WISE");
      await user.type(screen.getByLabelText("Name"), "Wise");
      await user.click(icon("globe"));
      await user.click(screen.getByRole("button", { name: "Create payment method" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save the payment method"));
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  describe("edit", () => {
    it("fills the form; code is read only, name, icon and status are editable", () => {
      setup(makePaymentMethod({ code: "CARD", name: "Card", icon: "credit-card", isActive: false }));
      expect(screen.getByLabelText("Code")).toHaveValue("CARD");
      expect(screen.getByLabelText("Code")).toBeDisabled();
      expect(screen.getByLabelText("Name")).toHaveValue("Card");
      expect(screen.getByLabelText("Name")).toBeEnabled();
      expect(icon("credit-card")).toBeChecked();
      expect(screen.getByRole("switch", { name: "Active" })).not.toBeChecked();
    });

    it("sends PATCH /payment-methods/:code with only name, icon and isActive", async () => {
      mockApi();
      const { user, onOpenChange } = setup(makePaymentMethod({ code: "CASH", name: "Cash", icon: "banknote" }));
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Cash in hand");
      await user.click(icon("coins"));
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(writes()).toEqual([{ path: "/payment-methods/CASH", method: "PATCH", body: { name: "Cash in hand", icon: "coins", isActive: true } }]);
      expect(toast.success).toHaveBeenCalledWith("Payment method saved");
    });

    it("deactivation is sent as isActive: false", async () => {
      mockApi();
      const { user, onOpenChange } = setup(makePaymentMethod({ code: "CASH" }));
      await user.click(screen.getByRole("switch", { name: "Active" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(writes()[0].body).toEqual({ name: "Cash", icon: "banknote", isActive: false });
    });

    it("409 on deactivation shows the 'in use' toast, resets the switch and keeps the sheet open", async () => {
      mockApi({ error: new ApiError(409) });
      const { user, onOpenChange } = setup(makePaymentMethod({ code: "CASH" }));
      await user.click(screen.getByRole("switch", { name: "Active" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This payment method is in use, it cannot be deactivated"));
      expect(screen.getByRole("switch", { name: "Active" })).toBeChecked();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("reactivation is sent as isActive: true", async () => {
      mockApi();
      const { user } = setup(makePaymentMethod({ code: "OLD", isActive: false }));
      await user.click(screen.getByRole("switch", { name: "Active" }));
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(writes()).toHaveLength(1));
      expect(writes()[0].body).toEqual({ name: "Cash", icon: "banknote", isActive: true });
    });

    it("404 shows an error toast", async () => {
      mockApi({ error: new ApiError(404) });
      const { user } = setup(makePaymentMethod());
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Other");
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Payment method not found"));
    });
  });

  describe("discard changes", () => {
    it("closing a clean form asks nothing", async () => {
      const { user, onOpenChange } = setup(makePaymentMethod());
      await user.keyboard("{Escape}");
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    });

    it("changing only the icon makes the form dirty", async () => {
      const { user, onOpenChange } = setup(makePaymentMethod());
      await user.click(icon("coins"));
      await user.keyboard("{Escape}");
      expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("closing a dirty form asks first; Keep editing stays, Discard closes", async () => {
      const { user, onOpenChange } = setup(makePaymentMethod());
      await user.type(screen.getByLabelText("Name"), "x");
      await user.keyboard("{Escape}");
      expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Keep editing" }));
      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
      await user.keyboard("{Escape}");
      await user.click(await screen.findByRole("button", { name: "Discard" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
