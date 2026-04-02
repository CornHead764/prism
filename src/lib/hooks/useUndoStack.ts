'use client';

import { useSyncExternalStore } from 'react';

interface UndoEntry {
  id: number;
  label: string;
  handler: () => void | Promise<void>;
  timestamp: number;
}

const UNDO_LIMIT = 3;
const UNDO_EXPIRY_MS = 30_000; // 30 seconds

let nextId = 0;
let stack: UndoEntry[] = [];
let listeners: (() => void)[] = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function cleanup() {
  const now = Date.now();
  const before = stack.length;
  stack = stack.filter(e => now - e.timestamp < UNDO_EXPIRY_MS);
  if (stack.length !== before) emitChange();
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanup, 5000);
}

function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

export function pushUndo(label: string, handler: () => void | Promise<void>) {
  stack = [{ id: nextId++, label, handler, timestamp: Date.now() }, ...stack].slice(0, UNDO_LIMIT);
  emitChange();
  startCleanup();
}

export async function popUndo(): Promise<boolean> {
  cleanup();
  if (stack.length === 0) return false;
  const [entry, ...rest] = stack;
  stack = rest;
  emitChange();
  if (stack.length === 0) stopCleanup();
  try {
    await entry!.handler();
    return true;
  } catch {
    return false;
  }
}

export function clearUndo() {
  stack = [];
  emitChange();
  stopCleanup();
}

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(l => l !== cb); };
}

function getSnapshot() {
  return stack;
}

export function useUndoStack() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    count: current.length,
    canUndo: current.length > 0,
    undo: popUndo,
    push: pushUndo,
    clear: clearUndo,
  };
}
