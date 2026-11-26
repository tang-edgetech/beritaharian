"use client";

import { IconAction } from "@/components/icon-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HoursRow } from "@cendol/api-client";
import { Copy, Eraser, Plus, Sun, X } from "lucide-react";

/** Monday first, the way people read a week. Day numbers are 0 Sunday … 6 Saturday. */
const WEEK = [
  { day: 1, name: "Monday" },
  { day: 2, name: "Tuesday" },
  { day: 3, name: "Wednesday" },
  { day: 4, name: "Thursday" },
  { day: 5, name: "Friday" },
  { day: 6, name: "Saturday" },
  { day: 0, name: "Sunday" },
];

const isAllDay = (row: HoursRow) => row.opens === "00:00" && row.closes === "24:00";

interface HoursEditorProps {
  id: string;
  value: HoursRow[];
  onChange: (rows: HoursRow[]) => void;
  /** server errors keyed by row position in `value`, e.g. { 2: "Please check…" } */
  errors?: Record<number, string>;
}

/**
 * Opening hours, one line per day. A day with no periods is closed. Closing at or before the
 * opening time means the place stays open past midnight (e.g. 6:00 pm – 2:00 am).
 */
export function HoursEditor({ id, value, onChange, errors = {} }: HoursEditorProps) {
  const update = (index: number, changes: Partial<HoursRow>) => onChange(value.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));
  const add = (day: number) => {
    const last = value.filter((r) => r.day === day).at(-1);
    onChange([...value, last ? { day, opens: last.closes === "24:00" ? "09:00" : last.closes, closes: "22:00" } : { day, opens: "09:00", closes: "18:00" }]);
  };
  const setAllDay = (day: number) => onChange([...value.filter((r) => r.day !== day), { day, opens: "00:00", closes: "24:00" }]);
  const closeDay = (day: number) => onChange(value.filter((r) => r.day !== day));
  const copyMonday = () => {
    const monday = value.filter((r) => r.day === 1);
    onChange([...value.filter((r) => r.day === 1 || r.day === 0 || r.day === 6), ...[2, 3, 4, 5].flatMap((day) => monday.map((r) => ({ ...r, day })))]);
  };

  return (
    <fieldset className="hours-editor flex flex-col gap-3" aria-describedby={`${id}-hint`}>
      <div className="hours-editor-head flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-medium">Opening hours</legend>
        <div className="flex flex-wrap gap-1">
          <Button type="button" variant="outline" size="sm" onClick={copyMonday} disabled={!value.some((r) => r.day === 1)}>
            <Copy />
            Copy Monday to Tue–Fri
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} disabled={!value.length}>
            <Eraser />
            Clear
          </Button>
        </div>
      </div>
      <p id={`${id}-hint`} className="field-hint -mt-1">
        Leave a day empty if it&apos;s closed. A closing time earlier than the opening time means it runs past midnight.
      </p>
      <ul className="hours-editor-days flex flex-col divide-y rounded-lg border">
        {WEEK.map(({ day, name }) => {
          const rows = value.map((row, index) => ({ row, index })).filter(({ row }) => row.day === day);
          const allDay = rows.length === 1 && isAllDay(rows[0].row);
          return (
            <li key={day} className="hours-editor-day flex flex-col gap-2 p-2.5 sm:flex-row sm:items-start">
              <span className="hours-editor-day-name w-24 shrink-0 pt-1.5 text-sm font-medium">{name}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {rows.length === 0 ? <span className="hours-editor-closed pt-1.5 text-sm text-muted-foreground">Closed</span> : null}
                {allDay ? (
                  <span className="hours-editor-all-day pt-1.5 text-sm font-medium text-pandan-700 dark:text-pandan-300">Open 24 hours</span>
                ) : (
                  rows.map(({ row, index }) => (
                    <div key={index} className="hours-editor-period flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${name} opens`}
                          className="w-32"
                          value={row.opens}
                          onChange={(e) => update(index, { opens: e.target.value })}
                          aria-invalid={Boolean(errors[index])}
                        />
                        <span className="text-sm text-muted-foreground">to</span>
                        <Input
                          type="time"
                          aria-label={`${name} closes`}
                          className="w-32"
                          value={row.closes === "24:00" ? "00:00" : row.closes}
                          onChange={(e) => update(index, { closes: e.target.value })}
                          aria-invalid={Boolean(errors[index])}
                        />
                        {row.closes !== "24:00" && row.closes <= row.opens ? <span className="text-xs text-muted-foreground">next day</span> : null}
                        <IconAction icon={X} label={`Remove this ${name} period`} onClick={() => remove(index)} />
                      </div>
                      {errors[index] ? (
                        <p className="field-error" role="alert">
                          {errors[index]}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
              <div className="hours-editor-day-actions flex shrink-0 gap-1">
                {!allDay ? <IconAction icon={Plus} label={rows.length ? `Add another ${name} period` : `Add ${name} hours`} onClick={() => add(day)} /> : null}
                <IconAction icon={Sun} label={allDay ? `${name} is open 24 hours` : `Open 24 hours on ${name}`} onClick={() => setAllDay(day)} disabled={allDay} />
                {rows.length ? <IconAction icon={Eraser} label={`Closed on ${name}`} onClick={() => closeDay(day)} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
