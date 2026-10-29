"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import monarchThemePlugin from "@fullcalendar/react/themes/monarch";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { useTheme } from "next-themes";
import type { CalendarEvent, DateRange, LessonStatus, TimeRange } from "../model/types";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import "@fullcalendar/react/themes/monarch/palettes/green.css";

export type CalendarViewProps = {
  events: CalendarEvent[];
  selectable: boolean;
  onRangeChange: (range: DateRange) => void;
  onSlotSelect: (range: TimeRange) => void;
  onEventClick: (id: string) => void;
  onEventChange: (change: TimeRange & { id: string; revert: () => void }) => void;
};

type ChangeInfo = Parameters<NonNullable<React.ComponentProps<typeof FullCalendar>["eventChange"]>>[0];
type SelectInfo = Parameters<NonNullable<React.ComponentProps<typeof FullCalendar>["select"]>>[0];

const DEFAULT_START_HOUR = 10;
const DEFAULT_DURATION_MS = 60 * 60_000;

// Monarch palette variables, so the colors follow the light and dark scheme.
const STATUS_COLORS: Record<LessonStatus, { color: string; contrastColor: string }> = {
  SCHEDULED: { color: "var(--fc-monarch-secondary)", contrastColor: "var(--fc-monarch-secondary-foreground)" },
  COMPLETED: { color: "var(--fc-monarch-primary)", contrastColor: "var(--fc-monarch-primary-foreground)" },
  CANCELLED: { color: "var(--fc-monarch-strong)", contrastColor: "var(--fc-monarch-muted-foreground)" },
  NO_SHOW: { color: "var(--fc-monarch-strong)", contrastColor: "var(--fc-monarch-muted-foreground)" },
};

// The only place that knows FullCalendar: the rest of the app works with our types.
export function CalendarView({ events, selectable, onRangeChange, onSlotSelect, onEventClick, onEventChange }: CalendarViewProps) {
  const { resolvedTheme } = useTheme();

  function select(info: SelectInfo) {
    info.view.calendar.unselect();
    // A day picked in the month view has no time yet.
    if (info.allDay) {
      const start = new Date(info.start);
      start.setHours(DEFAULT_START_HOUR, 0, 0, 0);
      onSlotSelect({ start, end: new Date(start.getTime() + DEFAULT_DURATION_MS) });
      return;
    }
    onSlotSelect({ start: info.start, end: info.end });
  }

  function change({ event, oldEvent, revert }: ChangeInfo) {
    const start = event.start!;
    const duration = (oldEvent.end ?? oldEvent.start!).getTime() - oldEvent.start!.getTime();
    onEventChange({ id: event.id, start, end: event.end ?? new Date(start.getTime() + duration), revert });
  }

  return (
    <div className="h-full" data-color-scheme={resolvedTheme === "dark" ? "dark" : "light"}>
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, monarchThemePlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ start: "prev,next today", center: "title", end: "timeGridDay,timeGridWeek,dayGridMonth" }}
        firstDay={1}
        allDaySlot={false}
        nowIndicator
        height="100%"
        scrollTime="08:00:00"
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotHeaderFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        selectable={selectable}
        selectMirror
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          editable: e.editable,
          className: e.className,
          ...STATUS_COLORS[e.status],
        }))}
        datesSet={(info) => onRangeChange({ from: info.start, to: info.end })}
        select={select}
        eventClick={(info) => onEventClick(info.event.id)}
        eventChange={change}
      />
    </div>
  );
}
