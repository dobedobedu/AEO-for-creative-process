import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MatrixDataBoundary } from "@/components/visibility-matrix/MatrixDataBoundary";

describe("MatrixDataBoundary", () => {
  it("renders fallback on error", () => {
    const { getByText, queryByText } = render(
      <MatrixDataBoundary error="Boom" onRetry={() => {}}>
        <div>Children</div>
      </MatrixDataBoundary>
    );
    expect(getByText(/boom/i)).toBeTruthy();
    expect(queryByText("Children")).not.toBeInTheDocument();
  });

  it("shows retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    const { getByRole } = render(
      <MatrixDataBoundary error="Error" onRetry={onRetry}>
        <div>Children</div>
      </MatrixDataBoundary>
    );

    const button = getByRole("button", { name: /retry/i });
    expect(button).toBeInTheDocument();
  });

  it("does not show retry button when onRetry not provided", () => {
    const { queryByRole } = render(
      <MatrixDataBoundary error="Error">
        <div>Children</div>
      </MatrixDataBoundary>
    );

    const button = queryByRole("button", { name: /retry/i });
    expect(button).not.toBeInTheDocument();
  });

  it("renders loading state", () => {
    const { getByText, queryByText } = render(
      <MatrixDataBoundary loading>
        <div>Children</div>
      </MatrixDataBoundary>
    );
    expect(getByText(/loading/i)).toBeTruthy();
    expect(queryByText("Children")).not.toBeInTheDocument();
  });

  it("renders children when no error or loading", () => {
    const { getByText } = render(
      <MatrixDataBoundary error={null} loading={false}>
        <div>Children</div>
      </MatrixDataBoundary>
    );
    expect(getByText("Children")).toBeInTheDocument();
  });

  it("calls onRetry when retry button clicked", () => {
    const onRetry = vi.fn();
    const { getByRole } = render(
      <MatrixDataBoundary error="Error" onRetry={onRetry}>
        <div>Children</div>
      </MatrixDataBoundary>
    );

    const button = getByRole("button", { name: /retry/i });
    button.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
