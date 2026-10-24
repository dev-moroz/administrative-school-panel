import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { emptyFormValues, studentToFormValues } from "../model/student-to-form-values";
import { currencies, makeStudent, teachers } from "../test/fixtures";
import { StudentForm } from "./student-form";

const baseProps = {
  mode: "create" as const,
  defaultValues: emptyFormValues,
  currencies,
  teachers: [],
  canAssignTeacher: false,
  teacherName: null,
  isSubmitting: false,
  errorMessage: null,
  onSubmit: () => {},
  onCancel: () => {},
  onDirtyChange: () => {},
};

const save = () => screen.getByRole("button", { name: "Save" });

describe("StudentForm validation", () => {
  it("blocks submit and shows an error for an empty name", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<StudentForm {...baseProps} onSubmit={onSubmit} />);
    await userEvent.click(save());
    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks a nickname shorter than 5 characters (Telegram minimum)", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<StudentForm {...baseProps} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Full name"), "Anna");
    await userEvent.type(screen.getByLabelText("Telegram nickname"), "abc");
    await userEvent.click(save());
    expect(await screen.findByText("5–32 letters, digits or underscores")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks a price with 3 decimals and a negative price", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<StudentForm {...baseProps} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Full name"), "Anna");
    const price = screen.getByLabelText("Lesson price");
    await userEvent.type(price, "10.123");
    await userEvent.click(save());
    expect(await screen.findByText("Up to 2 decimals, 0 or more")).toBeInTheDocument();
    await userEvent.clear(price);
    await userEvent.type(price, "-5");
    await userEvent.click(save());
    expect(screen.getByText("Up to 2 decimals, 0 or more")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid values with a normalised nickname (leading @ is stripped)", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<StudentForm {...baseProps} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Full name"), "Anna Petrova");
    await userEvent.type(screen.getByLabelText("Telegram nickname"), "@anna_p1");
    await userEvent.type(screen.getByLabelText("Lesson price"), "50.5");
    await userEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      fullName: "Anna Petrova",
      telegramUsername: "anna_p1",
      lessonPrice: "50.5",
    });
  });
});

describe("StudentForm modes", () => {
  it("create mode has no Active switch; edit mode has it", () => {
    const { unmount } = renderWithProviders(<StudentForm {...baseProps} />);
    expect(screen.queryByRole("switch", { name: "Active" })).not.toBeInTheDocument();
    unmount();
    renderWithProviders(
      <StudentForm {...baseProps} mode="edit" defaultValues={studentToFormValues(makeStudent())} />,
    );
    expect(screen.getByRole("switch", { name: "Active" })).toBeChecked();
  });

  it("edit mode is prefilled with the student's data", () => {
    renderWithProviders(
      <StudentForm {...baseProps} mode="edit" defaultValues={studentToFormValues(makeStudent())} />,
    );
    expect(screen.getByLabelText("Full name")).toHaveValue("Anna Petrova");
    expect(screen.getByLabelText("Telegram nickname")).toHaveValue("anna_p1");
    expect(screen.getByLabelText("Lesson price")).toHaveValue("50.00");
    expect(screen.getByLabelText("Comment")).toHaveValue("Prefers evenings");
    expect(screen.getByRole("combobox", { name: "English level" })).toHaveTextContent("B1");
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent("EUR");
  });

  it("keeps a currency that is not in the options list (e.g. deactivated) selected", () => {
    renderWithProviders(
      <StudentForm
        {...baseProps}
        mode="edit"
        defaultValues={studentToFormValues(makeStudent({ defaultCurrencyCode: "USD" }))}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent("USD");
  });
});

describe("StudentForm teacher field", () => {
  it("is hidden without students.assign-teacher", () => {
    renderWithProviders(<StudentForm {...baseProps} teachers={teachers} />);
    expect(screen.queryByRole("combobox", { name: "Teacher" })).not.toBeInTheDocument();
  });

  it("create + assign-teacher: required, blocks submit until chosen", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<StudentForm {...baseProps} canAssignTeacher teachers={teachers} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Full name"), "Anna");
    await userEvent.click(save());
    expect(await screen.findByText("Choose a teacher")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("combobox", { name: "Teacher" }));
    await userEvent.click(await screen.findByRole("option", { name: "Ivan Petrov" }));
    await userEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ teacherId: "t2" });
  });

  it("edit mode shows the teacher as text, not as a select", () => {
    renderWithProviders(
      <StudentForm
        {...baseProps}
        mode="edit"
        canAssignTeacher
        teachers={teachers}
        teacherName="Olga Smirnova"
        defaultValues={studentToFormValues(makeStudent())}
      />,
    );
    expect(screen.getByText("Olga Smirnova")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Teacher" })).not.toBeInTheDocument();
  });
});

describe("StudentForm state", () => {
  it("disables Save and Cancel while submitting", () => {
    renderWithProviders(<StudentForm {...baseProps} isSubmitting />);
    expect(save()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("shows the error message passed in as an alert", () => {
    renderWithProviders(<StudentForm {...baseProps} errorMessage="Check the entered data" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Check the entered data");
  });

  it("Cancel calls onCancel", async () => {
    const onCancel = vi.fn();
    renderWithProviders(<StudentForm {...baseProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("reports dirtiness: false when untouched, true after typing", async () => {
    const onDirtyChange = vi.fn();
    renderWithProviders(<StudentForm {...baseProps} onDirtyChange={onDirtyChange} />);
    expect(onDirtyChange).not.toHaveBeenCalledWith(true);
    await userEvent.type(screen.getByLabelText("Full name"), "A");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});
