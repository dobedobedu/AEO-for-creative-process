/**
 * Next.js instrumentation file
 * Handles global error management to prevent crashes from SDK errors
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Handle unhandled rejections gracefully
    process.on("unhandledRejection", (reason: unknown) => {
      // Safely extract error info without modifying the error object
      let message = "Unknown unhandled rejection";
      let stack: string | undefined;

      try {
        if (reason instanceof Error) {
          // Read properties defensively
          try {
            message = reason.message;
          } catch {
            message = "Error with inaccessible message";
          }
          try {
            stack = reason.stack;
          } catch {
            stack = undefined;
          }
        } else if (reason && typeof reason === "object") {
          // Try to get message from object
          try {
            if ("message" in reason) {
              message = String((reason as { message: unknown }).message);
            } else {
              message = JSON.stringify(reason);
            }
          } catch {
            message = "[Object with non-serializable properties]";
          }
        } else {
          message = String(reason);
        }
      } catch {
        message = "Error extracting rejection details";
      }

      console.error("[UnhandledRejection]", message);
      if (stack) {
        console.error(stack);
      }
    });

    // Also handle uncaught exceptions similarly
    process.on("uncaughtException", (error: Error) => {
      let message = "Unknown uncaught exception";

      try {
        try {
          message = error.message;
        } catch {
          message = "Error with inaccessible message";
        }
      } catch {
        message = "Error extracting exception details";
      }

      console.error("[UncaughtException]", message);

      // Don't exit for non-fatal errors in dev
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    });
  }
}
