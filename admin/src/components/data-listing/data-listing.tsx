"use client";

import { useConfirm, type ConfirmOptions } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import type { Query } from "@cendol/api-client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  columnVisibilityFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowSelectionState,
  type RowData,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ListFilter,
  Loader2,
  RotateCw,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PER_PAGE_OPTIONS, toApiQuery, useListingParams } from "./use-listing-params";

const features = tableFeatures({ rowSelectionFeature, columnVisibilityFeature });
type Features = typeof features;

export interface ListingColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** API sort key; makes the header clickable. */
  sortKey?: string;
  /** Can the person hide this column? Defaults to true. */
  hideable?: boolean;
  /** Hidden until the person turns it on. */
  hiddenByDefault?: boolean;
  className?: string;
}

export interface ListingFilter {
  key: string;
  label: string;
  type: "select" | "date";
  options?: { value: string; label: string }[];
}

export interface BulkAction {
  key: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  /** Confirmation popup text, given how many rows are selected. */
  confirm?: (count: number) => ConfirmOptions;
  run: (ids: string[]) => Promise<{ message: string }>;
}

interface ListingResponse<T> {
  rows: T[];
  total: number;
  from: number | null;
  to: number | null;
  lastPage: number;
}

interface DataListingProps<T extends RowData> {
  /** Short unique name, used for the cache and to remember hidden columns. */
  name: string;
  endpoint: string;
  columns: ListingColumn<T>[];
  getRowId: (row: T) => string;
  filters?: ListingFilter[];
  searchPlaceholder?: string;
  defaultSort: string;
  defaultPerPage?: number;
  extraQuery?: Query;
  rowActions?: (row: T) => ReactNode;
  bulkActions?: BulkAction[];
  /** Rows that cannot be ticked (e.g. your own account). */
  canSelectRow?: (row: T) => boolean;
  empty?: { title: string; description?: string; action?: ReactNode };
  /** Shape of the API answer: Laravel resource collection (meta) or plain paginator. */
  responseShape?: "resource" | "plain";
}

function normalise<T>(data: unknown, shape: "resource" | "plain"): ListingResponse<T> {
  const body = data as Record<string, unknown> & { data: T[] };
  const meta = (shape === "resource" ? body.meta : body) as { total: number; from: number | null; to: number | null; last_page: number };
  return { rows: body.data, total: meta.total, from: meta.from, to: meta.to, lastPage: meta.last_page };
}

function readHidden(name: string): ColumnVisibilityState | null {
  try {
    const raw = localStorage.getItem(`listing-columns:${name}`);
    return raw ? (JSON.parse(raw) as ColumnVisibilityState) : null;
  } catch {
    return null;
  }
}

const emptyRows: never[] = [];

/**
 * The standard listing used by every admin list: search, filters with removable chips,
 * sortable columns, tick boxes with bulk actions, items per page, pagination,
 * show/hide columns. All of it is kept in the address bar.
 */
export function DataListing<T extends RowData>({
  name,
  endpoint,
  columns,
  getRowId,
  filters = [],
  searchPlaceholder = "Search",
  defaultSort,
  defaultPerPage = 25,
  extraQuery,
  rowActions,
  bulkActions = [],
  canSelectRow,
  empty,
  responseShape = "resource",
}: DataListingProps<T>) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const filterKeys = useMemo(() => filters.map((f) => f.key), [filters]);
  const { params, update, clearAll } = useListingParams(filterKeys, { sort: defaultSort, perPage: defaultPerPage });

  const [searchText, setSearchText] = useState(params.q);
  // Listings only render in the browser (inside the signed-in shell), so remembered columns can be read straight away.
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(
    () => readHidden(name) ?? Object.fromEntries(columns.filter((c) => c.hiddenByDefault).map((c) => [c.id, false])),
  );
  const [runningAction, setRunningAction] = useState<string | null>(null);

  // keep the search box in step with the address bar (back button, "Clear all")
  const [syncedQ, setSyncedQ] = useState(params.q);
  if (syncedQ !== params.q) {
    setSyncedQ(params.q);
    setSearchText(params.q);
  }

  useEffect(() => {
    try {
      localStorage.setItem(`listing-columns:${name}`, JSON.stringify(columnVisibility));
    } catch {
      /* not important */
    }
  }, [name, columnVisibility]);

  // search after the person stops typing
  useEffect(() => {
    if (searchText === params.q) return;
    const timer = setTimeout(() => update({ q: searchText.trim() }), 350);
    return () => clearTimeout(timer);
  }, [searchText, params.q, update]);

  const apiQuery = useMemo(() => toApiQuery(params, extraQuery), [params, extraQuery]);

  const result = useQuery<ListingResponse<T>>({
    queryKey: ["listing", name, apiQuery],
    queryFn: ({ signal }) => api.get<unknown>(endpoint, apiQuery, signal).then((data) => normalise<T>(data, responseShape)),
    placeholderData: keepPreviousData,
  });

  // Ticked rows belong to the results on screen: a new search, filter or page starts with nothing ticked.
  const selectionScope = JSON.stringify(apiQuery);
  const [selection, setSelection] = useState<{ scope: string; rows: RowSelectionState }>({ scope: selectionScope, rows: {} });
  const rowSelection = selection.scope === selectionScope ? selection.rows : {};
  const setRowSelection = (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) =>
    setSelection((current) => {
      const base = current.scope === selectionScope ? current.rows : {};
      return { scope: selectionScope, rows: typeof updater === "function" ? updater(base) : updater };
    });

  const hasBulk = bulkActions.length > 0;

  const tableColumns = useMemo<ColumnDef<Features, T, unknown>[]>(() => {
    const defs: ColumnDef<Features, T, unknown>[] = columns.map((column) => ({
      id: column.id,
      header: column.header,
      enableHiding: column.hideable !== false,
      cell: (context) => column.cell(context.row.original),
    }));
    if (hasBulk) {
      defs.unshift({ id: "select", header: "", enableHiding: false, cell: () => null });
    }
    if (rowActions) {
      defs.push({ id: "actions", header: "Actions", enableHiding: false, cell: (context) => rowActions(context.row.original) });
    }
    return defs;
  }, [columns, hasBulk, rowActions]);

  const table = useTable({
    features,
    columns: tableColumns,
    data: (result.data?.rows ?? emptyRows) as T[],
    getRowId: (row) => getRowId(row),
    enableRowSelection: (row) => (canSelectRow ? canSelectRow(row.original) : true),
    state: { rowSelection, columnVisibility },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
  });

  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const rows = table.getRowModel().rows;
  const activeFilters = filters.filter((f) => params.filters[f.key]);
  const total = result.data?.total ?? 0;

  async function runBulk(action: BulkAction) {
    if (action.confirm) {
      const ok = await confirm(action.confirm(selectedIds.length));
      if (!ok) return;
    }
    setRunningAction(action.key);
    try {
      const response = await action.run(selectedIds);
      notify.success(response.message);
      setRowSelection({});
      await queryClient.invalidateQueries({ queryKey: ["listing", name] });
    } catch (error) {
      notify.error(error);
    } finally {
      setRunningAction(null);
    }
  }

  function toggleSort(sortKey: string) {
    const current = params.sort;
    const next = current === sortKey ? `-${sortKey}` : current === `-${sortKey}` ? defaultSort : sortKey;
    update({ sort: next });
  }

  const visibleColumnCount = table.getVisibleLeafColumns().length;

  return (
    <section className="data-listing flex flex-col gap-3" aria-busy={result.isFetching}>
      {/* toolbar */}
      <div className="data-listing-toolbar flex flex-wrap items-center gap-2">
        <div className="data-listing-search relative min-w-0 flex-1 basis-full sm:basis-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${name}-search`}
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-8"
          />
        </div>

        {filters.length ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="data-listing-filter-button">
                <ListFilter />
                Filters
                {activeFilters.length ? (
                  <span className="data-listing-filter-count rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{activeFilters.length}</span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="data-listing-filter-panel flex w-72 flex-col gap-4">
              {filters.map((filter) => (
                <div key={filter.key} className="data-listing-filter-field flex flex-col gap-1.5">
                  <Label htmlFor={`${name}-filter-${filter.key}`}>{filter.label}</Label>
                  {filter.type === "select" ? (
                    <Select
                      value={params.filters[filter.key] ?? "all"}
                      onValueChange={(value) => update({ filters: { [filter.key]: value === "all" ? null : value } })}
                    >
                      <SelectTrigger id={`${name}-filter-${filter.key}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        {filter.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`${name}-filter-${filter.key}`}
                      type="date"
                      value={params.filters[filter.key] ?? ""}
                      onChange={(e) => update({ filters: { [filter.key]: e.target.value || null } })}
                    />
                  )}
                </div>
              ))}
            </PopoverContent>
          </Popover>
        ) : null}

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="data-listing-columns-button" aria-label="Show or hide columns">
                  <Columns3 />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Show or hide columns</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="data-listing-columns-menu">
            <DropdownMenuLabel>Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
                  onSelect={(e) => e.preventDefault()}
                >
                  {columnById.get(column.id)?.header ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="data-listing-refresh-button"
              aria-label="Refresh the list"
              onClick={() => result.refetch()}
              disabled={result.isFetching}
            >
              <RotateCw className={result.isFetching ? "animate-spin" : undefined} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh the list</TooltipContent>
        </Tooltip>
      </div>

      {/* active filter chips */}
      {activeFilters.length || params.q ? (
        <div className="data-listing-active-filters flex flex-wrap items-center gap-2">
          {params.q ? (
            <FilterChip label={`Search: “${params.q}”`} onRemove={() => update({ q: "" })} />
          ) : null}
          {activeFilters.map((filter) => {
            const value = params.filters[filter.key];
            const label = filter.options?.find((o) => o.value === value)?.label ?? value;
            return <FilterChip key={filter.key} label={`${filter.label}: ${label}`} onRemove={() => update({ filters: { [filter.key]: null } })} />;
          })}
          <Button variant="link" size="sm" className="data-listing-clear-filters h-auto px-1" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      ) : null}

      {/* bulk action bar */}
      {hasBulk && selectedIds.length ? (
        <div className="data-listing-bulk-bar flex flex-wrap items-center gap-2 rounded-lg border border-marigold-300 bg-marigold-50 px-3 py-2 dark:border-marigold-800 dark:bg-marigold-900/40">
          <span className="data-listing-bulk-count text-sm font-semibold">{selectedIds.length} selected</span>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {bulkActions.map((action) => (
            <Button
              key={action.key}
              size="sm"
              variant={action.danger ? "destructive" : "outline"}
              onClick={() => runBulk(action)}
              disabled={runningAction !== null}
              className="data-listing-bulk-action"
            >
              {runningAction === action.key ? <Loader2 className="animate-spin" /> : <action.icon />}
              {action.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="data-listing-bulk-clear ml-auto" onClick={() => setRowSelection({})}>
            Clear selection
          </Button>
        </div>
      ) : null}

      {/* table */}
      <div className="data-listing-table-wrapper overflow-x-auto rounded-xl border bg-card">
        <Table className="data-listing-table">
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  if (header.column.id === "select") {
                    return (
                      <TableHead key={header.id} className="data-listing-select-cell w-10">
                        <Checkbox
                          aria-label="Select all rows on this page"
                          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
                          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
                          disabled={!rows.length}
                        />
                      </TableHead>
                    );
                  }
                  const column = columnById.get(header.column.id);
                  const sortKey = column?.sortKey;
                  const direction = sortKey ? (params.sort === sortKey ? "asc" : params.sort === `-${sortKey}` ? "desc" : null) : null;
                  return (
                    <TableHead
                      key={header.id}
                      className={["data-listing-head", header.column.id === "actions" ? "text-right" : "", column?.className ?? ""].join(" ")}
                      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}
                    >
                      {sortKey ? (
                        <button
                          type="button"
                          className="data-listing-sort-button -ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                          onClick={() => toggleSort(sortKey)}
                          title={`Sort by ${column?.header.toLowerCase()}`}
                        >
                          {column?.header}
                          {direction === "asc" ? <ArrowUp className="size-3.5" /> : direction === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {result.isPending ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index} className="data-listing-loading-row">
                  {Array.from({ length: visibleColumnCount }).map((__, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : result.isError ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="data-listing-error py-12 text-center">
                  <p className="font-medium">We couldn&apos;t load this list.</p>
                  <p className="mt-1 text-sm text-muted-foreground">{result.error instanceof Error ? result.error.message : null}</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => result.refetch()}>
                    Try again
                  </Button>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnCount} className="data-listing-empty py-14 text-center">
                  <p className="font-heading text-base font-bold">
                    {activeFilters.length || params.q ? "Nothing matches these filters" : (empty?.title ?? "Nothing here yet")}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    {activeFilters.length || params.q ? "Try a different search, or clear the filters." : empty?.description}
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    {activeFilters.length || params.q ? (
                      <Button variant="outline" size="sm" onClick={clearAll}>
                        Clear filters
                      </Button>
                    ) : (
                      empty?.action
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined} className="data-listing-row">
                  {row.getVisibleCells().map((cell) => {
                    if (cell.column.id === "select") {
                      return (
                        <TableCell key={cell.id} className="data-listing-select-cell">
                          <Checkbox
                            aria-label="Select this row"
                            checked={row.getIsSelected()}
                            disabled={!row.getCanSelect()}
                            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
                          />
                        </TableCell>
                      );
                    }
                    const column = columnById.get(cell.column.id);
                    return (
                      <TableCell
                        key={cell.id}
                        className={[cell.column.id === "actions" ? "data-listing-actions-cell" : "", column?.className ?? ""].join(" ")}
                      >
                        {cell.column.id === "actions" ? (
                          <div className="data-listing-row-actions flex justify-end gap-0.5">
                            <table.FlexRender cell={cell} />
                          </div>
                        ) : (
                          <table.FlexRender cell={cell} />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* pagination */}
      <footer className="data-listing-footer flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p className="data-listing-range tabular-nums">
          {total ? (
            <>
              Showing <strong className="text-foreground">{result.data?.from}</strong>–<strong className="text-foreground">{result.data?.to}</strong> of{" "}
              <strong className="text-foreground">{total.toLocaleString("en-MY")}</strong>
            </>
          ) : result.isPending ? (
            "Loading…"
          ) : (
            "No results"
          )}
        </p>
        <div className="data-listing-pager flex items-center gap-3">
          <div className="data-listing-per-page flex items-center gap-2">
            <Label htmlFor={`${name}-per-page`} className="font-normal text-muted-foreground">
              Per page
            </Label>
            <Select value={String(params.perPage)} onValueChange={(value) => update({ perPage: Number(value) })}>
              <SelectTrigger id={`${name}-per-page`} size="sm" className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PER_PAGE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="data-listing-page-number tabular-nums">
            Page {params.page} of {Math.max(1, result.data?.lastPage ?? 1)}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={params.page <= 1}
              onClick={() => update({ page: params.page - 1 })}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={params.page >= (result.data?.lastPage ?? 1)}
              onClick={() => update({ page: params.page + 1 })}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </footer>
    </section>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="filter-chip inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pr-1 pl-3 text-xs font-medium">
      {label}
      <button
        type="button"
        className="filter-chip-remove inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Remove filter ${label}`}
        title="Remove filter"
        onClick={onRemove}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
