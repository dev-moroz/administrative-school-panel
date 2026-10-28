import { describe, expect, it } from "vitest";
import { makeLesson } from "../test/fixtures";
import { toCalendarEvents } from "./to-calendar-events";

describe("toCalendarEvents", () => {
  it("maps a lesson to an event with start, end from duration and the student as title", () => {
    const [event] = toCalendarEvents([makeLesson({ startsAt: new Date(2026, 10, 3, 10, 0).toISOString(), durationMin: 90 })]);
    expect(event).toMatchObject({ id: "l1", title: "Anna Petrova", status: "SCHEDULED" });
    expect(event.start).toEqual(new Date(2026, 10, 3, 10, 0));
    expect(event.end).toEqual(new Date(2026, 10, 3, 11, 30));
  });

  it("only SCHEDULED lessons are editable (draggable and resizable)", () => {
    const events = toCalendarEvents([
      makeLesson({ id: "a", status: "SCHEDULED" }),
      makeLesson({ id: "b", status: "COMPLETED" }),
      makeLesson({ id: "c", status: "CANCELLED" }),
      makeLesson({ id: "d", status: "NO_SHOW" }),
    ]);
    expect(events.map((e) => [e.id, e.editable])).toEqual([
      ["a", true],
      ["b", false],
      ["c", false],
      ["d", false],
    ]);
  });

  it("gives each status its own color class", () => {
    const classes = toCalendarEvents(
      (["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const).map((status, i) => makeLesson({ id: String(i), status })),
    ).map((e) => e.className);
    expect(classes.every(Boolean)).toBe(true);
    expect(new Set(classes).size).toBe(4);
  });

  it("marks series lessons", () => {
    const [oneOff, series] = toCalendarEvents([makeLesson({ id: "a" }), makeLesson({ id: "b", seriesId: "sr1", originalDate: "2026-11-03" })]);
    expect(oneOff.isSeries).toBe(false);
    expect(series.isSeries).toBe(true);
  });

  it("falls back to a dash when the lesson has no student", () => {
    expect(toCalendarEvents([makeLesson({ student: null })])[0].title).toBe("—");
  });
});
