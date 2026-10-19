import type { Column, FilterOp, FilterRule, SortRule, User, ViewQuery } from '../types';
import { OPS, choicesFor, opNeedsValue, opUsesOption } from '../logic';
import { uid } from '../defaults';

interface PanelProps {
  columns: Column[];
  users: User[];
  query: ViewQuery;
  onChange: (q: ViewQuery) => void;
}

export function FilterPanel({ columns, users, query, onChange }: PanelProps) {
  const setRule = (id: string, patch: Partial<FilterRule>) =>
    onChange({ ...query, filters: query.filters.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  return (
    <div className="panel">
      <div className="panel-title">Filter items</div>
      {!query.filters.length && <div className="muted small">No filters applied.</div>}
      {query.filters.map((rule, i) => {
        const col = columns.find((c) => c.id === rule.columnId);
        return (
          <div className="panel-row" key={rule.id}>
            {i === 0 ? (
              <span className="conj">Where</span>
            ) : i === 1 ? (
              <select
                className="input conj"
                value={query.conjunction}
                onChange={(e) => onChange({ ...query, conjunction: e.target.value as ViewQuery['conjunction'] })}
              >
                <option value="and">And</option>
                <option value="or">Or</option>
              </select>
            ) : (
              <span className="conj">{query.conjunction === 'and' ? 'And' : 'Or'}</span>
            )}
            <select
              className="input"
              value={rule.columnId}
              onChange={(e) => setRule(rule.id, { columnId: e.target.value, value: '' })}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={rule.op}
              onChange={(e) => {
                const op = e.target.value as FilterOp;
                // Switching between option-picker and free-text ops invalidates the value.
                const keep = col && opUsesOption(col, op) === opUsesOption(col, rule.op);
                setRule(rule.id, { op, value: keep ? rule.value : '' });
              }}
            >
              {OPS.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>
            {col && opNeedsValue(rule.op) ? (
              opUsesOption(col, rule.op) ? (
                <select className="input" value={rule.value} onChange={(e) => setRule(rule.id, { value: e.target.value })}>
                  <option value="">Select…</option>
                  {choicesFor(col, users).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  placeholder="Value"
                  value={rule.value}
                  onChange={(e) => setRule(rule.id, { value: e.target.value })}
                />
              )
            ) : (
              <span />
            )}
            <button
              className="icon-btn"
              onClick={() => onChange({ ...query, filters: query.filters.filter((r) => r.id !== rule.id) })}
              aria-label="Remove filter"
            >
              ✕
            </button>
          </div>
        );
      })}
      <div className="panel-actions">
        <button className="link-btn" onClick={() => onChange(addFilter(query, columns))}>
          + Add filter
        </button>
        {query.filters.length > 0 && (
          <button className="link-btn" onClick={() => onChange({ ...query, filters: [] })}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

export function addFilter(query: ViewQuery, columns: Column[], columnId?: string): ViewQuery {
  const col = columns.find((c) => c.id === columnId) ?? columns.find((c) => !c.locked) ?? columns[0];
  const op: FilterOp = opUsesOption(col, 'is') ? 'is' : 'contains';
  return { ...query, filters: [...query.filters, { id: uid(), columnId: col.id, op, value: '' }] };
}

export function SortPanel({ columns, query, onChange }: Omit<PanelProps, 'users'>) {
  const setRule = (id: string, patch: Partial<SortRule>) =>
    onChange({ ...query, sort: query.sort.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const unused = columns.find((c) => !query.sort.some((s) => s.columnId === c.id));

  return (
    <div className="panel">
      <div className="panel-title">Sort items</div>
      {!query.sort.length && <div className="muted small">No sorting applied.</div>}
      {query.sort.map((rule, i) => (
        <div className="panel-row sort" key={rule.id}>
          <span className="conj">{i === 0 ? 'Sort by' : 'Then by'}</span>
          <select className="input" value={rule.columnId} onChange={(e) => setRule(rule.id, { columnId: e.target.value })}>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={rule.dir}
            onChange={(e) => setRule(rule.id, { dir: e.target.value as SortRule['dir'] })}
          >
            <option value="asc">A → Z</option>
            <option value="desc">Z → A</option>
          </select>
          <button
            className="icon-btn"
            onClick={() => onChange({ ...query, sort: query.sort.filter((r) => r.id !== rule.id) })}
            aria-label="Remove sort"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="panel-actions">
        {unused && (
          <button
            className="link-btn"
            onClick={() => onChange({ ...query, sort: [...query.sort, { id: uid(), columnId: unused.id, dir: 'asc' }] })}
          >
            + Add sort
          </button>
        )}
        {query.sort.length > 0 && (
          <button className="link-btn" onClick={() => onChange({ ...query, sort: [] })}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
