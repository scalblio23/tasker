# Tasker

A simple monday.com-style task board: groups of rows with typed columns.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build into dist/
```

## Features

- **Column types** — Text, Dropdown (select), Status, Link (URL), Person, Time tracking and Attachments. Add one with the `+` at the end of the header row.
- **Square, full-fill select/status cells** — the label's color fills the whole cell edge to edge (no pills). Click a cell to pick a label; *Edit labels* lets you rename, recolor, add or delete labels.
- **Link cells** — store a web address plus optional display text; opens in a new tab.
- **Sort** — multi-level A → Z / Z → A by any column (from the Sort button or a column's `⋯` menu). Empty cells always sort last.
- **Filter** — rules of `is`, `is not`, `contains`, `does not contain`, `is empty`, `is not empty`, combined with And / Or. On Dropdown/Status columns, `is` / `is not` pick a label.
- **Saved views** — sort + filter are saved per view tab. Change them and a bar offers *Save to "<view>"*, *Save as new view* or *Discard*. Double-click a tab to rename it.
- **Users** — Charles, Jem, Cody and Byrone to start. The *Tracking as* menu (top right) picks who you are on this device and lets you add, rename or remove users.
- **Person column** — click a cell to assign one or more users. Filter with *Person is Jem*, sort, bulk-assign or paste names.
- **Time tracking** — every entry belongs to a user. The first ▶ on a device asks *who's tracking?* and remembers it; after that ▶ starts a timer for that user (starting another stops the first); ■ stops it. The running timer also shows top right with a Stop button. Avatars show who is tracking each running timer. Click the total to see the time log with a per-person breakdown, reassign an entry to someone else, add time manually for a chosen person ("1h 30m", "1:30", "1.5") or delete entries.
- **Reports tab** — time tracked today / this week / this month / all time, for everyone or one person: totals, by person, by task, the full log, and CSV export.
- **Select rows** — tick the checkbox on the left of a row (or the header checkbox for a whole group) to get a bar with *Archive*, *Move to* group and *Delete*. Esc clears.
- **Archive** — archived tasks (with their subtasks) leave the board and appear in the *Archive* tab, where they can be searched, restored or deleted for good. Archiving syncs to everyone; tracked time stays in reports.
- **Subtasks** — hover a task and click *+ Sub* (or the `▸ 2` count) to expand it and add subtasks. Subtasks use the same columns, so each can have its own person, status, timer and so on. Filters show a task when it or any subtask matches; sorting orders subtasks within their task; deleting a task deletes its subtasks. Reports list subtask time as "Task › Subtask".
- **Attachments** — drop files onto an Attachments cell or click it to pick files (up to 25 MB each). Images show as thumbnails, other files as a colored type tile. Click the cell to open, download or remove files. Files are kept in this browser's IndexedDB; storage for deleted tasks is cleaned up automatically.
- **Resize columns** — drag the right edge of any column header; double-click the edge to reset it. Widths are saved.
- **Reorder columns** — drag a column header left or right, or use *Move left / Move right* in its `⋯` menu. *Task* stays first.
- **Bulk edit cells** — drag across cells, Shift+click for a range or Cmd/Ctrl+click to add single cells. Then:
  - click any highlighted cell and edit it: the change applies to every highlighted cell in that column
  - use the bar at the bottom: *Set <column>* for each column involved, or *Clear values*
  - press Delete/Backspace to clear, Cmd/Ctrl+C to copy, Cmd/Ctrl+V to paste (one value fills them all; a block from a spreadsheet pastes from the top-left cell, and unknown dropdown labels are created)
- Group summary bars showing the label split for each Dropdown/Status column.

## Sharing the board with your team

Out of the box everything is saved in each person's browser, so nobody else sees it. Connect
shared storage on Vercel and everyone works on the same board, with changes showing up for
others within a few seconds. The badge next to the board title shows the mode: **Synced**, or
**This browser only** when shared storage isn't connected.

1. In your Vercel project open **Storage → Create Database**, pick **Upstash for Redis** (Marketplace),
   and connect it to this project. That adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. For shared attachments, also create a **Blob** store and connect it. Both kinds of store work: older
   ones add `BLOB_READ_WRITE_TOKEN`, newer ones add `BLOB_STORE_ID` + `BLOB_WEBHOOK_PUBLIC_KEY`.
   Without a store, attachments stay in the browser that uploaded them.
3. Optional: under **Settings → Environment Variables** add `TASKER_PASSCODE`. Everyone enters it once
   per browser. Without it, anyone with the URL can open the board.
4. **Redeploy** (new environment variables only apply to new deployments).
5. **Open the app in the browser that has the real board first.** The first browser to connect is asked
   whether to share its board; say yes there. Everyone who opens it afterwards loads the shared
   board (their old local copy is kept in `localStorage` under `tasker.board.local-backup`).

How it works: `api/sync.ts` (a Vercel Function) stores the board in Redis as separate entities
(each task, each time entry, the column list, …). Clients send only what changed — a single cell
edit is a field-level patch — so two people editing different things, even different cells of the
same task, don't overwrite each other. Clients poll every 3 s while in use and every 15 s when idle.
*Tracking as*, unsaved sort/filter and expanded subtasks stay per person. Attachments upload
straight from the browser to Vercel Blob via `api/upload.ts`; their URLs are public but unguessable.

**Backups and restore.** Before this browser's board is ever replaced (joining a shared board,
sharing, restoring), a copy is saved locally; the first copy is kept for good plus the latest few.
When a browser with tasks the shared board doesn't have connects, it asks whether to add them.
The board's **⋯** menu can download a JSON copy and restore tasks from a backup or a file —
restoring only adds missing tasks (matching people by name and labels by text), never deletes.

Troubleshooting: open `https://<your-app>/api/sync?full=1`. `{"configured":true,…}` means sharing is on;
`{"configured":false}` means the Redis variables aren't reaching the deployment (redeploy); a page of
HTML or a 404 means the deployment doesn't include the `api/` folder (wrong branch). If the badge shows
**Sync error**, hover it to see the server's message.

`npm run dev` serves the same API with an in-memory store, so you can try sharing between two
local browser windows. See `.env.example` for all settings.

In local-only mode, *Reset* restores the sample board (it's hidden on a shared board).
