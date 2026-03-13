'use client';

import { useRef, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CalendarNote } from '@/lib/hooks/useCalendarNotes';

interface CalendarNotesColumnProps {
  days: Date[];
  notesByDate: Map<string, CalendarNote>;
  onNoteChange?: (date: string, content: string) => void;
}

export function CalendarNotesColumn({
  days,
  notesByDate,
  onNoteChange,
}: CalendarNotesColumnProps) {
  return (
    <div className="h-full overflow-auto">
      {days.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const note = notesByDate.get(dateKey);
        return (
          <NoteDayRow
            key={dateKey}
            dateKey={dateKey}
            day={day}
            content={note?.content || ''}
            onNoteChange={onNoteChange}
          />
        );
      })}
    </div>
  );
}

function NoteDayRow({
  dateKey,
  day,
  content,
  onNoteChange,
}: {
  dateKey: string;
  day: Date;
  content: string;
  onNoteChange?: (date: string, content: string) => void;
}) {
  const editable = !!onNoteChange;
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(content);

  // Sync content from server only when it actually changes externally
  useEffect(() => {
    if (editorRef.current && content !== lastSavedRef.current) {
      // Only update DOM if the editor isn't focused (avoid overwriting active edits)
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = content;
        lastSavedRef.current = content;
      }
    }
  }, [content]);

  // Set initial content
  useEffect(() => {
    if (editorRef.current && content) {
      editorRef.current.innerHTML = content;
      lastSavedRef.current = content;
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    // Normalize: treat <br> only or empty as empty
    const isEmpty = !html || html === '<br>' || html.replace(/<br\s*\/?>/g, '').trim() === '';
    const value = isEmpty ? '' : html;
    if (value !== lastSavedRef.current) {
      lastSavedRef.current = value;
      onNoteChange?.(dateKey, value);
    }
  }, [dateKey, onNoteChange]);

  const handleInput = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(save, 2000);
  }, [save]);

  const handleBlur = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    save();
  }, [save]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      document.execCommand('strikeThrough');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      document.execCommand('insertUnorderedList');
    }
  }, []);

  const handleBeforeInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const inputEvent = e.nativeEvent as InputEvent;
    if (inputEvent.inputType !== 'insertText' || inputEvent.data !== ' ') return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE && range.startOffset === 1 && node.textContent === '-') {
      e.preventDefault();
      node.textContent = '';
      document.execCommand('insertUnorderedList');
    }
  }, []);

  return (
    <div className="border-b border-border/50">
      {/* Day header */}
      <div className="px-3 pt-2 pb-1">
        <span className="text-xs font-medium text-muted-foreground">
          {format(day, 'EEE, MMM d')}
        </span>
      </div>
      {/* Editable content area */}
      <div
        ref={editorRef}
        contentEditable={editable}
        suppressContentEditableWarning
        onInput={editable ? handleInput : undefined}
        onBlur={editable ? handleBlur : undefined}
        onKeyDown={editable ? handleKeyDown : undefined}
        onBeforeInput={editable ? handleBeforeInput : undefined}
        className={cn(
          'px-3 pb-3 min-h-[48px] text-sm outline-none',
          editable && 'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 empty:before:pointer-events-none',
        )}
        data-placeholder={editable ? 'Add notes...' : undefined}
      />
    </div>
  );
}
