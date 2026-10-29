import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { renderWithProviders } from "@/test/render";
import { AppSidebar } from "./app-sidebar";

const useMe = vi.fn();
const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/features/auth", () => ({
  useMe: () => useMe(),
  logout: vi.fn(),
  meQueryKey: ["me"],
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

function renderSidebar() {
  return renderWithProviders(
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>,
  );
}

const withPermissions = (permissions: string[]) =>
  useMe.mockReturnValue({ data: { id: "1", email: "a@b.c", role: "admin", permissions } });

describe("AppSidebar settings item", () => {
  beforeEach(() => {
    useMe.mockReset();
    usePathname.mockReset().mockReturnValue("/students");
  });

  it("shows Settings when the user has at least one settings section", () => {
    withPermissions(["students.read.all", "currencies.update"]);
    renderSidebar();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("hides Settings when the user has no settings section", () => {
    withPermissions(["students.read.all", "currencies.read"]);
    renderSidebar();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("hides Settings while the session is loading", () => {
    useMe.mockReturnValue({ data: undefined });
    renderSidebar();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("marks Settings active on any /settings path", () => {
    usePathname.mockReturnValue("/settings/currencies");
    withPermissions(["currencies.update"]);
    renderSidebar();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("data-active", "true");
  });

  it("does not mark Settings active on other pages", () => {
    withPermissions(["students.read.all", "currencies.update"]);
    renderSidebar();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("data-active", "false");
  });

  it("orders the footer as theme toggle, Settings, Sign out", () => {
    withPermissions(["currencies.update"]);
    renderSidebar();
    const theme = screen.getByTestId("theme-toggle");
    const settings = screen.getByRole("link", { name: "Settings" });
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expect(theme.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(settings.compareDocumentPosition(signOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps Sign out and the theme toggle for a user without Settings", () => {
    withPermissions(["students.read.all"]);
    renderSidebar();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});

describe("AppSidebar My profile item", () => {
  beforeEach(() => {
    useMe.mockReset();
    usePathname.mockReset().mockReturnValue("/students");
  });

  it("shows My profile for a user with a teacher record", () => {
    useMe.mockReturnValue({ data: { id: "1", email: "a@b.c", role: "teacher", teacherId: "t1", permissions: ["absences.manage"] } });
    renderSidebar();
    expect(screen.getByRole("link", { name: "My profile" })).toHaveAttribute("href", "/profile");
  });

  it("hides My profile without a teacher record", () => {
    useMe.mockReturnValue({ data: { id: "1", email: "a@b.c", role: "admin", teacherId: null, permissions: ["absences.manage"] } });
    renderSidebar();
    expect(screen.queryByRole("link", { name: "My profile" })).not.toBeInTheDocument();
  });
});
