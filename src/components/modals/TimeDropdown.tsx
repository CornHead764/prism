'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export function formatTime12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  if (isNaN(h) || isNaN(m)) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s/g, '');
  const isPM = s.includes('pm');
  const isAM = s.includes('am');
  const digits = s.replace(/[apm]/g, '');
  let h = -1, m = 0;

  if (digits.includes(':')) {
    const [hp, mp] = digits.split(':');
    h = parseInt(hp ?? '', 10);
    m = parseInt(mp ?? '0', 10);
  } else if (digits.length <= 2) {
    h = parseInt(digits, 10); m = 0;
  } else if (digits.length === 3) {
    h = parseInt(digits[0] ?? '', 10);
    m = parseInt(digits.slice(1), 10);
  } else if (digits.length === 4) {
    h = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2), 10);
  }

  if (h < 0 || h > 23 || m < 0 || m > 59 || isNaN(h) || isNaN(m)) return null;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

interface TimeDropdownProps {
  value: string; // HH:MM 24-hr
  onChange: (v: string) => void;
  minTime?: string; // slots before this are dimmed (same-day end picker)
  disabled?: boolean;
  className?: string;
}

export function TimeDropdown({ value, onChange, minTime, disabled, className }: TimeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    setDraft('');
    inputRef.current?.focus();
    const idx = TIME_SLOTS.indexOf(value);
    if (idx >= 0) {
      const el = listRef.current.children[idx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'center' });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function select(slot: string) {
    onChange(slot);
    setOpen(false);
  }

  function commitDraft() {
    if (!draft) return;
    const parsed = parseTimeInput(draft);
    if (parsed) onChange(parsed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { commitDraft(); setOpen(false); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={wrapRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="h-8 px-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {value ? formatTime12(value) : 'Time'}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-44 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitDraft}
              placeholder="e.g. 2:30 PM"
              className="w-full text-xs px-2 py-1.5 rounded-md bg-muted/50 placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <ul ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {TIME_SLOTS.map((slot) => (
              <li key={slot}>
                <button
                  type="button"
                  onClick={() => select(slot)}
                  className={cn(
                    'w-full text-left px-3 py-1 text-sm hover:bg-muted transition-colors',
                    slot === value && 'bg-primary text-primary-foreground hover:bg-primary/90 font-medium',
                    minTime && slot < minTime && slot !== value && 'text-muted-foreground/50'
                  )}
                >
                  {formatTime12(slot)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
