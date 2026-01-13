import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safe async wrapper that isolates SDK errors with read-only properties.
 * Transforms all errors into regular Error objects to prevent Next.js dev server crashes.
 */
export type SafeResult<T> = { success: true; data: T } | { success: false; error: string };

export async function safeAsync<T>(
  fn: () => Promise<T>,
  context: string
): Promise<SafeResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err) {
    let message = "Unknown error";
    try {
      if (err instanceof Error) {
        message = err.message;
      } else if (err && typeof err === "object" && "message" in err) {
        message = String((err as { message: unknown }).message);
      } else {
        message = String(err);
      }
    } catch {
      message = `${context} failed`;
    }
    console.error(`[${context}]`, message);
    return { success: false, error: message };
  }
}

/**
 * Extract error message safely from potentially read-only error objects.
 */
export function safeErrorMessage(err: unknown, fallback = "Unknown error"): string {
  try {
    if (err instanceof Error) {
      return err.message;
    } else if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: unknown }).message);
    } else if (typeof err === "string") {
      return err;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
