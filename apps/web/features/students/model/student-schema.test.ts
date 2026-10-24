import { describe, expect, it } from "vitest";
import { studentSchema, toPayload, type StudentFormValues } from "./student-schema";

const base: StudentFormValues = {
  fullName: "Anna Petrova",
  telegramUsername: "",
  englishLevel: "",
  comment: "",
  defaultCurrencyCode: "",
  lessonPrice: "",
  isActive: true,
};

const parse = (patch: Record<string, string | boolean>) => studentSchema.safeParse({ ...base, ...patch });

describe("studentSchema", () => {
  it("accepts a student with only a name", () => {
    expect(parse({}).success).toBe(true);
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(parse({ fullName: "" }).success).toBe(false);
    expect(parse({ fullName: "   " }).success).toBe(false);
  });

  it("rejects a name longer than 120 characters", () => {
    expect(parse({ fullName: "a".repeat(121) }).success).toBe(false);
    expect(parse({ fullName: "a".repeat(120) }).success).toBe(true);
  });

  it("strips a leading @ and spaces from the Telegram nickname", () => {
    const res = parse({ telegramUsername: "  @anna_p1 " });
    expect(res.success && res.data.telegramUsername).toBe("anna_p1");
  });

  it("rejects a nickname shorter than 5 characters, longer than 32, or with bad characters", () => {
    expect(parse({ telegramUsername: "@anna1" }).success).toBe(true);
    expect(parse({ telegramUsername: "@anna" }).success).toBe(false);
    expect(parse({ telegramUsername: "@ann" }).success).toBe(false);
    expect(parse({ telegramUsername: "a".repeat(33) }).success).toBe(false);
    expect(parse({ telegramUsername: "anna-p" }).success).toBe(false);
  });

  it("allows an empty nickname", () => {
    expect(parse({ telegramUsername: "" }).success).toBe(true);
  });

  it("accepts the English levels A0..C2 and an empty level only", () => {
    for (const level of ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]) {
      expect(parse({ englishLevel: level }).success).toBe(true);
    }
    expect(parse({ englishLevel: "" }).success).toBe(true);
    expect(parse({ englishLevel: "D1" }).success).toBe(false);
  });

  it("limits the comment to 2000 characters", () => {
    expect(parse({ comment: "x".repeat(2000) }).success).toBe(true);
    expect(parse({ comment: "x".repeat(2001) }).success).toBe(false);
  });

  it("accepts prices with up to 2 decimals", () => {
    for (const price of ["", "0", "50", "50.5", "50.55", "9999999999.99"]) {
      expect(parse({ lessonPrice: price }).success, price).toBe(true);
    }
  });

  it("rejects prices with 3 decimals, negative, non-numeric or above the maximum", () => {
    for (const price of ["50.555", "-1", "abc", "10000000000"]) {
      expect(parse({ lessonPrice: price }).success, price).toBe(false);
    }
  });
});

describe("toPayload", () => {
  const filled: StudentFormValues = {
    fullName: "Anna Petrova",
    telegramUsername: "anna_p1",
    englishLevel: "B1",
    comment: "Prefers evenings",
    defaultCurrencyCode: "EUR",
    lessonPrice: "50.5",
    isActive: false,
  };

  it("create: sends filled fields, the price as a number, and no isActive", () => {
    expect(toPayload(filled, "create")).toEqual({
      fullName: "Anna Petrova",
      telegramUsername: "anna_p1",
      englishLevel: "B1",
      comment: "Prefers evenings",
      defaultCurrencyCode: "EUR",
      lessonPrice: 50.5,
    });
  });

  it("create: leaves empty optional fields out", () => {
    expect(toPayload(base, "create")).toEqual({ fullName: "Anna Petrova" });
  });

  it("edit: sends null for emptied optional fields so the API clears them", () => {
    expect(toPayload(base, "edit")).toEqual({
      fullName: "Anna Petrova",
      telegramUsername: null,
      englishLevel: null,
      comment: null,
      defaultCurrencyCode: null,
      lessonPrice: null,
      isActive: true,
    });
  });

  it("edit: sends filled fields and isActive", () => {
    expect(toPayload(filled, "edit")).toEqual({
      fullName: "Anna Petrova",
      telegramUsername: "anna_p1",
      englishLevel: "B1",
      comment: "Prefers evenings",
      defaultCurrencyCode: "EUR",
      lessonPrice: 50.5,
      isActive: false,
    });
  });

  it("keeps a zero price (0 is a value, not empty)", () => {
    expect(toPayload({ ...base, lessonPrice: "0" }, "create")).toEqual({
      fullName: "Anna Petrova",
      lessonPrice: 0,
    });
  });
});

describe("toPayload teacherId", () => {
  it("create: sends teacherId when chosen", () => {
    expect(toPayload({ ...base, teacherId: "t1" }, "create")).toMatchObject({ teacherId: "t1" });
  });

  it("create: omits teacherId when empty or missing", () => {
    expect(toPayload({ ...base, teacherId: "" }, "create")).not.toHaveProperty("teacherId");
    expect(toPayload(base, "create")).not.toHaveProperty("teacherId");
  });

  it("edit: never sends teacherId (the API has no way to change the teacher)", () => {
    expect(toPayload({ ...base, teacherId: "t1" }, "edit")).not.toHaveProperty("teacherId");
  });

  it("the schema accepts a missing and a filled teacherId", () => {
    expect(studentSchema.safeParse(base).success).toBe(true);
    expect(studentSchema.safeParse({ ...base, teacherId: "t1" }).success).toBe(true);
  });
});
