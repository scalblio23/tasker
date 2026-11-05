import { useEffect, useState } from 'react';
import { syncConfig } from '../syncConfig';

interface KeyInfo {
  id: string;
  key: string;
  createdAt: number;
  lastUsedAt?: number;
}

const headers = () => ({ 'content-type': 'application/json', 'x-tasker-passcode': syncConfig.passcode });
const when = (t?: number) => (t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'not yet');

type Format = 'json' | 'csv' | 'time';
const FORMATS: { id: Format; label: string; query: string }[] = [
  { id: 'json', label: 'All data (JSON)', query: '' },
  { id: 'csv', label: 'Tasks (CSV)', query: '&format=csv' },
  { id: 'time', label: 'Time entries (CSV)', query: '&format=csv&resource=time' },
];

/** The board's API key, ready to copy, plus a data URL that works anywhere. */
export function ApiAccess({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<KeyInfo | null>(null);
  const [error, setError] = useState('');
  const [format, setFormat] = useState<Format>('json');
  const [copied, setCopied] = useState('');

  const call = async (method: 'GET' | 'POST') => {
    setError('');
    try {
      const res = await fetch('/api/keys', { method, headers: headers(), body: method === 'POST' ? '{"regenerate":true}' : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setInfo(data.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the API key');
    }
  };

  useEffect(() => {
    if (syncConfig.shared) call('GET');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = (text: string, label: string) =>
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    });

  const endpoint = `${location.origin}/api/export`;
  const url = info ? `${endpoint}?key=${info.key}${FORMATS.find((f) => f.id === format)!.query}` : '';

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal api-modal" role="dialog" aria-label="API key">
        <div className="modal-head">
          <h2>API key</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {!syncConfig.shared ? (
          <div className="notice">The API needs the shared board (Upstash storage) to be connected on this deployment.</div>
        ) : error ? (
          <div className="notice error">{error}</div>
        ) : !info ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <label className="api-label">Your API key</label>
            <div className="key-row">
              <code className="key-value big" data-testid="api-key">
                {info.key}
              </code>
              <button className="btn primary" onClick={() => copy(info.key, 'key')}>
                {copied === 'key' ? 'Copied ✓' : 'Copy key'}
              </button>
            </div>

            <label className="api-label">Data URL — paste into a browser, spreadsheet or any app</label>
            <div className="segmented small-seg">
              {FORMATS.map((f) => (
                <button key={f.id} className={format === f.id ? 'on' : ''} onClick={() => setFormat(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="key-row">
              <code className="key-value" data-testid="api-url">
                {url}
              </code>
              <button className="btn primary" onClick={() => copy(url, 'url')}>
                {copied === 'url' ? 'Copied ✓' : 'Copy URL'}
              </button>
              <a className="btn ghost" href={url} target="_blank" rel="noopener noreferrer">
                Open
              </a>
            </div>

            <div className="api-help">
              <div>
                <b>Endpoint:</b> <code>GET {endpoint}</code>
              </div>
              <div>
                <b>Key:</b> in the URL as <code>?key=…</code>, or as a header <code>Authorization: Bearer &lt;key&gt;</code> or{' '}
                <code>X-API-Key: &lt;key&gt;</code>
              </div>
              <div>
                <b>Options:</b> <code>&amp;format=csv</code> · <code>&amp;resource=time</code> · <code>&amp;archived=include</code> ·{' '}
                <code>&amp;subtasks=false</code>
              </div>
              <div>
                <b>Google Sheets:</b> <code>=IMPORTDATA("{endpoint}?key=…&amp;format=csv")</code>
              </div>
            </div>

            <div className="api-foot">
              <span className="muted small">
                Read-only · last used {when(info.lastUsedAt)} · anyone with this key can read the board
              </span>
              <button
                className="link-btn danger"
                onClick={() => confirm('Make a new key? The current key stops working straight away.') && call('POST')}
              >
                Regenerate key
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
