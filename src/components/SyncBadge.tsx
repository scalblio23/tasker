import { useState } from 'react';
import type { SyncStatus } from '../store';

const LABEL: Record<SyncStatus, { text: string; hint: string }> = {
  local: { text: 'This browser only', hint: 'Shared storage is not set up, so changes are saved in this browser and other people can’t see them.' },
  connecting: { text: 'Connecting…', hint: 'Loading the shared board.' },
  synced: { text: 'Synced', hint: 'Everyone sees the same board. Other people’s changes appear within a few seconds.' },
  saving: { text: 'Saving…', hint: 'Sending your changes.' },
  offline: { text: 'Offline — retrying', hint: 'Can’t reach the server. Your edits are kept and will be sent when it’s back.' },
  passcode: { text: 'Passcode needed', hint: '' },
};

export function SyncBadge({ status }: { status: SyncStatus }) {
  const { text, hint } = LABEL[status];
  return (
    <span className={`sync-badge ${status}`} title={hint}>
      <span className="sync-dot" />
      {text}
    </span>
  );
}

export function PasscodeScreen({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <div className="passcode-screen">
      <form
        className="passcode-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onSubmit(code.trim());
        }}
      >
        <h2>Team passcode</h2>
        <p className="muted">This board is shared with your team. Enter the passcode to open it.</p>
        <input className="input" type="password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Passcode" />
        <button className="btn primary" disabled={!code.trim()}>
          Open board
        </button>
      </form>
    </div>
  );
}
