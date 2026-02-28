'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { useFamily } from '@/components/providers';
import { SettingsView } from './SettingsView';

type GateState = 'checking' | 'prompt' | 'verified';

export function SettingsPinGate() {
  const router = useRouter();
  const [state, setState] = useState<GateState>('checking');

  // Check if already verified (within 10-minute window)
  useEffect(() => {
    fetch('/api/auth/settings-verified')
      .then((res) => res.json())
      .then((data) => {
        setState(data.verified ? 'verified' : 'prompt');
      })
      .catch(() => setState('prompt'));
  }, []);

  const handleVerified = useCallback(() => {
    setState('verified');
  }, []);

  const handleDismiss = useCallback(() => {
    router.push('/');
  }, [router]);

  if (state === 'checking') {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (state === 'verified') {
    return <SettingsView />;
  }

  return <SettingsPinPrompt onVerified={handleVerified} onDismiss={handleDismiss} />;
}

function SettingsPinPrompt({
  onVerified,
  onDismiss,
}: {
  onVerified: () => void;
  onDismiss: () => void;
}) {
  const { members, loading } = useFamily();
  const parents = members
    .filter((m) => m.role === 'parent')
    .map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      avatarUrl: m.avatarUrl ?? undefined,
    }));

  const [selectedParent, setSelectedParent] = useState<(typeof parents)[0] | null>(null);
  const [pin, setPin] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [mounted, setMounted] = useState(false);

  const pinLength = 4;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-select if only one parent
  useEffect(() => {
    if (parents.length === 1 && !selectedParent && parents[0]) {
      setSelectedParent(parents[0]);
    }
  }, [parents, selectedParent]);

  const handleKeyPress = useCallback((digit: string) => {
    if (isVerifying) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= pinLength) return prev;
      return [...prev, digit];
    });
  }, [isVerifying]);

  const handleBackspace = useCallback(() => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [isVerifying]);

  // Keyboard support
  useEffect(() => {
    if (!selectedParent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isVerifying) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedParent, isVerifying, handleKeyPress, handleBackspace, onDismiss]);

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length !== pinLength || !selectedParent) return;

    const verifyPin = async () => {
      setIsVerifying(true);
      const enteredPin = pin.join('');

      try {
        const response = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedParent.id,
            pin: enteredPin,
          }),
        });

        if (response.ok) {
          onVerified();
        } else {
          const data = await response.json();
          setError(data.error || 'Incorrect PIN');
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          setPin([]);
        }
      } catch {
        setError('Verification failed');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        setPin([]);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPin();
  }, [pin, selectedParent, onVerified]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001]"
      onClick={onDismiss}
    >
      <div
        className="bg-card rounded-2xl p-6 max-w-sm w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Parent PIN Required</h2>
          <Button variant="ghost" size="icon" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !selectedParent ? (
          // Parent selection
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Select a parent to continue
            </p>
            <div className="grid grid-cols-2 gap-3">
              {parents.map((parent) => (
                <button
                  key={parent.id}
                  onClick={() => setSelectedParent(parent)}
                  className={cn(
                    'flex flex-col items-center p-3 rounded-xl',
                    'hover:bg-accent/50 active:bg-accent transition-colors',
                    'touch-action-manipulation'
                  )}
                >
                  <UserAvatar
                    name={parent.name}
                    color={parent.color}
                    imageUrl={parent.avatarUrl}
                    size="lg"
                    className="h-14 w-14 mb-2"
                  />
                  <span className="text-sm font-medium">{parent.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // PIN entry
          <div className="text-center">
            {parents.length > 1 ? (
              <button
                onClick={() => {
                  setSelectedParent(null);
                  setPin([]);
                  setError(null);
                }}
                className="group flex flex-col items-center mx-auto mb-4"
              >
                <UserAvatar
                  name={selectedParent.name}
                  color={selectedParent.color}
                  imageUrl={selectedParent.avatarUrl}
                  size="lg"
                  className="h-16 w-16 mb-1 group-hover:ring-2 ring-primary transition-all"
                />
                <span className="font-medium">{selectedParent.name}</span>
                <span className="text-xs text-muted-foreground">Tap to switch</span>
              </button>
            ) : (
              <div className="flex flex-col items-center mx-auto mb-4">
                <UserAvatar
                  name={selectedParent.name}
                  color={selectedParent.color}
                  imageUrl={selectedParent.avatarUrl}
                  size="lg"
                  className="h-16 w-16 mb-1 ring-2 ring-primary"
                />
                <span className="font-medium">{selectedParent.name}</span>
                <span className="text-xs text-muted-foreground">Enter your PIN</span>
              </div>
            )}

            {/* PIN dots */}
            <div
              className={cn(
                'flex gap-3 justify-center mb-4',
                isShaking && 'animate-shake'
              )}
            >
              {Array.from({ length: pinLength }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-3 h-3 rounded-full transition-all duration-150',
                    i < pin.length
                      ? error
                        ? 'bg-destructive scale-110'
                        : 'bg-primary scale-110'
                      : 'bg-muted border-2 border-border'
                  )}
                />
              ))}
            </div>

            {/* Error/Status message */}
            <div className="h-6 mb-3 flex items-center justify-center">
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(
                (key, idx) => {
                  if (key === '') return <div key={idx} />;
                  if (key === 'del') {
                    return (
                      <button
                        key={idx}
                        onClick={handleBackspace}
                        disabled={isVerifying}
                        className={cn(
                          'w-16 h-16 rounded-full mx-auto',
                          'flex items-center justify-center',
                          'bg-muted hover:bg-muted/80',
                          'active:bg-accent active:scale-95',
                          'transition-all duration-100',
                          'text-muted-foreground text-sm',
                          isVerifying && 'opacity-50'
                        )}
                      >
                        Del
                      </button>
                    );
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleKeyPress(key)}
                      disabled={isVerifying}
                      className={cn(
                        'w-16 h-16 rounded-full mx-auto',
                        'flex items-center justify-center',
                        'bg-secondary hover:bg-secondary/80',
                        'active:bg-primary active:text-primary-foreground active:scale-95',
                        'transition-all duration-100',
                        'text-lg font-semibold',
                        isVerifying && 'opacity-50'
                      )}
                    >
                      {key}
                    </button>
                  );
                }
              )}
            </div>

            {/* Loading */}
            <div className="h-6 mt-3 flex items-center justify-center">
              {isVerifying && (
                <p className="text-sm text-muted-foreground">Verifying...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
