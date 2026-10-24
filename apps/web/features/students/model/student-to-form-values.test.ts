import { describe, expect, it } from "vitest";
import { makeStudent } from "../test/fixtures";
import { emptyFormValues, studentToFormValues } from "./student-to-form-values";

describe("studentToFormValues", () => {
  it("maps a full student to form values; the price stays a string", () => {
    expect(studentToFormValues(makeStudent())).toEqual({
      fullName: "Anna Petrova",
      telegramUsername: "anna_p1",
      englishLevel: "B1",
      comment: "Prefers evenings",
      defaultCurrencyCode: "EUR",
      lessonPrice: "50.00",
      isActive: true,
      teacherId: "t1",
    });
  });

  it("turns every null into an empty string", () => {
    const values = studentToFormValues(
      makeStudent({
        telegramUsername: null,
        englishLevel: null,
        comment: null,
        defaultCurrencyCode: null,
        lessonPrice: null,
        teacher: null,
      }),
    );
    expect(values).toMatchObject({
      telegramUsername: "",
      englishLevel: "",
      comment: "",
      defaultCurrencyCode: "",
      lessonPrice: "",
      teacherId: "",
    });
  });

  it("carries isActive=false over", () => {
    expect(studentToFormValues(makeStudent({ isActive: false })).isActive).toBe(false);
  });

  it("emptyFormValues is a blank active student", () => {
    expect(emptyFormValues).toEqual({
      fullName: "",
      telegramUsername: "",
      englishLevel: "",
      comment: "",
      defaultCurrencyCode: "",
      lessonPrice: "",
      isActive: true,
      teacherId: "",
    });
  });
});
