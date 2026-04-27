'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Moon, Monitor, Search, MapPin, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useTheme } from '@/components/providers';
import { useSeasonalTheme } from '@/lib/hooks/useSeasonalTheme';
import { MONTH_NAMES, seasonalPalettes } from '@/lib/themes/seasonalThemes';
import { useWallpaperSettings, useAutoOrientationSetting, useScreensaverInterval } from '@/components/layout/WallpaperBackground';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { useOrientationOverride } from '../SettingsView';
import { useScreensaverTimeout } from '@/lib/hooks/useScreensaverTimeout';
import { useAutoHideUI } from '@/lib/hooks/useAutoHideUI';
import { useAwayModeTimeout } from '@/lib/hooks/useAwayModeTimeout';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';

function getCurrentMonthNum(): number {
  return new Date().getMonth() + 1;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export function DisplaySection() {
  const { theme, setTheme } = useTheme();
  const { seasonalTheme, setSeasonalTheme, palette } = useSeasonalTheme();

  const mode: 'auto' | 'manual' | 'off' =
    seasonalTheme === 'none' ? 'off' :
    seasonalTheme === 'auto' ? 'auto' : 'manual';

  const setMode = (m: 'auto' | 'manual' | 'off') => {
    if (m === 'off') setSeasonalTheme('none');
    else if (m === 'auto') setSeasonalTheme('auto');
    else setSeasonalTheme(getCurrentMonthNum());
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Appearance</h2>
        <p className="text-muted-foreground">
          Customize how the dashboard looks and behaves
        </p>
      </div>

      <SectionDivider label="Theme" />

      <Card>
        <CardHeader>
          <CardTitle>Color Scheme</CardTitle>
          <CardDescription>
            Choose your preferred color scheme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant={theme === 'light' ? 'default' : 'outline'}
              onClick={() => setTheme('light')}
              className="flex-1"
            >
              <Sun className="h-4 w-4 mr-2" />
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'default' : 'outline'}
              onClick={() => setTheme('dark')}
              className="flex-1"
            >
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'default' : 'outline'}
              onClick={() => setTheme('system')}
              className="flex-1"
            >
              <Monitor className="h-4 w-4 mr-2" />
              System
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seasonal Theme</CardTitle>
          <CardDescription>
            Add seasonal color accents to the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {(['auto', 'manual', 'off'] as const).map((m) => (
              <Button
                key={m}
                variant={mode === m ? 'default' : 'outline'}
                onClick={() => setMode(m)}
                className="flex-1 capitalize"
              >
                {m === 'auto' ? 'Auto' : m === 'manual' ? 'Manual' : 'Off'}
              </Button>
            ))}
          </div>

          {palette && (
            <div className="flex items-center gap-3 p-3 rounded-md border border-border">
              <div className="flex gap-1.5">
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: `hsl(${palette.light.accent})` }}
                  title="Accent"
                />
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: `hsl(${palette.light.highlight})` }}
                  title="Highlight"
                />
                <div
                  className="w-6 h-6 rounded-full border border-border"
                  style={{ backgroundColor: `hsl(${palette.light.subtle})` }}
                  title="Subtle"
                />
              </div>
              <span className="text-sm font-medium">
                {palette.label} — {palette.name}
              </span>
            </div>
          )}

          {mode === 'manual' && (
            <div className="grid grid-cols-4 gap-2">
              {MONTH_NAMES.map((name, i) => {
                const month = i + 1;
                const p = seasonalPalettes[month]!;
                const selected = seasonalTheme === month;
                return (
                  <button
                    key={month}
                    onClick={() => setSeasonalTheme(month)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-colors',
                      selected
                        ? 'border-foreground bg-accent text-accent-foreground'
                        : 'border-border hover:bg-accent/50'
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `hsl(${p.light.accent})` }}
                    />
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Wallpaper & Display" />

      <PerformanceModeCard />

      <WallpaperSettingsCard />

      <OrientationCard />

      <SectionDivider label="Behavior" />

      <TimersCard />

      <LocationCard />
    </div>
  );
}

function TimersCard() {
  const { timeout: ssTimeout, setTimeout: setSsTimeout } = useScreensaverTimeout();
  const { interval: photoInterval, setInterval: setPhotoInterval } = useScreensaverInterval();
  const { autoHideEnabled, setAutoHideEnabled } = useAutoHideUI();
  const { timeout: awayTimeout, setTimeout: setAwayTimeout } = useAwayModeTimeout();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timers &amp; Auto-Activation</CardTitle>
        <CardDescription>
          Configure screensaver, auto-hide, and away mode inactivity timers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Screensaver */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Screensaver</h4>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Activate after</span>
            <select
              value={ssTimeout}
              onChange={(e) => setSsTimeout(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={0}>Never</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Rotate photos every</span>
            <select
              value={photoInterval}
              onChange={(e) => setPhotoInterval(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={3600}>1 hour</option>
              <option value={0}>Never (static)</option>
            </select>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Auto-Hide Navigation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Auto-Hide Navigation</h4>
              <p className="text-xs text-muted-foreground">Hide nav and toolbar after 10s of inactivity</p>
            </div>
            <Switch
              checked={autoHideEnabled}
              onCheckedChange={(checked) => {
                setAutoHideEnabled(checked);
                window.dispatchEvent(new Event('prism:auto-hide-change'));
              }}
            />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Away Mode */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Away Mode Auto-Activation</h4>
          <div className="flex items-center gap-3 pl-2">
            <span className="text-sm text-muted-foreground">Activate after</span>
            <select
              value={awayTimeout}
              onChange={(e) => setAwayTimeout(Number(e.target.value))}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              <option value={0}>Never (manual only)</option>
              <option value={4}>4 hours</option>
              <option value={8}>8 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>1 day</option>
              <option value={48}>2 days</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
            <span className="text-sm text-muted-foreground">of no interaction</span>
          </div>
          <p className="text-xs text-muted-foreground pl-2">
            After the specified idle time, Away Mode activates automatically for privacy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceModeCard() {
  const { enabled, setEnabled } = usePerformanceMode();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Mode</CardTitle>
        <CardDescription>
          A lighter preset for low-end hardware (thin clients, older mini PCs)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-medium">Enable performance mode</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Disables backdrop blur, stretches polling intervals, and shows a single static photo instead of a slideshow. Auto-enabled on devices reporting ≤2 GB RAM or ≤4 CPU cores; you can override it here at any time.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function WallpaperSettingsCard() {
  const { enabled, setEnabled, interval, setInterval } = useWallpaperSettings();
  const { enabled: autoOrientation, setEnabled: setAutoOrientation } = useAutoOrientationSetting();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Background Wallpaper</CardTitle>
        <CardDescription>
          Show a rotating photo behind the dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Enable wallpaper</span>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        {enabled && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Rotate every</span>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="border border-border rounded px-2 py-1 text-sm bg-background"
              >
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={3600}>1 hour</option>
                <option value={0}>Never (static)</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Auto-match photos to screen orientation</span>
                <p className="text-xs text-muted-foreground">
                  Only show landscape photos on landscape screens and portrait on portrait screens
                </p>
              </div>
              <Switch
                checked={autoOrientation}
                onCheckedChange={setAutoOrientation}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OrientationCard() {
  const detectedOrientation = useScreenOrientation();
  const { override: orientationOverride, setOverride: setOrientationOverride } = useOrientationOverride();
  const effectiveOrientation = orientationOverride === 'auto' ? detectedOrientation : orientationOverride;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Screen Orientation</CardTitle>
        <CardDescription>
          Detected orientation is used for photo filtering and wallpaper matching
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Current:</span>
          <span className="text-sm font-medium capitalize">{effectiveOrientation}</span>
          {orientationOverride === 'auto' && (
            <span className="text-xs text-muted-foreground">(detected)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Override:</span>
          {(['auto', 'landscape', 'portrait'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setOrientationOverride(opt)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md border transition-colors capitalize',
                orientationOverride === opt
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent/50'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface LocationValue {
  lat?: number;
  lon?: number;
  displayName?: string;
  // legacy fields kept for reading existing installs
  zipCode?: string;
  city?: string;
  state?: string;
}

function legacyDisplayName(loc: LocationValue): string {
  if (loc.zipCode) return loc.zipCode;
  return [loc.city, loc.state].filter(Boolean).join(', ');
}

function LocationCard() {
  const [query, setQuery] = useState('');
  const [savedName, setSavedName] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<{ displayName: string; lat: number; lon: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load current saved location on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const loc = data?.settings?.location as LocationValue | undefined;
        if (loc?.displayName) setSavedName(loc.displayName);
        else if (loc) setSavedName(legacyDisplayName(loc) || null);
      })
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setCandidates([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setCandidates(data.results ?? []);
        setOpen((data.results ?? []).length > 0);
      } catch { /* ignore */ }
      setSearching(false);
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const select = useCallback(async (candidate: { displayName: string; lat: number; lon: number }) => {
    setOpen(false);
    setQuery('');
    setSavedName(candidate.displayName);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'location', value: { lat: candidate.lat, lon: candidate.lon, displayName: candidate.displayName } }),
      });
    } catch { /* ignore */ }
    setSaving(false);
  }, []);

  const clear = useCallback(async () => {
    setSavedName(null);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'location', value: null }),
      });
    } catch { /* ignore */ }
    setSaving(false);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location</CardTitle>
        <CardDescription>
          Set your location for weather data. Search by city name or postal code — works worldwide.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {savedName && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{savedName}</span>
            <button onClick={clear} disabled={saving} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div ref={wrapperRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            {searching
              ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              : null}
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => candidates.length > 0 && setOpen(true)}
              placeholder={savedName ? 'Search to change location…' : 'Search city or postal code…'}
              className="pl-9"
              autoComplete="off"
            />
          </div>

          {open && candidates.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
              {candidates.map((c, i) => (
                <button
                  key={i}
                  onMouseDown={e => { e.preventDefault(); select(c); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {c.displayName}
                </button>
              ))}
            </div>
          )}
        </div>

        {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      </CardContent>
    </Card>
  );
}
