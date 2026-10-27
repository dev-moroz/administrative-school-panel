import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { SessionGuard } from "./session-guard";

const replace = vi.fn();
const logout = vi.fn();
const useMe = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/auth", () => ({
  useMe: () => useMe(),
  logout: () => logout(),
}));

const loader = () => screen.queryByLabelText("Loading");

function renderGuard() {
  return render(
    <SessionGuard>
      <div>page content</div>
    </SessionGuard>,
  );
}

describe("SessionGuard", () => {
  beforeEach(() => {
    replace.mockReset();
    logout.mockReset().mockResolvedValue(undefined);
    useMe.mockReset();
  });

  it("renders children under the loader while the session is loading", () => {
    useMe.mockReturnValue({ data: undefined, error: null });
    renderGuard();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(loader()).toBeInTheDocument();
  });

  it("removes the loader and keeps children once the session is confirmed", () => {
    useMe.mockReturnValue({ data: { id: "1" }, error: null });
    renderGuard();
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(loader()).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the loader on 401, logs out and only then redirects to /login", async () => {
    const order: string[] = [];
    logout.mockImplementation(async () => {
      order.push("logout");
    });
    replace.mockImplementation(() => order.push("replace"));
    useMe.mockReturnValue({ data: undefined, error: new ApiError(401) });
    renderGuard();
    expect(loader()).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(order).toEqual(["logout", "replace"]);
  });

  it("still redirects to /login when logout fails", async () => {
    logout.mockRejectedValue(new Error("network"));
    useMe.mockReturnValue({ data: undefined, error: new ApiError(401) });
    renderGuard();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
