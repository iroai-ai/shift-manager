"use client";

import { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import { EventClickArg, EventDropArg } from "@fullcalendar/core";
import { format } from "date-fns";
import { ShiftModal } from "./ShiftModal";

interface Staff {
  id: string;
  name: string | null;
  color: string;
}

interface Shift {
  id: string;
  staffId: string;
  startTime: string;
  endTime: string;
  role: string;
  note?: string | null;
  syncStatus: string;
  staff: Staff;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  extendedProps: { shift: Shift };
}

export function ShiftCalendar() {
  const calendarRef = useRef<FullCalendar>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<{
    open: boolean;
    defaultStart?: Date;
    editShift?: Shift;
  }>({ open: false });

  // 日付範囲でシフトを取得
  const fetchShifts = async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/shifts?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      const data = await res.json();
      setShifts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setStaff)
      .catch(console.error);
  }, []);

  const events: CalendarEvent[] = shifts.map((s) => ({
    id: s.id,
    title: `${s.staff.name ?? "?"} (${s.role})`,
    start: s.startTime,
    end: s.endTime,
    backgroundColor: s.staff.color,
    borderColor:
      s.syncStatus === "FAILED" ? "#ef4444" : s.syncStatus === "PENDING" ? "#f59e0b" : s.staff.color,
    extendedProps: { shift: s },
  }));

  const handleDateClick = (arg: DateClickArg) => {
    setModalState({ open: true, defaultStart: arg.date });
  };

  const handleEventClick = (arg: EventClickArg) => {
    const shift: Shift = arg.event.extendedProps.shift;
    setModalState({ open: true, editShift: shift });
  };

  const handleEventDrop = async (arg: EventDropArg) => {
    const shift: Shift = arg.event.extendedProps.shift;
    const delta = arg.delta;
    const newStart = arg.event.start!;
    const newEnd = arg.event.end ?? new Date(newStart.getTime() + 3600_000);

    try {
      const res = await fetch(`/api/shifts/${shift.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        }),
      });
      if (!res.ok) arg.revert();
      else refreshCurrentRange();
    } catch {
      arg.revert();
    }
  };

  const handleEventResize = async (arg: EventResizeDoneArg) => {
    const shift: Shift = arg.event.extendedProps.shift;
    try {
      const res = await fetch(`/api/shifts/${shift.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: arg.event.start!.toISOString(),
          endTime: arg.event.end!.toISOString(),
        }),
      });
      if (!res.ok) arg.revert();
      else refreshCurrentRange();
    } catch {
      arg.revert();
    }
  };

  const refreshCurrentRange = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const view = api.view;
    fetchShifts(view.activeStart, view.activeEnd);
  };

  const handleModalClose = (saved?: boolean) => {
    setModalState({ open: false });
    if (saved) refreshCurrentRange();
  };

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="ja"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        buttonText={{ today: "今日", month: "月", week: "週", day: "日" }}
        events={events}
        editable
        selectable
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        datesSet={(arg) => fetchShifts(arg.start, arg.end)}
        height="auto"
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      />

      <ShiftModal
        open={modalState.open}
        defaultStart={modalState.defaultStart}
        editShift={modalState.editShift as any}
        staff={staff}
        onClose={handleModalClose}
      />
    </div>
  );
}
