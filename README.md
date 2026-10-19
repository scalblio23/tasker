# Tasker

A simple monday.com-style task board: groups of rows with typed columns.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build into dist/
```

## Features

- **Column types** — Text, Dropdown (select), Status and Link (URL). Add one with the `+` at the end of the header row.
- **Square, full-fill select/status cells** — the label's color fills the whole cell edge to edge (no pills). Click a cell to pick a label; *Edit labels* lets you rename, recolor, add or delete labels.
- **Link cells** — store a web address plus optional display text; opens in a new tab.
- **Sort** — multi-level A → Z / Z → A by any column (from the Sort button or a column's `⋯` menu). Empty cells always sort last.
- **Filter** — rules of `is`, `is not`, `contains`, `does not contain`, `is empty`, `is not empty`, combined with And / Or. On Dropdown/Status columns, `is` / `is not` pick a label.
- **Saved views** — sort + filter are saved per view tab. Change them and a bar offers *Save to "<view>"*, *Save as new view* or *Discard*. Double-click a tab to rename it.
- **Reorder columns** — drag a column header left or right, or use *Move left / Move right* in its `⋯` menu. *Task* stays first.
- **Bulk edit cells** — drag across cells, Shift+click for a range or Cmd/Ctrl+click to add single cells. Then:
  - click any highlighted cell and edit it: the change applies to every highlighted cell in that column
  - use the bar at the bottom: *Set <column>* for each column involved, or *Clear values*
  - press Delete/Backspace to clear, Cmd/Ctrl+C to copy, Cmd/Ctrl+V to paste (one value fills them all; a block from a spreadsheet pastes from the top-left cell, and unknown dropdown labels are created)
- Group summary bars showing the label split for each Dropdown/Status column.

Data is saved in the browser's `localStorage`; *Reset* restores the sample board.
