import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import ProfileLayout from "./layout";

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
    <ProfileLayout>
      <div>section content</div>
    </ProfileLayout>,
  );
}

const withMe = (teacherId: string | null, permissions: string[]) =>
  useMe.mockReturnValue({ data: { id: "1", email: "a@b.c", role: "teacher", teacherId, permissions } });

describe("ProfileLayout", () => {
  beforeEach(() => {
    replace.mockReset();
    usePathname.mockReset().mockReturnValue("/profile/absences");
    useMe.mockReset();
  });

  it("renders the section nav and the content for a teacher", () => {
    withMe("t1", ["absences.manage"]);
    renderLayout();
    expect(screen.getByRole("link", { name: "Absences" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("section content")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to /students and hides the content when there are no sections", async () => {
    withMe(null, ["absences.manage"]);
    renderLayout();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/students"));
    expect(screen.queryByText("section content")).not.toBeInTheDocument();
  });

  it("neither redirects nor shows the nav while the session is loading", () => {
    useMe.mockReturnValue({ data: undefined });
    renderLayout();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Absences" })).not.toBeInTheDocument();
  });
});
