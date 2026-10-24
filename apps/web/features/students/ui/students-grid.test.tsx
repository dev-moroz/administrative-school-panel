import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { StudentsGrid } from "./students-grid";

const students = [
  { id: "s1", fullName: "Anna Petrova", telegramUsername: "anna_p1" },
  { id: "s2", fullName: "Boris", telegramUsername: null },
];

const props = { isLoading: false, isError: false, onRetry: () => {}, onSelect: () => {} };

describe.each(["cards", "list"] as const)("StudentsGrid (%s view)", (view) => {
  it("shows the name and @nickname of every student", () => {
    renderWithProviders(<StudentsGrid {...props} view={view} students={students} />);
    expect(screen.getByText("Anna Petrova")).toBeInTheDocument();
    expect(screen.getByText("@anna_p1")).toBeInTheDocument();
    expect(screen.getByText("Boris")).toBeInTheDocument();
  });

  it("shows no @ for a student without a nickname", () => {
    renderWithProviders(<StudentsGrid {...props} view={view} students={[students[1]]} />);
    expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
  });

  it("shows initials: two letters for two words, one for a single word", () => {
    renderWithProviders(<StudentsGrid {...props} view={view} students={students} />);
    expect(screen.getByText("AP")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("calls onSelect with the student id on click", async () => {
    const onSelect = vi.fn();
    renderWithProviders(<StudentsGrid {...props} view={view} students={students} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Anna Petrova/ }));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("shows a busy skeleton while loading and no students", () => {
    const { container } = renderWithProviders(
      <StudentsGrid {...props} view={view} students={undefined} isLoading />,
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText("No students found")).not.toBeInTheDocument();
  });

  it("shows an empty message when there are no students", () => {
    renderWithProviders(<StudentsGrid {...props} view={view} students={[]} />);
    expect(screen.getByText("No students found")).toBeInTheDocument();
  });

  it("shows an error with a Retry button that calls onRetry", async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <StudentsGrid {...props} view={view} students={undefined} isError onRetry={onRetry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load students");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("StudentsGrid layout", () => {
  it("cards use a responsive 1/2/3/4 column grid", () => {
    const { container } = renderWithProviders(
      <StudentsGrid {...props} view="cards" students={students} />,
    );
    const grid = container.querySelector("[data-view='cards']");
    expect(grid).toHaveClass("grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3", "xl:grid-cols-4");
  });

  it("list view is a single column, not a table", () => {
    const { container } = renderWithProviders(
      <StudentsGrid {...props} view="list" students={students} />,
    );
    expect(container.querySelector("[data-view='list']")).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
  });
});
