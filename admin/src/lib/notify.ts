import { ApiError } from "@cendol/api-client";
import { toast } from "sonner";

/**
 * Toasts in plain language. The API already writes its messages for people,
 * so errors show the server's message; anything unexpected gets a generic sentence.
 */
export const notify = {
  success(message: string) {
    toast.success(message);
  },
  info(message: string) {
    toast.info(message);
  },
  error(error: unknown, fallback = "That didn't work. Please try again.") {
    if (error instanceof ApiError) {
      toast.error(error.message);
    } else if (error instanceof Error && error.name === "AbortError") {
      return;
    } else {
      toast.error(fallback);
    }
  },
};
