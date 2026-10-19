# Tasker

A simple monday.com-style task board: groups of rows with typed columns.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build into dist/
```

## Features

- **Column types** — Text, Dropdown (select), Status, Link (URL), Person and Time tracking. Add one with the `+` at the end of the header row.
- **Square, full-fill select/status cells** — the label's color fills the whole cell edge to edge (no pills). Click a cell to pick a label; *Edit labels* lets you rename, recolor, add or delete labels.
- **Link cells** — store a web address plus optional display text; opens in a new tab.
- **Sort** — multi-level A → Z / Z → A by any column (from the Sort button or a column's `⋯` menu). Empty cells always sort last.
- **Filter** — rules of `is`, `is not`, `contains`, `does not contain`, `is empty`, `is not empty`, combined with And / Or. On Dropdown/Status columns, `is` / `is not` pick a label.
- **Saved views** — sort + filter are saved per view tab. Change them and a bar offers *Save to "<view>"*, *Save as new view* or *Discard*. Double-click a tab to rename it.
- **Users** — Charles, Jem, Cody and Byrone to start. The *Tracking as* menu (top right) picks who you are on this device and lets you add, rename or remove users.
- **Person column** — click a cell to assign one or more users. Filter with *Person is Jem*, sort, bulk-assign or paste names.
- **Time tracking** — every entry belongs to a user. The first ▶ on a device asks *who's tracking?* and remembers it; after that ▶ starts a timer for that user (starting another stops the first); ■ stops it. The running timer also shows top right with a Stop button. Avatars show who is tracking each running timer. Click the total to see the time log with a per-person breakdown, reassign an entry to someone else, add time manually for a chosen person ("1h 30m", "1:30", "1.5") or delete entries.
- **Reports tab** — time tracked today / this week / this month / all time, for everyone or one person: totals, by person, by task, the full log, and CSV export.
- **Subtasks** — hover a task and click *+ Sub* (or the `▸ 2` count) to expand it and add subtasks. Subtasks use the same columns, so each can have its own person, status, timer and so on. Filters show a task when it or any subtask matches; sorting orders subtasks within their task; deleting a task deletes its subtasks. Reports list subtask time as "Task › Subtask".
- **Reorder columns** — drag a column header left or right, or use *Move left / Move right* in its `⋯` menu. *Task* stays first.
- **Bulk edit cells** — drag across cells, Shift+click for a range or Cmd/Ctrl+click to add single cells. Then:
  - click any highlighted cell and edit it: the change applies to every highlighted cell in that column
  - use the bar at the bottom: *Set <column>* for each column involved, or *Clear values*
  - press Delete/Backspace to clear, Cmd/Ctrl+C to copy, Cmd/Ctrl+V to paste (one value fills them all; a block from a spreadsheet pastes from the top-left cell, and unknown dropdown labels are created)
- Group summary bars showing the label split for each Dropdown/Status column.

Data is saved in the browser's `localStorage`; *Reset* restores the sample board.
