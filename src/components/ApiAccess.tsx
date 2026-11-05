import { useEffect, useState } from 'react';
import { syncConfig } from '../syncConfig';

interface KeyInfo {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt?: number;
}

const headers = () => ({ 'content-type': 'application/json', 'x-tasker-passcode': syncConfig.passcode });
const when = (t?: number) => (t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'never');

/** Create / revoke export API keys and show how to call the export endpoint. */
export function ApiAccess({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState<KeyInfo[] | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const base = `${location.origin}/api/export`;

  const load = async () => {
    try {
      const res = await fetch('/api/keys', { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setKeys(data.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load keys');
    }
  };
  useEffect(() => {
    if (syncConfig.shared) load();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const create = async () => {
    setError('');
    const res = await fetch('/api/keys', { method: 'POST', headers: headers(), body: JSON.stringify({ name }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? 'Could not create key');
    setCreated(data.key);
    setName('');
    load();
  };

  const revoke = async (k: KeyInfo) => {
    if (!confirm(`Revoke “${k.name}” (${k.prefix}…)? Apps using it will stop working immediately.`)) return;
    await fetch(`/api/keys?id=${encodeURIComponent(k.id)}`, { method: 'DELETE', headers: headers() });
    load();
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    });
  };

  const sample = created ?? 'YOUR_API_KEY';
  const examples = [
    { label: 'All data (JSON)', value: base, note: 'Header: Authorization: Bearer <key>' },
    { label: 'Tasks as CSV', value: `${base}?format=csv&key=${sample}` },
    { label: 'Time entries as CSV', value: `${base}?format=csv&resource=time&key=${sample}` },
    { label: 'curl', value: `curl -H "Authorization: Bearer ${sample}" "${base}"` },
  ];

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal api-modal" role="dialog" aria-label="API access">
        <div className="modal-head">
          <h2>API access</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="muted small">
          Read all current board data (tasks, subtasks, every column, archived tasks, time tracked) from other apps such as
          Make, Zapier, Google Sheets or your own scripts. Keys are read-only.
        </p>

        {!syncConfig.shared ? (
          <div className="notice">API access needs the shared board (Upstash storage) to be connected on this deployment.</div>
        ) : (
          <>
            {created && (
              <div className="notice success">
                <b>Copy your new key now — it won’t be shown again.</b>
                <div className="key-row">
                  <code className="key-value">{created}</code>
                  <button className="btn primary small" onClick={() => copy(created, 'key')}>
                    {copied === 'key' ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <form
              className="key-create"
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <input className="input" placeholder="Key name, e.g. Make.com" value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn primary small">+ Create API key</button>
            </form>
            {error && <div className="notice error">{error}</div>}

            <table className="report-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys?.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td>
                      <code>{k.prefix}…</code>
                    </td>
                    <td className="nowrap">{when(k.createdAt)}</td>
                    <td className="nowrap">{when(k.lastUsedAt)}</td>
                    <td className="num">
                      <button className="link-btn danger" onClick={() => revoke(k)}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
                {keys && !keys.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No keys yet.
                    </td>
                  </tr>
                )}
                {!keys && !error && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Loading…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <h3 className="api-h3">How to use it</h3>
            {examples.map((x) => (
              <div className="example" key={x.label}>
                <div className="example-label">
                  {x.label}
                  {x.note && <span className="muted small"> · {x.note}</span>}
                </div>
                <div className="key-row">
                  <code className="key-value">{x.value}</code>
                  <button className="btn ghost small" onClick={() => copy(x.value, x.label)}>
                    {copied === x.label ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
            <p className="muted small">
              Options: <code>archived=include</code> or <code>archived=only</code> (default leaves archived tasks out),{' '}
              <code>subtasks=false</code>. In Google Sheets: <code>=IMPORTDATA("…?format=csv&amp;key=…")</code>. Prefer the
              Authorization header where the app supports it — a key in a URL can end up in logs.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
