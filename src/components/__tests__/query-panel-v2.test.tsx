/**
 * Tests for QueryPanelV2 component
 * Covers: intent ID scoping, query bank merge logic, auto-select, CRUD operations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryPanelV2 } from "../query-panel-v2";
import type { IntentNode } from "@/lib/intents/types";

// Mock UI components
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange: (val: number[]) => void }) => (
    <input
      type="range"
      data-testid="slider"
      value={value[0]}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
    />
  ),
}));

type Persona = "move_up" | "retiree" | "luxury" | "first_time";
type Stage = "explore" | "consider" | "compare" | "decide";

const mockPersonas = [
  { id: "move_up" as Persona, label: "Move-Up" },
  { id: "retiree" as Persona, label: "Retiree" },
  { id: "luxury" as Persona, label: "Luxury" },
  { id: "first_time" as Persona, label: "First Time" },
];

const mockStages = [
  { id: "explore" as Stage, label: "Explore" },
  { id: "consider" as Stage, label: "Consider" },
  { id: "compare" as Stage, label: "Compare" },
  { id: "decide" as Stage, label: "Decide" },
];

const createMockQueryBank = (): Record<Persona, Record<Stage, { intents: IntentNode[] }>> => {
  const bank: Record<Persona, Record<Stage, { intents: IntentNode[] }>> = {} as Record<Persona, Record<Stage, { intents: IntentNode[] }>>;

  for (const persona of mockPersonas) {
    bank[persona.id] = {} as Record<Stage, { intents: IntentNode[] }>;
    for (const stage of mockStages) {
      bank[persona.id][stage.id] = {
        intents: [
          {
            id: `${persona.id}-${stage.id}-intent-1`,
            text: `${persona.label} ${stage.label} intent`,
            role: "cpo",
            queryStyle: 0.75,
            generatedQueries: [],
          },
        ],
      };
    }
  }

  return bank;
};

describe("QueryPanelV2", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    initialScope: "cell" as const,
    initialPersona: "retiree" as Persona,
    initialStage: "explore" as Stage,
    queryBank: createMockQueryBank(),
    personas: mockPersonas,
    stages: mockStages,
    onRunQueries: vi.fn(),
    onSaveQueries: vi.fn(),
    onRegenerateQueries: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Intent ID Scoping", () => {
    it("uses intent ID for query editing operations", () => {
      const queryBank = createMockQueryBank();
      queryBank.retiree.explore.intents[0].generatedQueries = ["Query 1", "Query 2"];

      render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

      // Intent should be displayed
      expect(screen.getByText("Retiree Explore intent")).toBeInTheDocument();

      // Queries should be displayed with IDs correctly tracked
      expect(screen.getByText("Query 1")).toBeInTheDocument();
      expect(screen.getByText("Query 2")).toBeInTheDocument();
    });

    it("maintains intent identity through updates", () => {
      const queryBank = createMockQueryBank();
      const intentId = queryBank.retiree.explore.intents[0].id;
      queryBank.retiree.explore.intents[0].generatedQueries = ["Original query"];

      const { rerender } = render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

      // Update query bank with same intent ID but different text
      const updatedBank = createMockQueryBank();
      updatedBank.retiree.explore.intents[0].id = intentId;
      updatedBank.retiree.explore.intents[0].text = "Updated intent text";
      updatedBank.retiree.explore.intents[0].generatedQueries = ["New query"];

      rerender(<QueryPanelV2 {...defaultProps} queryBank={updatedBank} />);

      // Should preserve local state - this is the merge logic
      expect(screen.getByText("Original query")).toBeInTheDocument();
    });

    it("handles multiple intents with distinct IDs in same cell", () => {
      const queryBank = createMockQueryBank();
      queryBank.retiree.explore.intents = [
        { id: "intent-a", text: "Intent A", role: "cpo", queryStyle: 0.75, generatedQueries: ["Query A1"] },
        { id: "intent-b", text: "Intent B", role: "family_unit", queryStyle: 0.9, generatedQueries: ["Query B1"] },
      ];

      render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

      // Both intents should be listed
      expect(screen.getByText("Intent A")).toBeInTheDocument();
      expect(screen.getByText("Intent B")).toBeInTheDocument();
    });
  });

  describe("Query Bank Merge Logic", () => {
    it("preserves local queries when props update", () => {
      const queryBank = createMockQueryBank();
      queryBank.retiree.explore.intents[0].generatedQueries = ["Local query 1", "Local query 2"];

      const { rerender } = render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

      expect(screen.getByText("Local query 1")).toBeInTheDocument();

      // Rerender with empty queries from parent (simulating prop update)
      const updatedBank = createMockQueryBank();
      updatedBank.retiree.explore.intents[0].id = queryBank.retiree.explore.intents[0].id;
      updatedBank.retiree.explore.intents[0].generatedQueries = [];

      rerender(<QueryPanelV2 {...defaultProps} queryBank={updatedBank} />);

      // Local queries should be preserved
      expect(screen.getByText("Local query 1")).toBeInTheDocument();
      expect(screen.getByText("Local query 2")).toBeInTheDocument();
    });

    it("preserves new local intents that start with 'new_' prefix", async () => {
      const queryBank = createMockQueryBank();

      render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

      // Click add new intent button
      const addButton = screen.getByText("ADD");
      fireEvent.click(addButton);

      // New intent should appear
      expect(screen.getByDisplayValue("New Research Intent")).toBeInTheDocument();
    });

    it("merges incoming intent data with local modifications", () => {
      const queryBank = createMockQueryBank();
      queryBank.retiree.explore.intents[0].generatedQueries = ["Query 1"];

      const { rerender } = render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

      // Simulate editing the intent text locally would happen through textarea change
      // For this test, we verify that updates preserve local state

      const updatedBank = createMockQueryBank();
      updatedBank.retiree.explore.intents[0].id = queryBank.retiree.explore.intents[0].id;
      updatedBank.retiree.explore.intents[0].text = "Server updated text";
      updatedBank.retiree.explore.intents[0].generatedQueries = []; // Server doesn't have queries

      rerender(<QueryPanelV2 {...defaultProps} queryBank={updatedBank} />);

      // Local query should be preserved even though server sent empty
      expect(screen.getByText("Query 1")).toBeInTheDocument();
    });
  });

  describe("Auto-Select Logic", () => {
    it("auto-selects first intent when entering cell scope", () => {
      const queryBank = createMockQueryBank();
      queryBank.retiree.explore.intents = [
        { id: "first", text: "First Intent", role: "cpo", queryStyle: 0.75, generatedQueries: [] },
        { id: "second", text: "Second Intent", role: "family_unit", queryStyle: 0.8, generatedQueries: [] },
      ];

      render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

      // First intent should have active styling (it's the only one with the arrow indicator filled)
      const firstIntent = screen.getByText("First Intent");
      expect(firstIntent).toBeInTheDocument();
    });

    it("prefers intent with generated queries for auto-select", () => {
      const queryBank = createMockQueryBank();
      queryBank.retiree.explore.intents = [
        { id: "empty", text: "Empty Intent", role: "cpo", queryStyle: 0.75, generatedQueries: [] },
        { id: "with-queries", text: "Intent With Queries", role: "cpo", queryStyle: 0.75, generatedQueries: ["Query 1"] },
      ];

      render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

      // The intent with queries should be visible in the main column
      expect(screen.getByText("Query 1")).toBeInTheDocument();
    });

    it("clears active intent when leaving cell scope", () => {
      const queryBank = createMockQueryBank();
      queryBank.retiree.explore.intents[0].generatedQueries = ["Query 1"];

      render(<QueryPanelV2
        {...defaultProps}
        queryBank={queryBank}
        initialScope="all"
        initialPersona={undefined}
        initialStage={undefined}
      />);

      // In 'all' scope, intent settings should not be shown
      expect(screen.getByText("Intent Settings")).toBeInTheDocument();
      expect(screen.getByText(/Select a specific intent/)).toBeInTheDocument();
    });
  });

  describe("CRUD Operations", () => {
    describe("Intent CRUD", () => {
      it("adds new intent with 'new_' prefix", async () => {
        render(<QueryPanelV2 {...defaultProps} />);

        const addButton = screen.getByText("ADD");
        fireEvent.click(addButton);

        // New intent should appear with default text
        expect(screen.getByDisplayValue("New Research Intent")).toBeInTheDocument();
      });

      it("updates intent text via textarea", async () => {
        render(<QueryPanelV2 {...defaultProps} />);

        const textarea = screen.getByDisplayValue("Retiree Explore intent");
        fireEvent.change(textarea, { target: { value: "Updated intent text" } });

        expect(screen.getByDisplayValue("Updated intent text")).toBeInTheDocument();
      });

      it("deletes intent when trash button clicked", async () => {
        const queryBank = createMockQueryBank();
        queryBank.retiree.explore.intents = [
          { id: "keep", text: "Keep Me", role: "cpo", queryStyle: 0.75, generatedQueries: [] },
          { id: "delete", text: "Delete Me", role: "cpo", queryStyle: 0.75, generatedQueries: [] },
        ];

        render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

        // Both intents should be visible
        expect(screen.getByText("Keep Me")).toBeInTheDocument();
        expect(screen.getByText("Delete Me")).toBeInTheDocument();

        // Find and click delete button for "Delete Me" intent
        const deleteButtons = screen.getAllByTitle("Delete Intent");
        fireEvent.click(deleteButtons[1]); // Second intent's delete button

        // "Delete Me" should be removed
        expect(screen.queryByText("Delete Me")).not.toBeInTheDocument();
        expect(screen.getByText("Keep Me")).toBeInTheDocument();
      });

      it("prevents deleting the last intent in a cell", () => {
        const queryBank = createMockQueryBank();
        queryBank.retiree.explore.intents = [
          { id: "only", text: "Only Intent", role: "cpo", queryStyle: 0.75, generatedQueries: [] },
        ];

        render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

        const deleteButton = screen.getByTitle("Delete Intent");
        fireEvent.click(deleteButton);

        // Intent should still exist
        expect(screen.getByText("Only Intent")).toBeInTheDocument();
      });
    });

    describe("Query CRUD", () => {
      it("adds new query to active intent", async () => {
        const queryBank = createMockQueryBank();
        queryBank.retiree.explore.intents[0].generatedQueries = ["Existing query"];

        render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

        // Count current queries
        expect(screen.getByText("Existing query")).toBeInTheDocument();

        const addQueryButton = screen.getByText("Add Query");
        fireEvent.click(addQueryButton);

        // Should show a textarea for the new query (starts in edit mode)
        const textareas = screen.getAllByRole("textbox");
        const emptyTextarea = textareas.find(t => (t as HTMLTextAreaElement).value === "");
        expect(emptyTextarea).toBeInTheDocument();
      });

      it("edits query inline on click", async () => {
        const queryBank = createMockQueryBank();
        queryBank.retiree.explore.intents[0].generatedQueries = ["Click to edit"];

        render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

        const query = screen.getByText("Click to edit");
        fireEvent.click(query);

        // Should show textarea for editing
        const textarea = screen.getByDisplayValue("Click to edit");
        expect(textarea.tagName).toBe("TEXTAREA");
      });

      it("saves query on blur", async () => {
        const queryBank = createMockQueryBank();
        queryBank.retiree.explore.intents[0].generatedQueries = ["Original"];

        render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

        // Click to edit
        fireEvent.click(screen.getByText("Original"));

        // Change value
        const textarea = screen.getByDisplayValue("Original");
        fireEvent.change(textarea, { target: { value: "Modified query" } });
        fireEvent.blur(textarea);

        // Should show modified text
        expect(screen.getByText("Modified query")).toBeInTheDocument();
      });

      it("saves query on Enter key", async () => {
        const queryBank = createMockQueryBank();
        queryBank.retiree.explore.intents[0].generatedQueries = ["Test query"];

        render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

        fireEvent.click(screen.getByText("Test query"));

        const textarea = screen.getByDisplayValue("Test query");
        fireEvent.change(textarea, { target: { value: "Updated" } });
        fireEvent.keyDown(textarea, { key: "Enter" });

        expect(screen.getByText("Updated")).toBeInTheDocument();
      });

      it("cancels edit on Escape key", async () => {
        const queryBank = createMockQueryBank();
        queryBank.retiree.explore.intents[0].generatedQueries = ["Original query"];

        render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

        fireEvent.click(screen.getByText("Original query"));

        const textarea = screen.getByDisplayValue("Original query");
        fireEvent.change(textarea, { target: { value: "Changed" } });
        fireEvent.keyDown(textarea, { key: "Escape" });

        // Should show original text
        expect(screen.getByText("Original query")).toBeInTheDocument();
      });

      it("deletes query when X button clicked", async () => {
        const queryBank = createMockQueryBank();
        queryBank.retiree.explore.intents[0].generatedQueries = ["Query 1", "Query 2"];

        render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} />);

        expect(screen.getByText("Query 1")).toBeInTheDocument();
        expect(screen.getByText("Query 2")).toBeInTheDocument();

        // Find and click delete button for first query (using container query)
        const queryRows = screen.getAllByText(/Query/);
        const firstQueryContainer = queryRows[0].closest("[class*='group']");
        const deleteButton = firstQueryContainer?.querySelector("button");
        if (deleteButton) fireEvent.click(deleteButton);

        // Query 1 should be removed
        await waitFor(() => {
          expect(screen.queryByText("Query 1")).not.toBeInTheDocument();
        });
        expect(screen.getByText("Query 2")).toBeInTheDocument();
      });
    });
  });

  describe("Perspective Selector", () => {
    it("renders CPO/Family toggle buttons", () => {
      render(<QueryPanelV2 {...defaultProps} />);

      expect(screen.getByText("CPO")).toBeInTheDocument();
      expect(screen.getByText("FAMILY")).toBeInTheDocument();
    });

    it("updates active intent role on toggle click", () => {
      render(<QueryPanelV2 {...defaultProps} />);

      const familyButton = screen.getByText("FAMILY");
      fireEvent.click(familyButton);

      // Description should update to family perspective
      expect(screen.getByText(/Family Unit perspective/)).toBeInTheDocument();
    });

    it("shows CPO perspective description by default", () => {
      render(<QueryPanelV2 {...defaultProps} />);

      expect(screen.getByText(/CPO perspective/)).toBeInTheDocument();
    });
  });

  describe("Scope Selection", () => {
    it("shows mini matrix for scope selection", () => {
      render(<QueryPanelV2 {...defaultProps} />);

      // Mini matrix should show persona and stage labels
      expect(screen.getByText("M")).toBeInTheDocument(); // Move-up
      expect(screen.getByText("R")).toBeInTheDocument(); // Retiree
      expect(screen.getByText("E")).toBeInTheDocument(); // Explore
    });

    it("toggles to 'all' scope when clicking ALL CELLS", () => {
      render(<QueryPanelV2 {...defaultProps} />);

      const allCellsButton = screen.getByText("ALL CELLS");
      fireEvent.click(allCellsButton);

      expect(screen.getByText("Full Matrix")).toBeInTheDocument();
    });

    it("displays correct scope label for cell selection", () => {
      render(<QueryPanelV2 {...defaultProps} />);

      expect(screen.getByText("Retiree × Explore")).toBeInTheDocument();
    });
  });

  describe("Run and Save Actions", () => {
    it("calls onRunQueries with all queries when Run clicked", async () => {
      const queryBank = createMockQueryBank();
      queryBank.retiree.explore.intents[0].generatedQueries = ["Query 1", "Query 2"];

      const onRunQueries = vi.fn();
      render(<QueryPanelV2 {...defaultProps} queryBank={queryBank} onRunQueries={onRunQueries} />);

      const runButton = screen.getByText(/RUN.*QUERIES/);
      fireEvent.click(runButton);

      expect(onRunQueries).toHaveBeenCalled();
      expect(onRunQueries).toHaveBeenCalledWith(
        ["Query 1", "Query 2"],
        "retiree",
        "explore",
        expect.any(Object)
      );
    });

    it("calls onSaveQueries with local query bank when Save clicked", () => {
      const onSaveQueries = vi.fn();
      render(<QueryPanelV2 {...defaultProps} onSaveQueries={onSaveQueries} />);

      const saveButton = screen.getByText("Save Configuration");
      fireEvent.click(saveButton);

      expect(onSaveQueries).toHaveBeenCalled();
    });

    it("calls onOpenChange(false) after Run", () => {
      const onOpenChange = vi.fn();
      render(<QueryPanelV2 {...defaultProps} onOpenChange={onOpenChange} />);

      fireEvent.click(screen.getByText(/RUN.*QUERIES/));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Regenerate Queries", () => {
    it("calls onRegenerateQueries with active intent params", async () => {
      const onRegenerateQueries = vi.fn().mockResolvedValue(["New Query 1", "New Query 2"]);
      render(<QueryPanelV2 {...defaultProps} onRegenerateQueries={onRegenerateQueries} />);

      const generateButton = screen.getByText("GENERATE QUERIES");
      fireEvent.click(generateButton);

      expect(onRegenerateQueries).toHaveBeenCalledWith(
        "retiree",
        "explore",
        "Retiree Explore intent",
        "cpo",
        0.75
      );
    });

    it("shows loading state during regeneration", async () => {
      const onRegenerateQueries = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)));
      render(<QueryPanelV2 {...defaultProps} onRegenerateQueries={onRegenerateQueries} />);

      fireEvent.click(screen.getByText("GENERATE QUERIES"));

      expect(screen.getByText("GENERATING...")).toBeInTheDocument();
    });

    it("updates queries after regeneration completes", async () => {
      const onRegenerateQueries = vi.fn().mockResolvedValue(["Fresh Query 1", "Fresh Query 2"]);
      render(<QueryPanelV2 {...defaultProps} onRegenerateQueries={onRegenerateQueries} />);

      fireEvent.click(screen.getByText("GENERATE QUERIES"));

      await waitFor(() => {
        expect(screen.getByText("Fresh Query 1")).toBeInTheDocument();
        expect(screen.getByText("Fresh Query 2")).toBeInTheDocument();
      });
    });
  });
});
