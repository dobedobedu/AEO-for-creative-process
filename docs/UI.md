# UI Design Guide

Design language and UX patterns for the AI Visibility Baseline app.

## Core Principles

1. **Full-screen modals**: Modals use `w-[95vw] h-[90vh]` to maximize usable space.
2. **Side-by-side Integrated Chat**: Critical insights should always be paired with a chat interface for immediate auditing.
3. **Architectural Aesthetic**: Prefer hard edges, standard spacing, and underlined navigation over rounded pills and buttons.
4. **Minimal chrome**: Reduce visual noise; if a metric doesn't drive a decision (like internal counts), hide it.

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary (dark green) | `#1f3b2c` | Headers, primary buttons, active states |
| Accent (burnt orange) | `#b86f3a` | Anthropic brand, warnings |
| Secondary (olive) | `#6e7c5b` | Success states, secondary actions |
| Muted (sage) | `#7c6b7c` | Disabled, tertiary elements |
| Background | `#f6f1e8` | Page background |
| Surface | `#fffaf2` | Cards, elevated surfaces |
| Border | `#e3dacb` | Dividers, table borders |
| Text primary | `#1e1b16` | Main text |
| Text muted | `#1e1b16/50` | Secondary text, placeholders |

## Stage Colors

| Stage | Background | Text |
|-------|------------|------|
| Explore | `bg-blue-100` | `text-blue-700` |
| Consider | `bg-amber-100` | `text-amber-700` |
| Compare | `bg-purple-100` | `text-purple-700` |
| Decide | `bg-green-100` | `text-green-700` |

## Component Patterns

### Modals / Dialogs

```tsx
// Full-screen modal - ALWAYS use this size for data-heavy modals
<DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">

// Standard small modal (rare - only for confirmations)
<DialogContent className="max-w-md">
```

- **Default**: No max-width constraint (removed `sm:max-w-lg` from dialog.tsx)
- Consumer must specify width/height explicitly
- Header with title, badges, tabs
- Scrollable content area with `flex-1 overflow-auto`
- No footer buttons for auto-save flows

### Tables / Data Grids

```tsx
// Spreadsheet layout
<div className="grid grid-cols-[140px_1fr_100px_80px_40px] gap-0">
```

- Fixed column widths for labels, flexible for content
- Sticky headers with `sticky top-0 z-10`
- Row hover: `hover:bg-[#fffaf2]`
- Border between cells: `border-r border-[#e3dacb]/50`

### Inline Editable Fields

```tsx
<input
  className="w-full bg-transparent border-0 outline-none focus:bg-white focus:ring-1 focus:ring-[#6e7c5b] rounded px-2 py-1 text-sm"
/>
```

- Transparent background until focused
- Subtle ring on focus
- Auto-save on blur with 500ms debounce
- Show "Saving..." indicator in header

### Buttons

| Variant | Usage | Style |
|---------|-------|-------|
| Primary | Main actions | `bg-[#1f3b2c] hover:bg-[#1a3225] text-white` |
| Secondary | Alternative actions | `bg-[#6e7c5b] hover:bg-[#5e6c4b] text-white` |
| Ghost | Inline actions | `hover:bg-[#e3dacb] text-[#1e1b16]/50` |
| Destructive | Delete actions | `hover:bg-red-50 text-red-500` |

### Badges

```tsx
// Stage badge
<Badge className="text-[10px] bg-blue-100 text-blue-700">Explore</Badge>

// Count badge
<Badge variant="secondary" className="text-xs">16 intents</Badge>

// Version badge
<Badge variant="outline" className="text-xs">v49</Badge>
```

### Tabs / Navigation

Don't use button groups or pills for primary navigation filters. Use the "Matrix Tab" style:
- Underlined when active (2px border-b)
- Light gray text when inactive
- Uppercase, high-tracking typography (`tracking-widest`)

```tsx
<button className={`pb-4 text-[10px] font-bold uppercase tracking-widest ${active ? "text-black border-b-2 border-black" : "text-black/30"}`}>
  METRIC NAME
</button>
```

## UX Patterns

### Auto-save

- Debounce: 500ms after last change
- Show loading indicator: `<Loader2 className="h-3 w-3 animate-spin" /> Saving...`
- No explicit save button for data grids
- Escape key reverts to original value

### Empty States

```tsx
<span className="text-xs text-[#1e1b16]/30 italic">
  No intents - click + to add
</span>
```

### Loading States

```tsx
<Loader2 className="h-3 w-3 animate-spin" />
```

### Delete Confirmation

- Soft delete (mark inactive) doesn't need confirmation
- Hard delete should use confirmation dialog

## Typography

| Element | Class |
|---------|-------|
| Page title | `text-xl font-semibold tracking-tight` |
| Section title | `text-sm font-semibold` |
| Body text | `text-sm text-[#1e1b16]` |
| Muted text | `text-xs text-[#1e1b16]/50` |
| Table header | `text-xs font-semibold text-[#1e1b16]/70` |

## Spacing

- Page padding: `p-6`
- Card padding: `p-4`
- Table cell padding: `px-3 py-2`
- Gap between items: `gap-2` (small), `gap-4` (medium), `gap-6` (large)

## Icons

Use Lucide icons at these sizes:
- Inline with text: `h-4 w-4`
- Small buttons: `h-3 w-3`
- Large standalone: `h-5 w-5`

Common icons:
- Add: `Plus`
- Edit: `Pencil`
- Delete: `Trash2`
- Refresh: `RefreshCw`
- Loading: `Loader2` (with `animate-spin`)
- Expand: `ChevronDown` / `ChevronRight`
- Run: `Play`

## AnswersPanel (LLM Response Viewer)

Full-screen modal for viewing AI responses with stage-specific metrics.

### Brand Highlighting

Brand mentions are highlighted in responses using `<mark>`:

```tsx
<mark className="bg-[#dcf3dc] text-[#1f3b2c] px-1 py-0.5 rounded-sm font-semibold not-italic">
  Lakewood Ranch
</mark>
```

Highlights: "Lakewood Ranch", "LWR", "Lakewood" (case-insensitive, longest match first)

### Stage-Specific Badges

| Stage | Collapsed Header Badges |
|-------|------------------------|
| Explore | Mentioned, Position (best), Query count |
| Consider | Mentioned, Sentiment, Query count |
| Compare | Mentioned, Query count |
| Decide | Mentioned, Query count |

Position badge only shows when brand is mentioned. Sentiment badge only shows for Consider stage.

### Heatmap Colors (Standardized)

```tsx
const getHeatmapBg = (score: number) => {
  if (score >= 0.7) return "bg-[#dcf3dc]"; // Green - strong
  if (score >= 0.4) return "bg-[#faf5ef]"; // Tan - moderate
  return "bg-[#fce9e9]";                   // Red - weak
};
```

## GalleryTile Stage Metrics

| Stage | Label | Source Field |
|-------|-------|-------------|
| Explore | "Discovery" | `discoveryRate` |
| Consider | "Sentiment" | `sentimentScore` (numeric + label) |
| Compare | "Win Rate" | `winRate` |
| Decide | "Rec Rate" | `recommendationRate` |
