import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import SchoolSettingsPage from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Opts = { threshold?: number; loadError?: ApiError; saveError?: ApiError };

function mockApi({ threshold = 2, loadError, saveError }: Opts = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (path === "/auth/me") return { id: "u1", email: "a@b.c", role: "admin", permissions: ["school-settings.update"] };
    if (path === "/settings/school" && method === "GET") {
      if (loadError) throw loadError;
      return { lowBalanceThreshold: threshold };
    }
    if (path === "/settings/school" && method === "PATCH") {
      if (saveError) throw saveError;
      return JSON.parse(String(init?.body));
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
}

const patches = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PATCH")
    .map(([path, init]) => ({ path, body: JSON.parse(String((init as RequestInit).body)) }));

const field = () => screen.getByLabelText("Low balance threshold");

describe("SchoolSettingsPage", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("shows the title and the current threshold", async () => {
    mockApi({ threshold: 3 });
    renderWithProviders(<SchoolSettingsPage />);
    expect(screen.getByRole("heading", { name: "School" })).toBeInTheDocument();
    await waitFor(() => expect(field()).toHaveValue(3));
  });

  it("shows no field while loading", () => {
    vi.mocked(apiFetch).mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<SchoolSettingsPage />);
    expect(screen.queryByLabelText("Low balance threshold")).not.toBeInTheDocument();
  });

  it("shows an error with Retry, and Retry loads the value again", async () => {
    mockApi({ loadError: new ApiError(500) });
    renderWithProviders(<SchoolSettingsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load school settings");
    mockApi({ threshold: 4 });
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(field()).toHaveValue(4));
  });

  it("sends PATCH with a number and toasts on success", async () => {
    mockApi();
    const user = userEvent.setup();
    renderWithProviders(<SchoolSettingsPage />);
    await waitFor(() => expect(field()).toHaveValue(2));
    await user.clear(field());
    await user.type(field(), "5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Settings saved"));
    expect(patches()).toEqual([{ path: "/settings/school", body: { lowBalanceThreshold: 5 } }]);
  });

  it("disables Save while the value equals the stored one", async () => {
    mockApi();
    const user = userEvent.setup();
    renderWithProviders(<SchoolSettingsPage />);
    await waitFor(() => expect(field()).toHaveValue(2));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.clear(field());
    await user.type(field(), "2");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("disables Save again after a successful save, the saved value becoming the stored one", async () => {
    mockApi();
    const user = userEvent.setup();
    renderWithProviders(<SchoolSettingsPage />);
    await waitFor(() => expect(field()).toHaveValue(2));
    await user.clear(field());
    await user.type(field(), "5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(field()).toHaveValue(5);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it.each([
    ["empty", ""],
    ["negative", "-1"],
    ["fractional", "2.5"],
    ["above 100", "101"],
  ])("shows a validation error while typing, disables Save and sends nothing: %s", async (_label, value) => {
    mockApi();
    const user = userEvent.setup();
    renderWithProviders(<SchoolSettingsPage />);
    await waitFor(() => expect(field()).toHaveValue(2));
    await user.clear(field());
    if (value) await user.type(field(), value);
    expect(await screen.findByText("Enter a whole number from 0 to 100")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(patches()).toEqual([]);
  });

  it("enables Save again once the value is valid", async () => {
    mockApi();
    const user = userEvent.setup();
    renderWithProviders(<SchoolSettingsPage />);
    await waitFor(() => expect(field()).toHaveValue(2));
    await user.clear(field());
    await user.type(field(), "101");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    await user.clear(field());
    await user.type(field(), "10");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    expect(screen.queryByText("Enter a whole number from 0 to 100")).not.toBeInTheDocument();
  });

  it("toasts an error when saving fails and keeps the typed value", async () => {
    mockApi({ saveError: new ApiError(500) });
    const user = userEvent.setup();
    renderWithProviders(<SchoolSettingsPage />);
    await waitFor(() => expect(field()).toHaveValue(2));
    await user.clear(field());
    await user.type(field(), "7");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(field()).toHaveValue(7);
  });
});
