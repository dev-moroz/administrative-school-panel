import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { makeStudent } from "../test/fixtures";
import { StudentDetails } from "./student-details";

const props = { canEdit: true, onEdit: () => {} };

describe("StudentDetails (read only view)", () => {
  it("shows the profile data as plain text, with no inputs", () => {
    renderWithProviders(<StudentDetails {...props} student={makeStudent()} />);
    expect(screen.getByText("Anna Petrova")).toBeInTheDocument();
    expect(screen.getByText("@anna_p1")).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.getByText("50.00 EUR")).toBeInTheDocument();
    expect(screen.getByText("Prefers evenings")).toBeInTheDocument();
    expect(screen.getByText("Olga Smirnova")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows a dash for every empty value", () => {
    renderWithProviders(
      <StudentDetails
        {...props}
        student={makeStudent({
          telegramUsername: null,
          englishLevel: null,
          comment: null,
          defaultCurrencyCode: null,
          lessonPrice: null,
          teacher: null,
        })}
      />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
  });

  it("shows the Active / Inactive status", () => {
    const { unmount } = renderWithProviders(<StudentDetails {...props} student={makeStudent()} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    unmount();
    renderWithProviders(<StudentDetails {...props} student={makeStudent({ isActive: false })} />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("marks Telegram as linked or not linked", () => {
    const { unmount } = renderWithProviders(<StudentDetails {...props} student={makeStudent()} />);
    expect(screen.getByLabelText("Telegram linked")).toBeInTheDocument();
    unmount();
    renderWithProviders(<StudentDetails {...props} student={makeStudent({ telegramLinked: false })} />);
    expect(screen.getByLabelText("Telegram not linked")).toBeInTheDocument();
  });

  it("the Edit button calls onEdit", async () => {
    const onEdit = vi.fn();
    renderWithProviders(<StudentDetails {...props} student={makeStudent()} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("hides the Edit button without the update permission", () => {
    renderWithProviders(<StudentDetails {...props} canEdit={false} student={makeStudent()} />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
