"use client";

import type { HoursRow } from "@cendol/api-client";
import { Copy, Plus, X } from "lucide-react";

/*
  Opening hours for one branch, day by day. Each day is closed, open 24 hours, or one or more
  periods. A closing time earlier than the opening time means it runs past midnight (6pm–2am).
*/

const DAYS = [
  { day: 1, name: "Monday" },
  { day: 2, name: "Tuesday" },
  { day: 3, name: "Wednesday" },
  { day: 4, name: "Thursday" },
  { day: 5, name: "Friday" },
  { day: 6, name: "Saturday" },
  { day: 0, name: "Sunday" },
];

type Mode = "closed" | "allday" | "times";

function modeOf(rows: HoursRow[]): Mode {
  if (!rows.length) return "closed";
  if (rows.length === 1 && rows[0].opens === "00:00" && rows[0].closes === "24:00") return "allday";
  return "times";
}

export function HoursEditor({ id, value, onChange }: { id: string; value: HoursRow[]; onChange: (rows: HoursRow[]) => void }) {
  const byDay = (day: number) => value.filter((r) => r.day === day);
  const setDay = (day: number, rows: HoursRow[]) => onChange([...value.filter((r) => r.day !== day), ...rows].sort((a, b) => a.day - b.day || a.opens.localeCompare(b.opens)));

  function setMode(day: number, mode: Mode) {
    if (mode === "closed") setDay(day, []);
    else if (mode === "allday") setDay(day, [{ day, opens: "00:00", closes: "24:00" }]);
    else setDay(day, [{ day, opens: "09:00", closes: "18:00" }]);
  }

  function copyMondayToWeekdays() {
    const monday = byDay(1);
    onChange([...value.filter((r) => r.day === 0 || r.day === 6 || r.day === 1), ...[2, 3, 4, 5].flatMap((d) => monday.map((r) => ({ ...r, day: d })))].sort((a, b) => a.day - b.day || a.opens.localeCompare(b.opens)));
  }

  return (
    <fieldset className="hours-editor flex flex-col gap-2">
      <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-2 text-sm font-semibold text-gula-900 dark:text-coconut">
        Opening hours
        <button type="button" onClick={copyMondayToWeekdays} title="Use Monday's hours for Tuesday to Friday" className="inline-flex h-8 items-center gap-1 rounded-full border border-santan-300 px-3 text-xs font-bold hover:bg-santan-100 dark:border-santan-700 dark:hover:bg-santan-800">
          <Copy className="size-3.5" aria-hidden />
          Copy Monday to weekdays
        </button>
      </legend>
      {DAYS.map(({ day, name }) => {
        const rows = byDay(day);
        const mode = modeOf(rows);
        return (
          <div key={day} className="hours-day grid gap-2 border-b border-dotted border-santan-200 py-2 last:border-b-0 sm:grid-cols-[7rem_10rem_minmax(0,1fr)] sm:items-center dark:border-santan-800">
            <span className="text-sm font-bold">{name}</span>
            <label htmlFor={`${id}-${day}-mode`} className="sr-only">
              {name}
            </label>
            <select id={`${id}-${day}-mode`} value={mode} onChange={(e) => setMode(day, e.target.value as Mode)} className="h-9 rounded-lg border border-santan-300 bg-white px-2 text-sm dark:border-santan-700 dark:bg-santan-950">
              <option value="closed">Closed</option>
              <option value="times">Open</option>
              <option value="allday">Open 24 hours</option>
            </select>
            {mode === "times" ? (
              <div className="flex flex-col gap-1.5">
                {rows.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5 text-sm">
                    <label className="sr-only" htmlFor={`${id}-${day}-${i}-opens`}>
                      {name} opens
                    </label>
                    <input
                      id={`${id}-${day}-${i}-opens`}
                      type="time"
                      value={row.opens}
                      onChange={(e) => setDay(day, rows.map((r, j) => (j === i ? { ...r, opens: e.target.value } : r)))}
                      className="h-9 rounded-lg border border-santan-300 bg-white px-2 dark:border-santan-700 dark:bg-santan-950"
                    />
                    <span aria-hidden>to</span>
                    <label className="sr-only" htmlFor={`${id}-${day}-${i}-closes`}>
                      {name} closes
                    </label>
                    <input
                      id={`${id}-${day}-${i}-closes`}
                      type="time"
                      value={row.closes === "24:00" ? "00:00" : row.closes}
                      onChange={(e) => setDay(day, rows.map((r, j) => (j === i ? { ...r, closes: e.target.value } : r)))}
                      className="h-9 rounded-lg border border-santan-300 bg-white px-2 dark:border-santan-700 dark:bg-santan-950"
                    />
                    {rows.length > 1 ? (
                      <button type="button" onClick={() => setDay(day, rows.filter((_, j) => j !== i))} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-santan-100 dark:hover:bg-santan-800" aria-label={`Remove this ${name} period`} title="Remove this period">
                        <X className="size-4" aria-hidden />
                      </button>
                    ) : null}
                    {i === rows.length - 1 ? (
                      <button type="button" onClick={() => setDay(day, [...rows, { day, opens: "18:00", closes: "22:00" }])} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-santan-100 dark:hover:bg-santan-800" aria-label={`Add another ${name} period`} title="Add a break or a second period">
                        <Plus className="size-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <span className="hidden sm:block" />
            )}
          </div>
        );
      })}
      <p className="text-xs text-santan-500">If you close after midnight, put the closing time as it is (e.g. 6:00 pm to 2:00 am).</p>
    </fieldset>
  );
}
