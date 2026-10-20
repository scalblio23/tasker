import { useRef, useState } from 'react';
import type { Board } from '../types';
import type { Mutator } from '../store';
import { describeMerge, listBackups, mergeBoards, saveBackup, taskCount, type Backup } from '../backup';
import { uploadLocalFiles } from '../files';
import { syncConfig } from '../syncConfig';
import { migrateBoard } from '../defaults';
import { Popover } from './Popover';

/** Board ⋯ menu: export a JSON copy, and restore tasks from a backup or a file (merge, never delete). */
export function BoardMenu({ board, update }: { board: Board; update: Mutator }) {
  const ref = useRef<HTMLButtonElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const restore = async (source: Board, label: string) => {
    const missing = source.items.filter((i) => !board.items.some((b) => b.id === i.id));
    if (!missing.length) return alert(`Nothing to restore — every task in ${label} is already on the board.`);
    if (!confirm(`Add ${missing.length} task${missing.length === 1 ? '' : 's'}/subtasks from ${label} to the board?\n\nNothing on the board is removed or changed.`)) return;
    saveBackup(board, 'Before restoring');
    const src = syncConfig.files ? await uploadLocalFiles(source) : source;
    let result: ReturnType<typeof mergeBoards> | null = null;
    update((b) => void (result = mergeBoards(b, src)));
    setOpen(false);
    setRestoring(false);
    if (result) alert(`Restored ${describeMerge(result)}.`);
  };

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' }));
    a.download = `tasker-board-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const backups = open && restoring ? listBackups() : [];

  return (
    <>
      <button ref={ref} className="icon-btn board-menu-btn" onClick={() => setOpen(!open)} aria-label="Board menu" title="Board menu">
        ⋯
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const parsed = JSON.parse(await f.text()) as Board;
            if (!Array.isArray(parsed.items) || !Array.isArray(parsed.columns)) throw new Error('not a board');
            restore(migrateBoard(parsed), `“${f.name}”`);
          } catch {
            alert('That file isn’t a Tasker board export.');
          }
        }}
      />
      {open && (
        <Popover
          anchor={ref}
          onClose={() => {
            setOpen(false);
            setRestoring(false);
          }}
          className="menu board-menu"
        >
          {!restoring ? (
            <>
              <button onClick={exportJson}>⤓ Download a copy (JSON)</button>
              <button onClick={() => setRestoring(true)}>↺ Restore tasks from a backup…</button>
              <button onClick={() => file.current?.click()}>⤒ Restore tasks from a file…</button>
            </>
          ) : (
            <>
              <div className="menu-label">Backups saved in this browser — restoring adds missing tasks, never deletes</div>
              {!backups.length && <div className="muted small pad">No backups in this browser.</div>}
              {backups.map((bk: Backup) => {
                const missing = bk.board.items.filter((i) => !board.items.some((b) => b.id === i.id)).length;
                return (
                  <button key={bk.id} onClick={() => restore(migrateBoard(structuredClone(bk.board)), 'this backup')} disabled={!missing}>
                    <span className="grow">
                      {bk.at ? new Date(bk.at).toLocaleString() : 'Earlier backup'} · {taskCount(bk.board)} tasks
                      <span className="muted small block">
                        {bk.reason} · {missing ? `${missing} not on the board` : 'all already on the board'}
                      </span>
                    </span>
                  </button>
                );
              })}
              <div className="pop-footer">
                <button className="link-btn" onClick={() => setRestoring(false)}>
                  ← Back
                </button>
              </div>
            </>
          )}
        </Popover>
      )}
    </>
  );
}
