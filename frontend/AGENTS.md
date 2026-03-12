# Frontend Agent Notes

This document describes the current frontend codebase so future tasks can be executed quickly and safely.

## Overview

- Stack: Next.js App Router, React 19, TypeScript, Tailwind CSS v4.
- Purpose: Single-page Kanban demo app ("Kanban Studio") with in-memory state only.
- Entry route: `/` renders the board directly.
- Current status: Pure frontend implementation; no auth, no backend API, no persistence.

## File map

- `src/app/page.tsx`
  - Home page entrypoint.
  - Renders `<KanbanBoard />`.
- `src/components/KanbanBoard.tsx`
  - Main board state container and interaction orchestration.
  - Handles drag start/end, column rename, add card, delete card.
- `src/components/KanbanColumn.tsx`
  - Column UI, rename input, list of sortable cards, empty drop zone, add-card form.
- `src/components/KanbanCard.tsx`
  - Sortable card item and remove action.
- `src/components/NewCardForm.tsx`
  - Expand/collapse form for adding cards to a column.
- `src/components/KanbanCardPreview.tsx`
  - Drag overlay preview card UI.
- `src/lib/kanban.ts`
  - Domain types (`Card`, `Column`, `BoardData`), seed data, `moveCard`, `createId`.

## Current behavior

- Board has five seeded columns with initial cards from `initialData`.
- User can:
  - rename column titles inline
  - add new cards per column
  - delete cards
  - drag cards within and across columns
- Board state exists only in local component state in `KanbanBoard`.
- Added card IDs are generated client-side with `createId`.

## Drag-and-drop model

- Uses `@dnd-kit/core` and `@dnd-kit/sortable`.
- `DndContext` is mounted at board level.
- `SortableContext` is mounted per column, keyed by `column.cardIds`.
- `moveCard(columns, activeId, overId)` handles:
  - reorder within same column
  - move across columns
  - drop onto a column container to append at end
- Active drag preview is rendered via `DragOverlay` + `KanbanCardPreview`.

## Styling and design tokens

- Global CSS vars in `src/app/globals.css` mirror project palette:
  - `--accent-yellow: #ecad0a`
  - `--primary-blue: #209dd7`
  - `--secondary-purple: #753991`
  - `--navy-dark: #032147`
  - `--gray-text: #888888`
- Fonts from `src/app/layout.tsx`:
  - display: `Space_Grotesk`
  - body: `Manrope`
- Component styling is utility-first with Tailwind class strings.

## Testing baseline

- Unit/component tests:
  - `src/components/KanbanBoard.test.tsx`
    - renders five columns
    - renames a column
    - adds and removes a card
  - `src/lib/kanban.test.ts`
    - verifies `moveCard` for same-column reorder, cross-column move, and append-on-drop
- E2E tests:
  - `tests/kanban.spec.ts`
    - board loads
    - add a card flow
    - drag card between columns
- Commands from `package.json`:
  - `npm run test:unit`
  - `npm run test:e2e`
  - `npm run test:all`

## Known constraints and implications

- No server boundary yet; all board mutations are client-local.
- No user/session model yet.
- No persistence layer; refreshing resets to seed data.
- No AI sidebar implementation yet.

## Guidance for upcoming integration work

- Keep board domain shapes in `src/lib/kanban.ts` as the canonical client model unless backend contract requires controlled evolution.
- Avoid introducing global state libraries unless clearly necessary; current scope can remain component-driven.
- For backend integration, isolate network logic behind a small API helper layer instead of spreading fetch calls through UI components.
- Preserve existing tests and expand incrementally as behavior changes.
