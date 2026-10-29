import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const mergeClasses = extendTailwindMerge({
  extend: {
    theme: { text: ["navigation", "caption", "body", "label", "title"] },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(clsx(inputs));
}
