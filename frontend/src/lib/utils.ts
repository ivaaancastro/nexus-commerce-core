import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases CSS de forma inteligente con Tailwind.
 * Resuelve conflictos de clases (ej: px-2 vs px-4).
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
