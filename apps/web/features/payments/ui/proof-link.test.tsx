import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import { makePayment } from "../test/fixtures";
import { ProofLink } from "./proof-link";

vi.mock("@/lib/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api")>()), apiFetch: vi.fn() }));

const file = { originalName: "receipt.pdf", mimeType: "application/pdf", size: 1000 };

function fakeTab() {
  const tab = { location: { href: "" }, close: vi.fn() };
  vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  return tab;
}

describe("ProofLink", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders nothing when there is no proof", () => {
    const { container } = renderWithProviders(<ProofLink payment={makePayment()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("a link proof is a plain external link in a new tab, without touching the session", async () => {
    const open = vi.spyOn(window, "open");
    renderWithProviders(<ProofLink payment={makePayment({ proofUrl: "https://example.com/r/1" })} />);
    const link = screen.getByRole("link", { name: /open link/i });
    expect(link).toHaveAttribute("href", "https://example.com/r/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    await userEvent.click(link);
    expect(open).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("the buttons say what they open", () => {
    const { unmount } = renderWithProviders(<ProofLink payment={makePayment({ proofFile: file })} />);
    expect(screen.getByText("Receipt · PDF")).toBeInTheDocument();
    unmount();
    const image = { originalName: "p.png", mimeType: "image/png", size: 10 };
    const second = renderWithProviders(<ProofLink payment={makePayment({ proofFile: image })} />);
    expect(screen.getByText("Receipt · Image")).toBeInTheDocument();
    second.unmount();
    renderWithProviders(<ProofLink payment={makePayment({ proofUrl: "https://www.example.com/r/1?x=1" })} />);
    expect(screen.getByText("Link · example.com")).toBeInTheDocument();
  });

  it("a file proof points to /api/payments/:id/proof in a new tab", () => {
    renderWithProviders(<ProofLink payment={makePayment({ id: "p7", proofFile: file })} />);
    const link = screen.getByRole("link", { name: /open file/i });
    expect(link).toHaveAttribute("href", "/api/payments/p7/proof");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("on click it opens the tab first, checks the session, then loads the file", async () => {
    const tab = fakeTab();
    vi.mocked(apiFetch).mockResolvedValue({});
    renderWithProviders(<ProofLink payment={makePayment({ id: "p7", proofFile: file })} />);
    await userEvent.click(screen.getByRole("link", { name: /open file/i }));
    await waitFor(() => expect(tab.location.href).toBe("/api/payments/p7/proof"));
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(vi.mocked(apiFetch).mock.calls[0][0]).toBe("/auth/me");
    expect(tab.close).not.toHaveBeenCalled();
  });

  it("closes the blank tab when the session check fails", async () => {
    const tab = fakeTab();
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(401));
    renderWithProviders(<ProofLink payment={makePayment({ proofFile: file })} />);
    await userEvent.click(screen.getByRole("link", { name: /open file/i }));
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(tab.location.href).toBe("");
  });
});
