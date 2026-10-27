import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, apiFetch } from "@/lib/api";
import { makeCurrency } from "@/features/currencies/test/fixtures";
import { renderWithProviders } from "@/test/render";
import CurrenciesSettingsPage from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const LIST = [
  makeCurrency({ code: "GBP", name: "British pound" }),
  makeCurrency({ code: "CHF", name: "Swiss franc", isActive: false }),
  makeCurrency({ code: "EUR", name: "Euro" }),
];

function mockApi({ list = LIST, listError }: { list?: ReturnType<typeof makeCurrency>[]; listError?: ApiError } = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    if (path === "/auth/me") return { id: "u1", email: "a@b.c", role: "admin", permissions: ["currencies.read", "currencies.update", "currencies.create"] };
    if (path === "/currencies") {
      if (listError) throw listError;
      return list;
    }
    throw new Error(`unexpected ${path}`);
  });
}

describe("CurrenciesSettingsPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("shows the title and the currencies table sorted by code, inactive ones included", async () => {
    mockApi();
    renderWithProviders(<CurrenciesSettingsPage />);
    expect(screen.getByRole("heading", { name: "Currencies" })).toBeInTheDocument();
    const rows = (await screen.findAllByRole("row")).slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["CHF", "EUR", "GBP"]);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows a skeleton while loading and no table yet", () => {
    vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<CurrenciesSettingsPage />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error with Retry, and Retry loads the list again", async () => {
    mockApi({ listError: new ApiError(500) });
    renderWithProviders(<CurrenciesSettingsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load currencies");
    mockApi();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Euro")).toBeInTheDocument();
  });

  it("shows an empty state when there are no currencies", async () => {
    mockApi({ list: [] });
    renderWithProviders(<CurrenciesSettingsPage />);
    expect(await screen.findByText("No currencies yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("'New currency' has no icon and opens the sheet in create mode", async () => {
    mockApi();
    renderWithProviders(<CurrenciesSettingsPage />);
    const button = await screen.findByRole("button", { name: "New currency" });
    expect(button.querySelector("svg")).toBeNull();
    await userEvent.click(button);
    expect(await screen.findByRole("button", { name: "Create currency" })).toBeInTheDocument();
    expect(screen.getByLabelText("Code")).toBeEnabled();
  });

  it("clicking a row opens the sheet in edit mode for that currency", async () => {
    mockApi();
    renderWithProviders(<CurrenciesSettingsPage />);
    await userEvent.click(await screen.findByText("Euro"));
    expect(await screen.findByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Code")).toHaveValue("EUR");
    expect(screen.getByLabelText("Code")).toBeDisabled();
  });

  it("has no pagination", async () => {
    mockApi();
    renderWithProviders(<CurrenciesSettingsPage />);
    await screen.findByText("Euro");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});
