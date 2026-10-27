import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, apiFetch } from "@/lib/api";
import { makePaymentMethod } from "@/features/payment-methods/test/fixtures";
import { renderWithProviders } from "@/test/render";
import PaymentMethodsSettingsPage from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const LIST = [
  makePaymentMethod({ code: "CARD", name: "Card", icon: "credit-card" }),
  makePaymentMethod({ code: "OLD", name: "Old method", isActive: false }),
  makePaymentMethod({ code: "CASH", name: "Cash" }),
];

type Opts = { list?: ReturnType<typeof makePaymentMethod>[]; listError?: ApiError; permissions?: string[] };

function mockApi({ list = LIST, listError, permissions = ["payment-methods.read", "payment-methods.update", "payment-methods.create"] }: Opts = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    if (path === "/auth/me") return { id: "u1", email: "a@b.c", role: "admin", permissions };
    if (path === "/payment-methods") {
      if (listError) throw listError;
      return list;
    }
    throw new Error(`unexpected ${path}`);
  });
}

describe("PaymentMethodsSettingsPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("shows the title and the table in the order the API gave, inactive methods included", async () => {
    mockApi();
    renderWithProviders(<PaymentMethodsSettingsPage />);
    expect(screen.getByRole("heading", { name: "Payment methods" })).toBeInTheDocument();
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[1].textContent)).toEqual(["CARD", "OLD", "CASH"]);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows a skeleton while loading and no table yet", () => {
    vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<PaymentMethodsSettingsPage />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error with Retry, and Retry loads the list again", async () => {
    mockApi({ listError: new ApiError(500) });
    renderWithProviders(<PaymentMethodsSettingsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load payment methods");
    mockApi();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Card")).toBeInTheDocument();
  });

  it("shows an empty state when there are no methods", async () => {
    mockApi({ list: [] });
    renderWithProviders(<PaymentMethodsSettingsPage />);
    expect(await screen.findByText("No payment methods yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("'New payment method' has no icon and opens the sheet in create mode", async () => {
    mockApi();
    renderWithProviders(<PaymentMethodsSettingsPage />);
    const button = await screen.findByRole("button", { name: "New payment method" });
    expect(button.querySelector("svg")).toBeNull();
    await userEvent.click(button);
    expect(await screen.findByRole("button", { name: "Create payment method" })).toBeInTheDocument();
    expect(screen.getByLabelText("Code")).toBeEnabled();
  });

  it("hides 'New payment method' without payment-methods.create", async () => {
    mockApi({ permissions: ["payment-methods.read", "payment-methods.update"] });
    renderWithProviders(<PaymentMethodsSettingsPage />);
    await screen.findByText("Card");
    expect(screen.queryByRole("button", { name: "New payment method" })).not.toBeInTheDocument();
  });

  it("clicking a row opens the sheet in edit mode for that method", async () => {
    mockApi();
    renderWithProviders(<PaymentMethodsSettingsPage />);
    await userEvent.click(await screen.findByText("Card"));
    expect(await screen.findByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Code")).toHaveValue("CARD");
    expect(screen.getByLabelText("Code")).toBeDisabled();
  });

  it("has no pagination", async () => {
    mockApi();
    renderWithProviders(<PaymentMethodsSettingsPage />);
    await screen.findByText("Card");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});
