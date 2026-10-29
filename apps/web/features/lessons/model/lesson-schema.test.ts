import { describe, expect, it } from "vitest";
import { makeLesson } from "../test/fixtures";
import {
  lessonSchema,
  lessonToFormValues,
  rangeToFormValues,
  rangeToUpdatePayload,
  toCreatePayload,
  toSeriesPayload,
  toSplitPayload,
  toUpdatePayload,
  type LessonFormValues,
} from "./lesson-schema";

// 2026-11-03 is a Tuesday.
const valid: LessonFormValues = {
  studentId: "s1",
  date: "2026-11-03",
  time: "10:30",
  durationMin: "60",
  repeatWeekly: false,
};

const errorPaths = (patch: Partial<LessonFormValues>) => {
  const result = lessonSchema.safeParse({ ...valid, ...patch });
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("lessonSchema", () => {
  it("accepts a valid lesson", () => {
    expect(errorPaths({})).toEqual([]);
  });

  it("requires a student, a date and a time", () => {
    expect(errorPaths({ studentId: "" })).toContain("studentId");
    expect(errorPaths({ date: "" })).toContain("date");
    expect(errorPaths({ time: "" })).toContain("time");
  });

  it.each(["2026-13-01", "2026-11-3", "03.11.2026"])("rejects date %j", (date) => {
    expect(errorPaths({ date })).toContain("date");
  });

  it.each(["24:00", "9:30", "10:60", "10-30"])("rejects time %j", (time) => {
    expect(errorPaths({ time })).toContain("time");
  });

  it.each(["15", "60", "240"])("accepts duration %s", (durationMin) => {
    expect(errorPaths({ durationMin })).toEqual([]);
  });

  it.each(["", "14", "241", "45.5", "abc"])("rejects duration %j", (durationMin) => {
    expect(errorPaths({ durationMin })).toContain("durationMin");
  });
});

describe("payloads", () => {
  it("toCreatePayload sends the local date and time as an ISO instant", () => {
    expect(toCreatePayload(valid)).toEqual({
      studentId: "s1",
      startsAt: new Date(2026, 10, 3, 10, 30).toISOString(),
      durationMin: 60,
    });
  });

  // The browser zone is Europe/Belgrade (vitest.config.ts): UTC+1 in November, Moscow is UTC+3.
  it("toSeriesPayload converts the browser input to Moscow weekday, time and date", () => {
    expect(toSeriesPayload({ ...valid, repeatWeekly: true })).toEqual({
      studentId: "s1",
      weekday: 2,
      startTime: "12:30",
      durationMin: 60,
      startsOn: "2026-11-03",
    });
  });

  it("toSeriesPayload changes only the hours when Moscow is the same day", () => {
    expect(toSeriesPayload({ ...valid, date: "2026-11-02", time: "08:00" })).toMatchObject({
      weekday: 1,
      startTime: "10:00",
      startsOn: "2026-11-02",
    });
  });

  it("toSeriesPayload moves weekday and start date past Moscow midnight", () => {
    expect(toSeriesPayload({ ...valid, date: "2026-11-08", time: "23:30" })).toMatchObject({
      weekday: 1,
      startTime: "01:30",
      startsOn: "2026-11-09",
    });
  });

  it("toUpdatePayload has no student (a lesson cannot change student)", () => {
    expect(toUpdatePayload(valid)).toEqual({
      startsAt: new Date(2026, 10, 3, 10, 30).toISOString(),
      durationMin: 60,
    });
  });

  it("toSplitPayload converts the new slot to Moscow time", () => {
    expect(toSplitPayload("l1", valid)).toEqual({ fromLessonId: "l1", weekday: 2, startTime: "12:30", durationMin: 60 });
    expect(toSplitPayload("l1", { ...valid, date: "2026-11-08", time: "23:30" })).toMatchObject({ weekday: 1, startTime: "01:30" });
  });

  it("rangeToUpdatePayload turns a dragged range into start and duration", () => {
    expect(rangeToUpdatePayload({ start: new Date(2026, 10, 3, 9, 0), end: new Date(2026, 10, 3, 10, 30) })).toEqual({
      startsAt: new Date(2026, 10, 3, 9, 0).toISOString(),
      durationMin: 90,
    });
  });
});

describe("form values", () => {
  it("lessonToFormValues shows the lesson in local time", () => {
    const lesson = makeLesson({ startsAt: new Date(2026, 10, 3, 8, 5).toISOString(), durationMin: 45, seriesId: "sr1" });
    expect(lessonToFormValues(lesson)).toEqual({
      studentId: "s1",
      date: "2026-11-03",
      time: "08:05",
      durationMin: "45",
      repeatWeekly: false,
    });
  });

  it("rangeToFormValues prefills date, time and duration from a selected slot", () => {
    expect(rangeToFormValues({ start: new Date(2026, 10, 3, 14, 0), end: new Date(2026, 10, 3, 15, 0) })).toEqual({
      studentId: "",
      date: "2026-11-03",
      time: "14:00",
      durationMin: "60",
      repeatWeekly: false,
    });
  });
});
