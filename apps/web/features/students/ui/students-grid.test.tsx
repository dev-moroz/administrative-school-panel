import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { StudentsGrid } from "./students-grid";

const students = [
  { id: "s1", fullName: "Anna Petrova", telegramUsername: "anna_p1", isActive: true },
  { id: "s2", fullName: "Boris", telegramUsername: null, isActive: true },
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

  it("marks an inactive student with an Inactive badge", () => {
    renderWithProviders(
      <StudentsGrid {...props} view={view} students={[{ ...students[0], isActive: false }]} />,
    );
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows no Inactive badge for active students", () => {
    renderWithProviders(<StudentsGrid {...props} view={view} students={students} />);
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument();
  });

  it("keeps an inactive student clickable", async () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <StudentsGrid {...props} view={view} students={[{ ...students[0], isActive: false }]} onSelect={onSelect} />,
    );
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

describe.each(["cards", "list"] as const)("StudentsGrid balance (%s view)", (view) => {
  // null stands for "threshold not loaded yet".
  const one = (patch: object, threshold: number | null = 2) =>
    renderWithProviders(
      <StudentsGrid
        {...props}
        view={view}
        lowBalanceThreshold={threshold ?? undefined}
        students={[{ ...students[0], balance: 5, ...patch }]}
      />,
    );

  it("shows the remaining lessons without a badge above the threshold", () => {
    one({ balance: 5 });
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("lessons left")).toBeInTheDocument();
    expect(screen.queryByText("Low balance")).not.toBeInTheDocument();
    expect(screen.queryByText("Debt")).not.toBeInTheDocument();
  });

  it("marks a balance at the threshold as Low balance", () => {
    one({ balance: 2 });
    expect(screen.getByText("Low balance")).toBeInTheDocument();
  });

  it("marks a negative balance as Debt, not Low balance", () => {
    one({ balance: -1 });
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText("Debt")).toBeInTheDocument();
    expect(screen.queryByText("Low balance")).not.toBeInTheDocument();
  });

  it("an inactive student gets no Low balance but keeps Debt", () => {
    one({ balance: 1, isActive: false });
    expect(screen.queryByText("Low balance")).not.toBeInTheDocument();
    one({ balance: -1, isActive: false });
    expect(screen.getByText("Debt")).toBeInTheDocument();
  });

  it("shows no Low balance while the threshold is not loaded", () => {
    one({ balance: 1 }, null);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Low balance")).not.toBeInTheDocument();
  });

  it("shows no balance block when the item has no balance", () => {
    renderWithProviders(<StudentsGrid {...props} view={view} lowBalanceThreshold={2} students={[students[0]]} />);
    expect(screen.queryByText("lessons left")).not.toBeInTheDocument();
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
