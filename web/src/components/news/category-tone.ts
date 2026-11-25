import type { CategoryColor } from "@cendol/api-client";

/** Each category has a brand colour; these are the full class names so Tailwind keeps them. */
export const CATEGORY_TONE: Record<CategoryColor, { chip: string; dot: string; text: string }> = {
  pandan: {
    chip: "bg-pandan-100 text-pandan-800 dark:bg-pandan-900 dark:text-pandan-100",
    dot: "bg-pandan-600",
    text: "text-pandan-700 dark:text-pandan-300",
  },
  marigold: {
    chip: "bg-marigold-100 text-marigold-800 dark:bg-marigold-900 dark:text-marigold-100",
    dot: "bg-marigold-400",
    text: "text-marigold-700 dark:text-marigold-300",
  },
  gula: {
    chip: "bg-gula-100 text-gula-800 dark:bg-gula-800 dark:text-gula-100",
    dot: "bg-gula-700",
    text: "text-gula-700 dark:text-gula-300",
  },
  satay: {
    chip: "bg-gula-50 text-satay-700 dark:bg-gula-900 dark:text-satay-400",
    dot: "bg-satay-500",
    text: "text-satay-700 dark:text-satay-400",
  },
  santan: {
    chip: "bg-santan-100 text-santan-700 dark:bg-santan-800 dark:text-santan-100",
    dot: "bg-santan-500",
    text: "text-santan-600 dark:text-santan-300",
  },
};

export const toneFor = (color: CategoryColor | undefined | null) => CATEGORY_TONE[color ?? "pandan"] ?? CATEGORY_TONE.pandan;
