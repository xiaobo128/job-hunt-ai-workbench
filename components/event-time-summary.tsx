"use client";

import { useState } from "react";
import { resolveEventTime } from "@/lib/event-time";
import { formatDate } from "@/lib/format";

type EventTimeValues = {
  eventTime: Date | null;
  windowStartAt: Date | null;
  deadlineAt: Date | null;
  receivedAt: Date | null;
  relativeValidityMinutes: number | null;
};

type EventTimeFieldValues = {
  eventTime: Date | string | null;
  windowStartAt: Date | string | null;
  deadlineAt: Date | string | null;
  receivedAt: Date | string | null;
  relativeValidityMinutes: number | null;
};

type TimeMode = "POINT" | "WINDOW" | "RELATIVE";

export function EventTimeSummary(values: EventTimeValues) {
  const resolved = resolveEventTime(values);
  const mode = inferTimeMode(values);

  if (mode === "RELATIVE") {
    return (
      <div className="space-y-1 text-xs text-slate-500">
        <div>收到时间：{formatDate(values.receivedAt)}</div>
        <div>链接有效至：{formatDate(resolved.validUntil)}</div>
        {values.deadlineAt ? <div>最终 ddl：{formatDate(values.deadlineAt)}</div> : null}
      </div>
    );
  }

  if (mode === "WINDOW") {
    return (
      <div className="space-y-1 text-xs text-slate-500">
        <div>开放时间：{formatDate(resolved.windowStartAt)}</div>
        <div>截止时间：{formatDate(resolved.deadlineAt)}</div>
      </div>
    );
  }

  return values.eventTime ? <div className="text-xs text-slate-500">安排时间：{formatDate(values.eventTime)}</div> : null;
}

export function EventTimeFields({
  defaultValues,
  requireEventTime = false,
}: {
  defaultValues?: Partial<EventTimeFieldValues>;
  requireEventTime?: boolean;
}) {
  const values = {
    eventTime: defaultValues?.eventTime ?? null,
    windowStartAt: defaultValues?.windowStartAt ?? null,
    deadlineAt: defaultValues?.deadlineAt ?? null,
    receivedAt: defaultValues?.receivedAt ?? null,
    relativeValidityMinutes: defaultValues?.relativeValidityMinutes ?? null,
  };
  const [mode, setMode] = useState<TimeMode>(() => inferTimeMode(values));
  const relativeDefaults = getRelativeDefaults(values.relativeValidityMinutes);

  return (
    <fieldset className="rounded-3xl border border-line bg-slate-50 p-4">
      <legend className="px-1 text-sm font-medium text-ink">时间安排</legend>
      <p className="mt-1 text-xs leading-5 text-slate-500">按通知的实际约束选择一种时间表达；切换模式不会保存模式本身。</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <ModeButton active={mode === "POINT"} onClick={() => setMode("POINT")}>固定时间点</ModeButton>
        <ModeButton active={mode === "WINDOW"} onClick={() => setMode("WINDOW")}>固定时间窗</ModeButton>
        <ModeButton active={mode === "RELATIVE"} onClick={() => setMode("RELATIVE")}>收到通知后有效</ModeButton>
      </div>

      {mode === "POINT" ? (
        <label className="mt-3 block text-sm text-slate-600">
          日期时间
          <input type="datetime-local" name="eventTime" required={requireEventTime} defaultValue={toDateTimeLocalValue(values.eventTime)} className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none" />
        </label>
      ) : null}

      {mode === "WINDOW" ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-sm text-slate-600">
            开放时间（可选）
            <input type="datetime-local" name="windowStartAt" defaultValue={toDateTimeLocalValue(values.windowStartAt)} className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none" />
          </label>
          <label className="block text-sm text-slate-600">
            截止时间
            <input type="datetime-local" name="deadlineAt" required defaultValue={toDateTimeLocalValue(values.deadlineAt)} className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none" />
          </label>
        </div>
      ) : null}

      {mode === "RELATIVE" ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-sm text-slate-600">
            收到时间
            <input type="datetime-local" name="receivedAt" required defaultValue={toDateTimeLocalValue(values.receivedAt)} className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none" />
          </label>
          <label className="block text-sm text-slate-600">
            有效时长
            <div className="mt-2 flex gap-2">
              <input type="number" name="relativeValidityValue" required min="0.01" step="0.01" defaultValue={relativeDefaults.value} className="min-w-0 flex-1 rounded-2xl border border-line bg-white px-4 py-3 outline-none" />
              <select name="relativeValidityUnit" defaultValue={relativeDefaults.unit} className="rounded-2xl border border-line bg-white px-4 py-3 outline-none">
                <option value="hours">小时</option>
                <option value="days">天</option>
              </select>
            </div>
          </label>
          <label className="block text-sm text-slate-600 md:col-span-2">
            最终 ddl（可选）
            <input type="datetime-local" name="deadlineAt" defaultValue={toDateTimeLocalValue(values.deadlineAt)} className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none" />
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}

function ModeButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-2xl border px-3 py-2 text-sm ${active ? "border-ink bg-ink text-white" : "border-line bg-white text-slate-600"}`}>{children}</button>;
}

function inferTimeMode(values: Pick<EventTimeFieldValues, "eventTime" | "windowStartAt" | "deadlineAt" | "receivedAt" | "relativeValidityMinutes">): TimeMode {
  if (values.receivedAt && values.relativeValidityMinutes) return "RELATIVE";
  if (values.windowStartAt || values.deadlineAt) return "WINDOW";
  return "POINT";
}

function getRelativeDefaults(minutes: number | null) {
  if (!minutes) return { value: "", unit: "hours" };
  if (minutes % (24 * 60) === 0) return { value: String(minutes / (24 * 60)), unit: "days" };
  return { value: String(minutes / 60), unit: "hours" };
}

function toDateTimeLocalValue(value: Date | string | null) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
