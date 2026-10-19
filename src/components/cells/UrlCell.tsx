import { useRef, useState } from 'react';
import type { UrlValue } from '../../types';
import { normalizeUrl } from '../../logic';
import { Popover } from '../Popover';

interface Props {
  value: UrlValue | undefined;
  onChange: (v: UrlValue | undefined) => void;
}

/** Link cell: shows a clickable link; clicking the cell itself opens an editor for URL + display text. */
export function UrlCell({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');

  const start = () => {
    setUrl(value?.url ?? '');
    setText(value?.text ?? '');
    setOpen(true);
  };

  const save = () => {
    const u = normalizeUrl(url);
    onChange(u ? { url: u, text: text.trim() } : undefined);
    setOpen(false);
  };

  const href = value?.url ? normalizeUrl(value.url) : '';

  return (
    <>
      <div ref={ref} className="url-cell" onClick={() => (open ? setOpen(false) : start())}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title={href}>
            {value?.text || href.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="placeholder">+ Add link</span>
        )}
      </div>
      {open && (
        <Popover anchor={ref} onClose={() => setOpen(false)} className="url-pop">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="field">
              <span>Web address</span>
              <input className="input" autoFocus value={url} placeholder="www.example.com" onChange={(e) => setUrl(e.target.value)} />
            </label>
            <label className="field">
              <span>Text to display</span>
              <input className="input" value={text} placeholder="Optional" onChange={(e) => setText(e.target.value)} />
            </label>
            <div className="pop-footer">
              {value && (
                <button type="button" className="link-btn danger" onClick={() => { onChange(undefined); setOpen(false); }}>
                  Remove
                </button>
              )}
              <button type="submit" className="btn primary small">
                Save
              </button>
            </div>
          </form>
        </Popover>
      )}
    </>
  );
}
