import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, apiFetch } from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import { useStudents } from "../model/use-students";
import type { Currency } from "@/features/currencies/model/types";
import type { PaymentMethod } from "@/features/payment-methods/model/types";
import { makePaymentMethod, paymentMethods } from "@/features/payment-methods/test/fixtures";
import { currencies, makeStudent, teachers } from "../test/fixtures";
import { StudentSheet, type SheetTarget } from "./student-sheet";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ADMIN = ["students.read.all", "students.create", "students.update", "students.assign-teacher", "currencies.read", "payment-methods.read"];
const TEACHER = ["students.read.all", "students.create", "students.update", "currencies.read"];

type Opts = { currencyList?: Currency[]; methodList?: PaymentMethod[]; permissions?: string[]; student?: ReturnType<typeof makeStudent>; getError?: ApiError; saveError?: ApiError; save?: Promise<unknown>; conflict?: object };

let opts: Opts;

function mockApi(next: Opts = {}) {
  opts = next;
  vi.mocked(apiFetch).mockImplementation(async (path: string, init?: RequestInit) => {
    const url = new URL(path, "http://x");
    const method = init?.method ?? "GET";
    if (url.pathname === "/auth/me")
      return { id: "u1", email: "a@b.c", role: "admin", permissions: opts.permissions ?? ADMIN };
    if (url.pathname === "/currencies") return opts.currencyList ?? currencies;
    if (url.pathname === "/payment-methods") return opts.methodList ?? paymentMethods;
    if (url.pathname === "/teachers") return teachers;
    if (url.pathname === "/lessons" || url.pathname === "/absences") return [];
    if (url.pathname === "/students" && method === "GET")
      return { items: [], total: 0, page: 1, pageSize: 12 };
    if (url.pathname === "/students" && method === "POST") {
      if (opts.saveError) throw opts.saveError;
      return makeStudent({ id: "new-id", ...JSON.parse(String(init?.body)) });
    }
    if (url.pathname === "/students/s1" && method === "GET") {
      if (opts.getError) throw opts.getError;
      return opts.student ?? makeStudent();
    }
    if (url.pathname === "/students/s1" && method === "PATCH") {
      if (opts.save) await opts.save;
      if (opts.saveError) throw opts.saveError;
      if (opts.conflict && !JSON.parse(String(init?.body)).deleteFutureLessons)
        throw new ApiError(409, undefined, { code: "STUDENT_HAS_FUTURE_LESSONS", message: "x", ...opts.conflict });
      return makeStudent({ ...(opts.student ?? {}), ...JSON.parse(String(init?.body)) });
    }
    throw new Error(`unexpected ${method} ${path}`);
  });
}

const calls = (method: string, pathname: string) =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(([p, i]) => new URL(p as string, "http://x").pathname === pathname && (i?.method ?? "GET") === method);

function ListProbe() {
  useStudents({ page: 1, pageSize: 12 });
  return null;
}

function setup(target: SheetTarget) {
  const onTargetChange = vi.fn();
  renderWithProviders(
    <>
      <ListProbe />
      <StudentSheet target={target} onTargetChange={onTargetChange} />
    </>,
  );
  return { onTargetChange };
}

const VIEW: SheetTarget = { kind: "view", id: "s1" };
const CREATE: SheetTarget = { kind: "create" };

async function openEdit() {
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  return screen.findByLabelText("Full name");
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(toast.success).mockReset();
});

describe("StudentSheet: view", () => {
  it("opens in read-only view mode and loads GET /students/:id", async () => {
    mockApi();
    setup(VIEW);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Anna Petrova")).toBeInTheDocument();
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(calls("GET", "/students/s1")).toHaveLength(1);
  });

  it("shows a busy skeleton while the student loads", async () => {
    mockApi();
    setup(VIEW);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("404: shows 'Student not found' and no details", async () => {
    mockApi({ getError: new ApiError(404) });
    setup(VIEW);
    expect(await screen.findByText("Student not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("other load errors show a message with Retry", async () => {
    mockApi({ getError: new ApiError(500) });
    setup(VIEW);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load student");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("closing in view mode asks nothing and reports closed", async () => {
    mockApi();
    const { onTargetChange } = setup(VIEW);
    await screen.findByText("Anna Petrova");
    await userEvent.keyboard("{Escape}");
    expect(onTargetChange).toHaveBeenCalledWith({ kind: "closed" });
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
  });

  it("closed target renders no dialog and makes no requests for the student", () => {
    mockApi();
    setup({ kind: "closed" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls("GET", "/students/s1")).toHaveLength(0);
  });
});

describe("StudentSheet: edit", () => {
  it("Edit switches the same panel to a prefilled form", async () => {
    mockApi();
    setup(VIEW);
    const name = await openEdit();
    expect(name).toHaveValue("Anna Petrova");
    expect(screen.getByRole("switch", { name: "Active" })).toBeChecked();
  });

  it("Cancel without changes returns to view with no confirmation", async () => {
    mockApi();
    setup(VIEW);
    await openEdit();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("Save sends PATCH (empty fields as null, no teacherId), toasts, stays open in view with new data", async () => {
    mockApi();
    const { onTargetChange } = setup(VIEW);
    const name = await openEdit();
    await userEvent.clear(name);
    await userEvent.type(name, "Anna P.");
    await userEvent.clear(screen.getByLabelText("Comment"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(calls("PATCH", "/students/s1")).toHaveLength(1));
    const body = JSON.parse(String(calls("PATCH", "/students/s1")[0][1]?.body));
    expect(body).toMatchObject({ fullName: "Anna P.", comment: null, isActive: true, lessonPrice: 50 });
    expect(body).not.toHaveProperty("teacherId");
    expect(toast.success).toHaveBeenCalledWith("Changes saved");
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText("Anna P.")).toBeInTheDocument();
    expect(onTargetChange).not.toHaveBeenCalled();
  });

  it("Save refreshes the students list", async () => {
    mockApi();
    setup(VIEW);
    await waitFor(() => expect(calls("GET", "/students")).toHaveLength(1));
    const name = await openEdit();
    await userEvent.type(name, "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls("GET", "/students").length).toBeGreaterThan(1));
  });

  it("400 keeps the form open with typed values and a message", async () => {
    mockApi({ saveError: new ApiError(400) });
    const { onTargetChange } = setup(VIEW);
    const name = await openEdit();
    await userEvent.type(name, "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the entered data");
    expect(screen.getByLabelText("Full name")).toHaveValue("Anna Petrovax");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(onTargetChange).not.toHaveBeenCalled();
  });

  it("403 shows a permission message", async () => {
    mockApi({ saveError: new ApiError(403) });
    setup(VIEW);
    const name = await openEdit();
    await userEvent.type(name, "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission");
  });

  it("disables Save and Cancel while the request is in flight", async () => {
    let release!: () => void;
    mockApi({ save: new Promise<void>((r) => (release = r)) });
    setup(VIEW);
    const name = await openEdit();
    await userEvent.type(name, "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    release();
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("without students.update there is no Edit button", async () => {
    mockApi({ permissions: ["students.read.all"] });
    setup(VIEW);
    await screen.findByText("Anna Petrova");
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});

describe("StudentSheet: create", () => {
  async function fillAndSave(teacher?: string) {
    await userEvent.type(await screen.findByLabelText("Full name"), "Boris Ivanov");
    if (teacher) {
      await userEvent.click(screen.getByRole("combobox", { name: "Teacher" }));
      await userEvent.click(await screen.findByRole("option", { name: teacher }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
  }

  it("opens as an empty form and does not load a student", async () => {
    mockApi();
    setup(CREATE);
    expect(await screen.findByLabelText("Full name")).toHaveValue("");
    expect(screen.queryByRole("switch", { name: "Active" })).not.toBeInTheDocument();
  });

  it("admin: Save sends POST with the chosen teacherId, toasts and switches to view of the new student", async () => {
    mockApi();
    const { onTargetChange } = setup(CREATE);
    await fillAndSave("Ivan Petrov");

    await waitFor(() => expect(calls("POST", "/students")).toHaveLength(1));
    const body = JSON.parse(String(calls("POST", "/students")[0][1]?.body));
    expect(body).toEqual({ fullName: "Boris Ivanov", teacherId: "t2" });
    expect(toast.success).toHaveBeenCalledWith("Student created");
    await waitFor(() => expect(onTargetChange).toHaveBeenCalledWith({ kind: "view", id: "new-id" }));
    expect(onTargetChange).not.toHaveBeenCalledWith({ kind: "closed" });
  });

  it("create refreshes the students list", async () => {
    mockApi();
    setup(CREATE);
    await waitFor(() => expect(calls("GET", "/students")).toHaveLength(1));
    await fillAndSave("Ivan Petrov");
    await waitFor(() => expect(calls("GET", "/students").length).toBeGreaterThan(1));
  });

  it("teacher role: no Teacher field, /teachers is not requested, POST has no teacherId", async () => {
    mockApi({ permissions: TEACHER });
    setup(CREATE);
    await fillAndSave();
    await waitFor(() => expect(calls("POST", "/students")).toHaveLength(1));
    expect(screen.queryByRole("combobox", { name: "Teacher" })).not.toBeInTheDocument();
    expect(calls("GET", "/teachers")).toHaveLength(0);
    expect(JSON.parse(String(calls("POST", "/students")[0][1]?.body))).toEqual({ fullName: "Boris Ivanov" });
  });

  it("a failed POST keeps the form and typed values", async () => {
    mockApi({ saveError: new ApiError(400) });
    const { onTargetChange } = setup(CREATE);
    await fillAndSave("Ivan Petrov");
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the entered data");
    expect(screen.getByLabelText("Full name")).toHaveValue("Boris Ivanov");
    expect(onTargetChange).not.toHaveBeenCalled();
  });

  it("closing an untouched create form asks nothing", async () => {
    mockApi();
    const { onTargetChange } = setup(CREATE);
    await screen.findByLabelText("Full name");
    await userEvent.keyboard("{Escape}");
    expect(onTargetChange).toHaveBeenCalledWith({ kind: "closed" });
  });
});

describe("StudentSheet: discard changes", () => {
  it("closing a dirty edit form asks first; Keep editing leaves everything as is", async () => {
    mockApi();
    const { onTargetChange } = setup(VIEW);
    const name = await openEdit();
    await userEvent.type(name, "x");
    await userEvent.keyboard("{Escape}");
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(onTargetChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Anna Petrovax");
  });

  it("closing a dirty edit form and choosing Discard closes the panel", async () => {
    mockApi();
    const { onTargetChange } = setup(VIEW);
    const name = await openEdit();
    await userEvent.type(name, "x");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onTargetChange).toHaveBeenCalledWith({ kind: "closed" });
  });

  it("Cancel on a dirty edit form asks; Discard returns to view with the original data", async () => {
    mockApi();
    const { onTargetChange } = setup(VIEW);
    const name = await openEdit();
    await userEvent.type(name, "x");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByText("Anna Petrova")).toBeInTheDocument();
    expect(onTargetChange).not.toHaveBeenCalled();
  });

  it("closing a dirty create form asks first", async () => {
    mockApi();
    const { onTargetChange } = setup(CREATE);
    await userEvent.type(await screen.findByLabelText("Full name"), "B");
    await userEvent.keyboard("{Escape}");
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(onTargetChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onTargetChange).toHaveBeenCalledWith({ kind: "closed" });
  });
});

function Reopenable() {
  const [target, setTarget] = useState<SheetTarget>(VIEW);
  return (
    <>
      <button onClick={() => setTarget(VIEW)}>Reopen</button>
      <StudentSheet target={target} onTargetChange={setTarget} />
    </>
  );
}

describe("StudentSheet: reopening", () => {
  it("closing in edit mode and reopening the same student shows view mode", async () => {
    mockApi();
    renderWithProviders(<Reopenable />);
    await openEdit();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
  });

  it("discarding a dirty edit form on close and reopening shows view mode", async () => {
    mockApi();
    renderWithProviders(<Reopenable />);
    await userEvent.type(await openEdit(), "x");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
  });
});

describe("StudentSheet: inactive currencies", () => {
  const withInactive: Currency[] = [...currencies, { code: "CHF", name: "Swiss franc", decimals: 2, isActive: false }];

  it("create: an inactive currency is not offered, active ones are", async () => {
    mockApi({ currencyList: withInactive });
    setup(CREATE);
    await userEvent.click(await screen.findByRole("combobox", { name: "Currency" }));
    expect(await screen.findByRole("option", { name: /^GBP/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /CHF/ })).not.toBeInTheDocument();
  });

  it("edit: the student's own currency stays selected and selectable even if it is inactive", async () => {
    mockApi({ currencyList: withInactive, student: makeStudent({ defaultCurrencyCode: "CHF" }) });
    setup(VIEW);
    await openEdit();
    const select = screen.getByRole("combobox", { name: "Currency" });
    expect(select).toHaveTextContent("CHF");
    await userEvent.click(select);
    expect(await screen.findByRole("option", { name: "CHF" })).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: /CHF/ })).toHaveLength(1);
  });

  it("edit: other inactive currencies are not offered", async () => {
    mockApi({ currencyList: withInactive });
    setup(VIEW);
    await openEdit();
    await userEvent.click(screen.getByRole("combobox", { name: "Currency" }));
    expect(await screen.findByRole("option", { name: /^GBP/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /CHF/ })).not.toBeInTheDocument();
  });
});

describe("StudentSheet: default payment method", () => {
  const withInactive: PaymentMethod[] = [...paymentMethods, makePaymentMethod({ code: "OLD", name: "Old method", icon: "wallet", isActive: false })];

  it("view: shows the student's method by name", async () => {
    mockApi({ student: makeStudent({ defaultPaymentMethodCode: "CARD" }) });
    setup(VIEW);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Payment method")).toBeInTheDocument();
    expect(await within(dialog).findByText("Card")).toBeInTheDocument();
  });

  it("view: an inactive method is still shown by name for a user who can see all methods", async () => {
    mockApi({ methodList: withInactive, student: makeStudent({ defaultPaymentMethodCode: "OLD" }) });
    setup(VIEW);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Old method")).toBeInTheDocument();
  });

  it("edit: Save sends the chosen method code in PATCH", async () => {
    mockApi({ student: makeStudent({ defaultPaymentMethodCode: "CARD" }) });
    setup(VIEW);
    await openEdit();
    await userEvent.click(screen.getByRole("combobox", { name: "Payment method" }));
    await userEvent.click(await screen.findByRole("option", { name: "Cash" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls("PATCH", "/students/s1")).toHaveLength(1));
    expect(JSON.parse(String(calls("PATCH", "/students/s1")[0][1]?.body))).toMatchObject({ defaultPaymentMethodCode: "CASH" });
  });

  it("edit: clearing the method sends null", async () => {
    mockApi({ student: makeStudent({ defaultPaymentMethodCode: "CARD" }) });
    setup(VIEW);
    await openEdit();
    await userEvent.click(screen.getByRole("combobox", { name: "Payment method" }));
    await userEvent.click(await screen.findByRole("option", { name: "Not set" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls("PATCH", "/students/s1")).toHaveLength(1));
    expect(JSON.parse(String(calls("PATCH", "/students/s1")[0][1]?.body))).toMatchObject({ defaultPaymentMethodCode: null });
  });

  it("create: an inactive method is not offered, active ones are", async () => {
    mockApi({ methodList: withInactive });
    setup(CREATE);
    await userEvent.click(await screen.findByRole("combobox", { name: "Payment method" }));
    expect(await screen.findByRole("option", { name: "Cash" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /OLD|Old method/ })).not.toBeInTheDocument();
  });

  it("edit: the student's own inactive method stays selected and selectable, other inactive ones are not offered", async () => {
    const list = [...withInactive, makePaymentMethod({ code: "GONE", name: "Gone method", icon: "wallet", isActive: false })];
    mockApi({ methodList: list, student: makeStudent({ defaultPaymentMethodCode: "OLD" }) });
    setup(VIEW);
    await openEdit();
    const select = screen.getByRole("combobox", { name: "Payment method" });
    expect(select).toHaveTextContent("OLD");
    await userEvent.click(select);
    expect(await screen.findByRole("option", { name: "OLD" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Gone method|GONE/ })).not.toBeInTheDocument();
  });
});

describe("StudentSheet: deactivation with future lessons", () => {
  async function deactivate() {
    await openEdit();
    await userEvent.click(screen.getByRole("switch", { name: "Active" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    return screen.findByRole("alertdialog");
  }

  it("409 STUDENT_HAS_FUTURE_LESSONS opens a dialog with the number of lessons and no form error", async () => {
    mockApi({ conflict: { futureLessons: 4, keptLessons: 0 } });
    setup(VIEW);
    const dialog = await deactivate();
    expect(within(dialog).getByText(/4 future lessons will be deleted/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/charged/)).not.toBeInTheDocument();
    expect(screen.queryByText("Could not save. Try again")).not.toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows the kept charged lessons line when there are any", async () => {
    mockApi({ conflict: { futureLessons: 2, keptLessons: 1 } });
    setup(VIEW);
    const dialog = await deactivate();
    expect(within(dialog).getByText(/1 charged lesson is kept/)).toBeInTheDocument();
  });

  it("Deactivate anyway repeats PATCH with deleteFutureLessons, toasts and returns to view", async () => {
    mockApi({ conflict: { futureLessons: 4, keptLessons: 0 } });
    setup(VIEW);
    const dialog = await deactivate();
    await userEvent.click(within(dialog).getByRole("button", { name: "Deactivate anyway" }));

    await waitFor(() => expect(calls("PATCH", "/students/s1")).toHaveLength(2));
    const body = JSON.parse(String(calls("PATCH", "/students/s1")[1][1]?.body));
    expect(body).toMatchObject({ isActive: false, deleteFutureLessons: true });
    expect(toast.success).toHaveBeenCalledWith("Changes saved");
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("a saved deactivation refreshes loaded lessons and absences", async () => {
    function CacheProbe() {
      useQuery({ queryKey: ["lessons", "range"], queryFn: () => apiFetch("/lessons") });
      useQuery({ queryKey: ["absences", "owner"], queryFn: () => apiFetch("/absences") });
      return null;
    }
    mockApi({ conflict: { futureLessons: 4, keptLessons: 0 } });
    renderWithProviders(
      <>
        <CacheProbe />
        <StudentSheet target={VIEW} onTargetChange={vi.fn()} />
      </>,
    );
    await waitFor(() => expect(calls("GET", "/lessons")).toHaveLength(1));
    const dialog = await deactivate();
    await userEvent.click(within(dialog).getByRole("button", { name: "Deactivate anyway" }));

    await waitFor(() => expect(calls("GET", "/lessons")).toHaveLength(2));
    await waitFor(() => expect(calls("GET", "/absences")).toHaveLength(2));
  });

  it("Cancel closes the dialog, keeps the form with its edits and sends nothing more", async () => {
    mockApi({ conflict: { futureLessons: 4, keptLessons: 0 } });
    setup(VIEW);
    const dialog = await deactivate();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("switch", { name: "Active" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(calls("PATCH", "/students/s1")).toHaveLength(1);
  });

  it("another 409 shows the usual form error and no dialog", async () => {
    mockApi({ saveError: new ApiError(409, undefined, { code: "OTHER" }) });
    setup(VIEW);
    await openEdit();
    await userEvent.click(screen.getByRole("switch", { name: "Active" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
