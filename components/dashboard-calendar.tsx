"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CalendarEvent = {
  id: string;
  applicationId: string;
  eventType: string;
  status: "ACTIVE" | "COMPLETED" | "IGNORED";
  title: string;
  eventTime: string | null;
  windowStartAt: string | null;
  deadlineAt: string | null;
  receivedAt: string | null;
  relativeValidityMinutes: number | null;
  companyName: string;
};

type CalendarEntry = CalendarEvent & {
  dateKeys: string[];
  sortAt: Date;
};

const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];

export function DashboardCalendar({ initialDate, events }: { initialDate: string; events: CalendarEvent[] }) {
  const today = useMemo(() => startOfDay(new Date(initialDate)), [initialDate]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const entries = useMemo(() => events.map(toCalendarEntry).filter((entry): entry is CalendarEntry => entry !== null), [events]);
  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const selectedKey = dateKey(selectedDate);
  const selectedEntries = entries.filter((entry) => entry.dateKeys.includes(selectedKey)).sort((left, right) => left.sortAt.getTime() - right.sortAt.getTime());
  const monthLabel = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(visibleMonth);

  function selectDate(date: Date) {
    setSelectedDate(date);
    if (date.getFullYear() !== visibleMonth.getFullYear() || date.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(startOfMonth(date));
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="上个月" onClick={() => setVisibleMonth((month) => addMonths(month, -1))} className="grid h-8 w-8 place-items-center rounded-lg text-lg text-slate-500 transition hover:bg-panel hover:text-ink">‹</button>
          <button type="button" aria-label="下个月" onClick={() => setVisibleMonth((month) => addMonths(month, 1))} className="grid h-8 w-8 place-items-center rounded-lg text-lg text-slate-500 transition hover:bg-panel hover:text-ink">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line pb-1 text-center text-xs font-medium text-slate-400">
        {weekdayLabels.map((label) => <span key={label} className="py-1">{label}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1 pt-2">
        {days.map((day) => {
          const key = dateKey(day);
          const dayEntries = entries.filter((entry) => entry.dateKeys.includes(key));
          const isSelected = key === selectedKey;
          const isToday = key === dateKey(today);
          const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();

          return <button key={key} type="button" onClick={() => selectDate(day)} aria-pressed={isSelected} aria-label={`${formatLongDate(day)}，${dayEntries.length} 项安排`} className="group flex min-h-12 flex-col items-center rounded-xl py-1 transition hover:bg-panel">
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs tabular-nums ${isSelected ? "bg-ink font-semibold text-white" : isToday ? "bg-accentSoft font-semibold text-accent" : isCurrentMonth ? "text-slate-700" : "text-slate-300"}`}>{day.getDate()}</span>
            <span className="mt-1 flex h-2 items-center justify-center gap-0.5" aria-hidden="true">
              {dayEntries.slice(0, 3).map((entry) => <i key={entry.id} className={`h-1.5 w-1.5 rounded-full ${dotClass(entry)}`} />)}
              {dayEntries.length > 3 ? <i className="text-[9px] font-semibold leading-none text-slate-400">+{dayEntries.length - 3}</i> : null}
            </span>
          </button>;
        })}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">{formatChineseDate(selectedDate)}</h3>
        {selectedEntries.length === 0 ? <p className="mt-3 rounded-xl bg-panel px-3 py-3 text-sm text-slate-500">当天暂无安排</p> : <div className="mt-2 divide-y divide-line">
          {selectedEntries.map((entry) => <Link key={entry.id} href={`/notifications/${entry.applicationId}`} className="flex items-start gap-3 rounded-xl px-2 py-3 transition hover:bg-panel">
            <span className="w-24 shrink-0 pt-0.5 text-xs leading-5 text-slate-500">{eventTimeLabel(entry)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{entry.companyName} · {eventTitle(entry)}</span>
            </span>
          </Link>)}
        </div>}
      </div>
    </div>
  );
}

function toCalendarEntry(event: CalendarEvent): CalendarEntry | null {
  const eventTime = toDate(event.eventTime);
  const windowStartAt = toDate(event.windowStartAt);
  const deadlineAt = toDate(event.deadlineAt);
  const receivedAt = toDate(event.receivedAt);
  const validUntil = receivedAt && event.relativeValidityMinutes && event.relativeValidityMinutes > 0
    ? new Date(receivedAt.getTime() + event.relativeValidityMinutes * 60_000)
    : null;

  if (eventTime) return { ...event, dateKeys: [dateKey(eventTime)], sortAt: eventTime };
  if (windowStartAt && deadlineAt) return { ...event, dateKeys: unique([dateKey(windowStartAt), dateKey(deadlineAt)]), sortAt: windowStartAt };
  if (validUntil) return { ...event, dateKeys: [dateKey(validUntil)], sortAt: validUntil };
  if (deadlineAt) return { ...event, dateKeys: [dateKey(deadlineAt)], sortAt: deadlineAt };
  return null;
}

function dotClass(event: CalendarEntry) {
  if (event.status === "COMPLETED") return "bg-emerald-300";
  if (event.eventType === "INTERVIEW") return "bg-violet-500";
  if (event.eventType === "ASSESSMENT") return "bg-amber-500";
  if (event.eventType === "DEADLINE") return "bg-rose-500";
  return "bg-slate-400";
}

function eventTimeLabel(event: CalendarEntry) {
  const eventTime = toDate(event.eventTime);
  const windowStartAt = toDate(event.windowStartAt);
  const deadlineAt = toDate(event.deadlineAt);
  const receivedAt = toDate(event.receivedAt);
  const validUntil = receivedAt && event.relativeValidityMinutes && event.relativeValidityMinutes > 0 ? new Date(receivedAt.getTime() + event.relativeValidityMinutes * 60_000) : null;
  if (eventTime) return formatTime(eventTime);
  if (windowStartAt && deadlineAt) return formatRange(windowStartAt, deadlineAt);
  if (receivedAt && validUntil) return `有效期：${formatRange(receivedAt, validUntil)}`;
  if (deadlineAt) return `截止 ${formatDateTime(deadlineAt)}`;
  return "时间待确认";
}

function eventTitle(event: CalendarEntry) {
  return event.title || eventTypeLabel(event.eventType);
}

function eventTypeLabel(eventType: string) {
  if (eventType === "INTERVIEW") return "面试";
  if (eventType === "ASSESSMENT") return "笔试 / 测评";
  if (eventType === "DEADLINE") return "截止提醒";
  return "事项";
}

function getCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addMonths(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function addDays(date: Date, amount: number) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount); }
function toDate(value: string | null) { return value ? new Date(value) : null; }
function unique(values: string[]) { return [...new Set(values)]; }
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatTime(date: Date) { return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`; }
function formatDateTime(date: Date) { return `${date.getMonth() + 1}/${date.getDate()} ${formatTime(date)}`; }
function formatRange(start: Date, end: Date) { return `${formatDateTime(start)}–${dateKey(start) === dateKey(end) ? formatTime(end) : formatDateTime(end)}`; }
function formatChineseDate(date: Date) { return `${date.getMonth() + 1} 月 ${date.getDate()} 日`; }
function formatLongDate(date: Date) { return `${date.getFullYear()} 年 ${formatChineseDate(date)}`; }
