import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ListPage } from "./list-page";

function setup(pagination?: { page: number; totalPages: number }) {
  const onPageChange = vi.fn();
  renderWithProviders(
    <ListPage
      title="Things"
      toolbar={<div>toolbar slot</div>}
      pagination={pagination && { ...pagination, onPageChange }}
    >
      <div>content slot</div>
    </ListPage>,
  );
  return { onPageChange };
}

describe("ListPage", () => {
  it("renders the title as h1, the toolbar and the content", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Things" })).toBeInTheDocument();
    expect(screen.getByText("toolbar slot")).toBeInTheDocument();
    expect(screen.getByText("content slot")).toBeInTheDocument();
  });

  it("works without a toolbar", () => {
    renderWithProviders(
      <ListPage title="Things">
        <div>content slot</div>
      </ListPage>,
    );
    expect(screen.getByText("content slot")).toBeInTheDocument();
  });

  it("renders no pagination when the prop is omitted", () => {
    setup();
    expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it.each([0, 1])("renders no pagination when there are %s pages", (totalPages) => {
    setup({ page: 1, totalPages });
    expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("first page: shows 'Page 1 of 3' and Next, but no Previous", () => {
    setup({ page: 1, totalPages: 3 });
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("middle page: shows both buttons", () => {
    setup({ page: 2, totalPages: 3 });
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("last page: shows Previous, but no Next", () => {
    setup({ page: 3, totalPages: 3 });
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("Next and Previous call onPageChange with the neighbouring page", async () => {
    const { onPageChange } = setup({ page: 2, totalPages: 3 });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });
});
