import { useRef, useState, type DragEvent } from 'react';
import type { FileRef } from '../../types';
import { uid } from '../../defaults';
import { MAX_FILE_BYTES, deleteFile, formatBytes, openFile, putFile, useFileUrl } from '../../files';
import { Popover } from '../Popover';

interface Props {
  value: FileRef[];
  onAdd: (refs: FileRef[]) => void;
  onRemove: (id: string) => void;
}

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

/** Attachments: drop files on the cell or pick them; click to view, download or remove. */
export function FilesCell({ value, onAdd, onRemove }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = async (list: FileList | File[]) => {
    const files = [...list];
    const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooBig.length) alert(`Skipped (over ${formatBytes(MAX_FILE_BYTES)}): ${tooBig.map((f) => f.name).join(', ')}`);
    const ok = files.filter((f) => f.size <= MAX_FILE_BYTES);
    if (!ok.length) return;
    setBusy(true);
    try {
      const refs: FileRef[] = [];
      for (const f of ok) {
        const id = uid() + uid();
        await putFile(id, f);
        refs.push({ id, name: f.name, size: f.size, type: f.type, addedAt: Date.now() });
      }
      onAdd(refs);
    } catch {
      alert('Could not save the file in this browser (storage may be full or blocked).');
    } finally {
      setBusy(false);
    }
  };

  const remove = (f: FileRef) => {
    if (!confirm(`Remove "${f.name}"?`)) return;
    onRemove(f.id);
    deleteFile(f.id).catch(() => {});
  };

  const dropProps = {
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setOver(false);
      upload(e.dataTransfer.files);
    },
  };

  return (
    <>
      <div
        ref={ref}
        className={`files-cell ${over ? 'over' : ''}`}
        onClick={() => (value.length ? setOpen(!open) : input.current?.click())}
        title={value.length ? value.map((f) => f.name).join('\n') : 'Add files (or drop them here)'}
        {...dropProps}
      >
        {busy ? (
          <span className="muted small">Uploading…</span>
        ) : value.length ? (
          <span className="file-stack">
            {value.slice(0, 3).map((f) => (
              <FileThumb key={f.id} file={f} size={26} />
            ))}
            {value.length > 3 && <span className="file-more">+{value.length - 3}</span>}
          </span>
        ) : (
          <span className="placeholder">📎 Add file</span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
          e.target.value = '';
        }}
      />
      {open && (
        <Popover anchor={ref} onClose={() => setOpen(false)} className="files-pop">
          <div className="panel-title">
            Attachments <span className="muted small">· {value.length}</span>
          </div>
          <div className={`file-list ${over ? 'over' : ''}`} {...dropProps}>
            {value.map((f) => (
              <div className="file-row" key={f.id}>
                <FileThumb file={f} size={40} />
                <button className="file-name" onClick={() => openFile(f.id)} title="Open">
                  {f.name}
                  <span className="muted small block">
                    {formatBytes(f.size)} · {new Date(f.addedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </span>
                </button>
                <button className="icon-btn" onClick={() => openFile(f.id, f.name)} title="Download" aria-label="Download">
                  ⤓
                </button>
                <button className="icon-btn" onClick={() => remove(f)} title="Remove" aria-label="Remove">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="pop-footer">
            <span className="muted small grow">Drop files here or</span>
            <button className="btn primary small" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? 'Uploading…' : '+ Add files'}
            </button>
          </div>
        </Popover>
      )}
    </>
  );
}

const EXT_COLORS: Record<string, string> = { pdf: '#e2445c', doc: '#2b579a', docx: '#2b579a', xls: '#1d6f42', xlsx: '#1d6f42', csv: '#1d6f42', ppt: '#d24726', pptx: '#d24726', zip: '#784bd1' };

/** Image preview, or a colored square with the file extension. */
function FileThumb({ file, size }: { file: FileRef; size: number }) {
  const isImage = file.type.startsWith('image/');
  const url = useFileUrl(isImage ? file.id : null);
  const ext = (file.name.split('.').pop() ?? '').toLowerCase().slice(0, 4);
  const style = { width: size, height: size };
  if (isImage && url) return <img className="file-thumb" src={url} alt={file.name} style={style} />;
  return (
    <span className="file-thumb ext" style={{ ...style, background: EXT_COLORS[ext] ?? '#9aadbd', fontSize: size * 0.3 }}>
      {ext || 'file'}
    </span>
  );
}
