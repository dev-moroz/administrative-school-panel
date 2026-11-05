import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { LoginForm } from "./login-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

describe("LoginForm", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    replace.mockClear();
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts empty without demo credentials", () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("prefills demo credentials, so one click signs in", async () => {
    renderWithProviders(
      <LoginForm demo={{ email: "demo@example.com", password: "demo-pass" }} />,
    );
    expect(screen.getByLabelText("Email")).toHaveValue("demo@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("demo-pass");

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/students"));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ email: "demo@example.com", password: "demo-pass" });
  });

  it("explains the demo account only when credentials are given", () => {
    const { unmount } = renderWithProviders(<LoginForm />);
    expect(screen.queryByText(/demo account/i)).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <LoginForm demo={{ email: "demo@example.com", password: "demo-pass" }} />,
    );
    expect(screen.getByText(/demo account/i)).toBeInTheDocument();
  });
});
