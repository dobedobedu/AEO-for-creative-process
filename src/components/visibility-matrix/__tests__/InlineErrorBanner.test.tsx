import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InlineErrorBanner } from "@/components/visibility-matrix/InlineErrorBanner";

describe("InlineErrorBanner", () => {
  it("renders nothing when error is null", () => {
    const { container } = render(<InlineErrorBanner error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders error banner when error is set", () => {
    render(<InlineErrorBanner error="Test error" />);
    expect(screen.getByText(/data loading error/i)).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("shows retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<InlineErrorBanner error="Error" onRetry={onRetry} />);

    const button = screen.getByRole("button", { name: /retry/i });
    expect(button).toBeInTheDocument();

    button.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows dismiss button when onDismiss provided", () => {
    const onDismiss = vi.fn();
    render(<InlineErrorBanner error="Error" onDismiss={onDismiss} />);

    const button = screen.getByRole("button", { name: "" }); // X button has no text
    expect(button).toBeInTheDocument();

    button.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not show retry button when onRetry not provided", () => {
    render(<InlineErrorBanner error="Error" />);

    const button = screen.queryByRole("button", { name: /retry/i });
    expect(button).not.toBeInTheDocument();
  });
});
