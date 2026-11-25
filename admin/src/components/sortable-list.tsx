"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T) => ReactNode;
  /** Read aloud by screen readers for the drag handle. */
  handleLabel?: (item: T) => string;
  disabled?: boolean;
}

/**
 * Drag-and-drop ordering, reused for roles now and for categories, sectors,
 * plans, pinned slots and gallery photos in later phases. Works with the keyboard too:
 * focus the handle, press Space, move with the arrow keys, press Space again.
 */
export function SortableList<T>({ items, getId, onReorder, renderItem, handleLabel, disabled }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => getId(item) === active.id);
    const to = items.findIndex((item) => getId(item) === over.id);
    onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul className="sortable-list flex flex-col gap-2">
          {items.map((item) => (
            <SortableRow key={getId(item)} id={getId(item)} label={handleLabel?.(item) ?? "Drag to reorder"} disabled={disabled}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, label, disabled, children }: { id: string; label: string; disabled?: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      // dnd-kit moves the row with a transform while dragging; this is the one place a computed style is required
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        "sortable-row flex items-center gap-2 rounded-xl border bg-card",
        isDragging ? "is-dragging relative z-10 shadow-lg ring-2 ring-marigold-300" : "",
      ].join(" ")}
    >
      <button
        type="button"
        className="sortable-handle flex h-full cursor-grab touch-none items-center self-stretch rounded-l-xl px-2 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={label}
        title="Drag to change the order"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="sortable-row-content min-w-0 flex-1">{children}</div>
    </li>
  );
}
