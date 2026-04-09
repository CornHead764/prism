'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Keyboard from 'simple-keyboard';
import 'simple-keyboard/build/css/index.css';
import { Mic, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalInput } from '@/lib/hooks/useGlobalInput';

const layout = {
  default: [
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    '{lock} a s d f g h j k l ; \' {enter}',
    '{shift} z x c v b n m , . / {shift}',
    '{space} {mic} {dismiss}',
  ],
  shift: [
    '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
    '{tab} Q W E R T Y U I O P { } |',
    '{lock} A S D F G H J K L : " {enter}',
    '{shift} Z X C V B N M < > ? {shift}',
    '{space} {mic} {dismiss}',
  ],
};

const display = {
  '{bksp}': '⌫',
  '{enter}': '↵',
  '{shift}': '⇧',
  '{lock}': '⇪',
  '{tab}': '⇥',
  '{space}': ' ',
  '{mic}': '🎤',
  '{dismiss}': '↓',
};

export function VirtualKeyboard() {
  const {
    keyboardVisible,
    setKeyboardVisible,
    injectText,
    activeInputRef,
    isMobile,
    isListening,
    startListening,
    stopListening,
  } = useGlobalInput();

  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<Keyboard | null>(null);
  const shiftRef = useRef<'default' | 'shift'>('default');

  useEffect(() => { setMounted(true); }, []);

  // Manage enter/exit animation
  useEffect(() => {
    if (keyboardVisible) {
      setIsExiting(false);
      setVisible(true);
    } else if (visible) {
      setIsExiting(true);
      const t = setTimeout(() => { setVisible(false); setIsExiting(false); }, 200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardVisible]);

  // Init/destroy simple-keyboard
  useEffect(() => {
    if (!visible || !containerRef.current) return;

    const kb = new Keyboard(containerRef.current, {
      onChange: (input) => injectText(input),
      onKeyPress: (button: string) => {
        if (button === '{shift}' || button === '{lock}') {
          const next = shiftRef.current === 'default' ? 'shift' : 'default';
          shiftRef.current = next;
          kb.setOptions({ layoutName: next });
        }
        if (button === '{dismiss}') {
          setKeyboardVisible(false);
          activeInputRef.current?.blur();
        }
        if (button === '{mic}') {
          if (isListening) { stopListening(); } else { startListening(); }
        }
      },
      layout,
      layoutName: 'default',
      display,
      physicalKeyboardHighlight: false,
      syncInstanceInputs: false,
      buttonTheme: [
        { class: 'key-action', buttons: '{bksp} {enter} {shift} {lock} {tab}' },
        { class: 'key-space', buttons: '{space}' },
        { class: 'key-mic', buttons: '{mic}' },
        { class: 'key-dismiss', buttons: '{dismiss}' },
      ],
    });

    keyboardRef.current = kb;
    // Sync initial value
    kb.setInput(activeInputRef.current?.value ?? '');

    return () => {
      kb.destroy();
      keyboardRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Sync keyboard value when active input changes
  useEffect(() => {
    if (keyboardRef.current) {
      keyboardRef.current.setInput(activeInputRef.current?.value ?? '');
    }
  });

  // Is this a password input? Hide mic button.
  const isPassword =
    activeInputRef.current instanceof HTMLInputElement &&
    activeInputRef.current.type === 'password';

  if (!mounted || isMobile || !visible) return null;

  return createPortal(
    <div
      data-virtual-keyboard
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[9000]',
        'bg-background border-t border-border shadow-2xl',
        isListening && 'is-listening',
        isExiting ? 'animate-keyboard-out' : 'animate-keyboard-in',
      )}
      style={{ height: '38vh', minHeight: 320, maxHeight: 480 }}
      onPointerDown={e => { e.stopPropagation(); e.preventDefault(); }}
    >
      <div
        ref={containerRef}
        className={cn('h-full', isPassword && '[&_.key-mic]:opacity-0 [&_.key-mic]:pointer-events-none')}
      />
    </div>,
    document.body,
  );
}
