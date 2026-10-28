import { useRef, useState } from 'react';
import { formatDate, fromIso, toIso, todayIso } from '../../dates';
import { Popover } from '../Popover';

interface Props {
  value: string;
  onChange: (iso: string | undefined) => void;
}

/** Date cell: shows the date; click for a calendar. */
export function DateCell({ value, onChange }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const isToday = value === todayIso();

  return (
    <>
      <button ref={ref} className={`date-cell ${isToday ? 'today' : ''}`} onClick={() => setOpen(!open)} title={value || 'Pick a date'}>
        {value ? formatDate(value) : <span className="placeholder">📅 Set date</span>}
      </button>
      {open && (
        <Popover anchor={ref} onClose={() => setOpen(false)} className="date-pop">
          <Calendar
            value={value}
            onPick={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </Popover>
      )}
    </>
  );
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Month calendar (weeks start Monday). `onPick(undefined)` clears. */
export function Calendar({ value, onPick }: { value: string; onPick: (iso: string | undefined) => void }) {
  const selected = fromIso(value);
  const [month, setMonth] = useState(() => {
    const d = selected ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = todayIso();
  const lead = (month.getDay() + 6) % 7; // days before the 1st, Monday-based
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - lead);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <span className="cal-title">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-wd">
            {w}
          </span>
        ))}
        {days.map((d) => {
          const iso = toIso(d);
          const cls = [
            'cal-day',
            d.getMonth() !== month.getMonth() && 'other',
            iso === today && 'today',
            iso === value && 'selected',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={iso} className={cls} onClick={() => onPick(iso)} aria-label={d.toDateString()}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="pop-footer">
        {value && (
          <button className="link-btn" onClick={() => onPick(undefined)}>
            Clear
          </button>
        )}
        <span className="grow" />
        <button className="btn ghost small" onClick={() => onPick(today)}>
          Today
        </button>
      </div>
    </div>
  );
}
