import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import ProfilePage from "./page";

const replace = vi.fn();
const useMe = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/auth", () => ({ useMe: () => useMe() }));

describe("/profile page", () => {
  beforeEach(() => {
    replace.mockReset();
    useMe.mockReset();
  });

  it("redirects to the first available section", async () => {
    useMe.mockReturnValue({ data: { teacherId: "t1", permissions: ["absences.manage"] } });
    renderWithProviders(<ProfilePage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile/absences"));
  });

  it("does not redirect while the session is loading", () => {
    useMe.mockReturnValue({ data: undefined });
    renderWithProviders(<ProfilePage />);
    expect(replace).not.toHaveBeenCalled();
  });
});
