import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import SettingsPage from "./page";

const replace = vi.fn();
const useMe = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/auth", () => ({ useMe: () => useMe() }));

describe("/settings page", () => {
  beforeEach(() => {
    replace.mockReset();
    useMe.mockReset();
  });

  it("redirects to the first available section", async () => {
    useMe.mockReturnValue({ data: { permissions: ["currencies.update"] } });
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/settings/currencies"));
  });

  it("does not redirect while the session is loading", () => {
    useMe.mockReturnValue({ data: undefined });
    renderWithProviders(<SettingsPage />);
    expect(replace).not.toHaveBeenCalled();
  });
});
