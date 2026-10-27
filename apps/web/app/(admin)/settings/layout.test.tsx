import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import SettingsLayout from "./layout";

const replace = vi.fn();
const usePathname = vi.fn();
const useMe = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => usePathname(),
}));
vi.mock("@/features/auth", () => ({ useMe: () => useMe() }));

function renderLayout() {
  return renderWithProviders(
    <SettingsLayout>
      <div>section content</div>
    </SettingsLayout>,
  );
}

const withPermissions = (permissions: string[]) =>
  useMe.mockReturnValue({ data: { id: "1", email: "a@b.c", role: "admin", permissions } });

describe("SettingsLayout", () => {
  beforeEach(() => {
    replace.mockReset();
    usePathname.mockReset().mockReturnValue("/settings/currencies");
    useMe.mockReset();
  });

  it("renders the section nav and the content for a permitted user", () => {
    withPermissions(["currencies.update"]);
    renderLayout();
    expect(screen.getByRole("link", { name: "Currencies" })).toBeInTheDocument();
    expect(screen.getByText("section content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to /students and hides the content when the user has no sections", async () => {
    withPermissions(["students.read.all"]);
    renderLayout();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/students"));
    expect(screen.queryByText("section content")).not.toBeInTheDocument();
  });

  it("neither redirects nor shows the nav while the session is loading", () => {
    useMe.mockReturnValue({ data: undefined });
    renderLayout();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Currencies" })).not.toBeInTheDocument();
  });
});
