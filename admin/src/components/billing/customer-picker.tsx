"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import type { CustomerOption } from "@cendol/api-client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface CustomerPickerProps {
  id: string;
  value: CustomerOption | null;
  onChange: (customer: CustomerOption) => void;
  invalid?: boolean;
  disabled?: boolean;
}

/** Search-as-you-type customer chooser for the invoice form. */
export function CustomerPicker({ id, value, onChange, invalid, disabled }: CustomerPickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const options = useQuery({
    queryKey: ["customer-options", search],
    queryFn: () => api.get<{ data: CustomerOption[] }>("admin/billing/customers/options", { q: search }).then((r) => r.data),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          disabled={disabled}
          className="customer-picker-trigger w-full justify-between font-normal"
        >
          <span className={value ? "truncate" : "truncate text-muted-foreground"}>{value ? value.name : "Choose a customer"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="customer-picker-panel flex w-(--radix-popover-trigger-width) min-w-72 flex-col gap-2 p-2">
        <Input
          id={`${id}-search`}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a name or SSM number"
          aria-label="Search customers"
        />
        <ul className="customer-picker-options flex max-h-64 flex-col overflow-y-auto" role="listbox" aria-label="Customers">
          {options.data?.length ? (
            options.data.map((option) => (
              <li key={option.id} role="option" aria-selected={value?.id === option.id}>
                <button
                  type="button"
                  className="customer-picker-option flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <Check className={`size-4 shrink-0 ${value?.id === option.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{option.name}</span>
                    {option.registration_no || option.email ? (
                      <span className="truncate text-xs text-muted-foreground">{option.registration_no ?? option.email}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-2 py-3 text-sm text-muted-foreground">{options.isFetching ? "Searching…" : "No customers match."}</li>
          )}
        </ul>
        <Button asChild variant="ghost" size="sm" className="justify-start">
          <Link href="/billing/customers/create">
            <Plus />
            Add a new customer
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
