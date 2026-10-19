import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

/** Inline text input that commits on blur / Enter and reverts on Escape. */
export function TextCell({ value, onChange, placeholder, className = '' }: Props) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  // Commit with the handler from when editing began: by blur time a click elsewhere may already
  // have changed the multi-cell selection that handler applies the edit to.
  const commitTo = useRef(onChange);

  const commit = () => {
    if (text !== value) commitTo.current(text);
  };

  return (
    <input
      className={`cell-input ${className}`}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => (commitTo.current = onChange)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(value);
          // Let the reverted value render before blurring so it isn't committed.
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}
