"use client";

import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useState } from "react";

/** Type a topic and press Enter or comma to add it. Backspace on an empty box removes the last one. */
export function TagInput({ id, value, onChange, max = 10 }: { id: string; value: string[]; onChange: (tags: string[]) => void; max?: number }) {
  const [text, setText] = useState("");

  function add(raw: string) {
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const part of parts) {
      if (next.length >= max) break;
      if (!next.some((t) => t.toLowerCase() === part.toLowerCase())) next.push(part.slice(0, 60));
    }
    onChange(next);
    setText("");
  }

  return (
    <div className="tag-input flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50">
      {value.map((tag) => (
        <span key={tag} className="tag-chip inline-flex items-center gap-1 rounded-full bg-pandan-100 py-0.5 pr-1 pl-2.5 text-xs font-medium text-pandan-800 dark:bg-pandan-900 dark:text-pandan-200">
          {tag}
          <button
            type="button"
            className="tag-chip-remove inline-flex size-4 items-center justify-center rounded-full hover:bg-pandan-200 dark:hover:bg-pandan-800"
            aria-label={`Remove topic ${tag}`}
            title="Remove"
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Input
        id={id}
        value={text}
        placeholder={value.length ? "" : "e.g. banjir, Jonker Street"}
        disabled={value.length >= max}
        className="h-7 min-w-32 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
        onChange={(e) => {
          if (e.target.value.includes(",")) add(e.target.value);
          else setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(text)}
      />
    </div>
  );
}
