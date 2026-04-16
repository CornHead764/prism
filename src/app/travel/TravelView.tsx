'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Globe, List, Loader2, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { useTravelData, TravelAuthError } from './useTravelData';
import { useToast } from '@/components/ui/use-toast';
import { PinList } from './components/PinList';
import { PinDetail } from './components/PinDetail';
import { PinForm } from './components/PinForm';
import type { PinPendingChildren } from './components/PinForm';
import type { TravelPin, PinType } from './types';

// MapLibre must be client-only
const TravelGlobe = dynamic(
  () => import('./components/TravelGlobe').then((m) => m.TravelGlobe),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-muted/20 rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

type ActiveTab = 'globe' | 'places';
type Overlay =
  | { mode: 'none' }
  | { mode: 'detail'; pin: TravelPin }
  | { mode: 'add'; latLng?: { lat: number; lng: number }; parentId?: string; pinType?: PinType };

export function TravelView() {
  const { pins, loading, addPin, updatePin, deletePin } = useTravelData();
  const { toast } = useToast();

  const handleMutationError = useCallback((err: unknown) => {
    if (err instanceof TravelAuthError) {
      toast({ title: 'Log in to make changes', description: 'Enter your PIN to add, edit, or delete places.', variant: 'destructive' });
    } else {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
    }
  }, [toast]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('globe');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({ mode: 'none' });
  const [showAllChildren, setShowAllChildren] = useState(false);
  const [globeDarkMode, setGlobeDarkMode] = useState(false);

  // Photo counts — Phase 2
  const photoCounts: Record<string, number> = {};

  const handlePinClick = useCallback((pin: TravelPin) => {
    setSelectedPinId(pin.id);
    setOverlay({ mode: 'detail', pin });
  }, []);

  const handleListSelectPin = useCallback((pin: TravelPin) => {
    setSelectedPinId(pin.id);
    setOverlay({ mode: 'detail', pin });
    setActiveTab('globe');
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setOverlay((prev) => {
      // If already in add mode, update the drop point so the form reflects the new location
      if (prev.mode === 'add') return { ...prev, latLng: { lat, lng } };
      return { mode: 'add', latLng: { lat, lng } };
    });
    setSelectedPinId(null);
  }, []);

  const handleAddFromList = useCallback(() => {
    setOverlay({ mode: 'add' });
    setSelectedPinId(null);
    setActiveTab('globe');
  }, []);

  // Add a child pin (stop or park) directly without opening a separate form
  const handleAddChildDirect = useCallback(async (
    parentId: string, name: string, lat: number, lng: number, placeName: string | null, pinType: PinType
  ) => {
    const siblings = pins.filter((p) => p.parentId === parentId && p.pinType === pinType);
    const sortOrder = siblings.length;
    try {
      await addPin({
        name, latitude: lat, longitude: lng, placeName,
        pinType, parentId,
        status: 'want_to_go', isBucketList: false, tags: [], stops: [], nationalParks: [],
        sortOrder, photoRadiusKm: 50,
      } as Omit<TravelPin, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>);
    } catch (err) {
      handleMutationError(err);
      throw err;
    }
  }, [addPin, pins, handleMutationError]);

  const handleSaveNew = useCallback(async (data: Partial<TravelPin>, pendingChildren?: PinPendingChildren) => {
    let newPin: TravelPin;
    try {
      newPin = await addPin(data as Omit<TravelPin, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>);
    } catch (err) {
      handleMutationError(err);
      throw err; // re-throw so PinForm stays open
    }

    // If it's a child pin, return to parent detail
    if (newPin.parentId) {
      const parent = pins.find((p) => p.id === newPin.parentId);
      if (parent) {
        setOverlay({ mode: 'detail', pin: parent });
        setSelectedPinId(parent.id);
        return;
      }
    }

    // Create any pending child stops/parks
    const base = { status: 'want_to_go' as const, isBucketList: false, tags: [], stops: [], nationalParks: [], sortOrder: 0, photoRadiusKm: 50 };
    for (const stop of pendingChildren?.stops ?? []) {
      await addPin({ ...base, name: stop.name, latitude: stop.latitude, longitude: stop.longitude, placeName: stop.placeName ?? null, pinType: 'stop', parentId: newPin.id });
    }
    for (const park of pendingChildren?.parks ?? []) {
      await addPin({ ...base, name: park.name, latitude: park.latitude, longitude: park.longitude, placeName: park.placeName ?? null, pinType: 'national_park', parentId: newPin.id });
    }

    setSelectedPinId(newPin.id);
    setOverlay({ mode: 'detail', pin: newPin });
  }, [addPin, pins]);

  const handleUpdate = useCallback(async (id: string, data: Partial<TravelPin>, pendingChildren?: PinPendingChildren) => {
    let updated: TravelPin;
    try {
      updated = await updatePin(id, data);
    } catch (err) {
      handleMutationError(err);
      throw err;
    }
    // Create any new pending child stops/parks added during edit
    const base = { status: 'want_to_go' as const, isBucketList: false, tags: [], stops: [], nationalParks: [], sortOrder: 0, photoRadiusKm: 50 };
    for (const stop of pendingChildren?.stops ?? []) {
      await addPin({ ...base, name: stop.name, latitude: stop.latitude, longitude: stop.longitude, placeName: stop.placeName ?? null, pinType: 'stop', parentId: id });
    }
    for (const park of pendingChildren?.parks ?? []) {
      await addPin({ ...base, name: park.name, latitude: park.latitude, longitude: park.longitude, placeName: park.placeName ?? null, pinType: 'national_park', parentId: id });
    }
    // Set overlay after children are created so they appear immediately in the detail panel
    setOverlay({ mode: 'detail', pin: updated });
    setSelectedPinId(id);
  }, [updatePin, addPin]);

  const handleDelete = useCallback(async (id: string) => {
    const pin = pins.find((p) => p.id === id);
    const parentId = pin?.parentId;
    try {
      await deletePin(id);
    } catch (err) {
      handleMutationError(err);
      return;
    }
    setSelectedPinId(null);

    if (parentId) {
      const parent = pins.find((p) => p.id === parentId);
      if (parent) {
        setOverlay({ mode: 'detail', pin: parent });
        setSelectedPinId(parentId);
        return;
      }
    }
    setOverlay({ mode: 'none' });
  }, [deletePin, pins]);

  const handleDeleteChild = useCallback(async (childId: string) => {
    try {
      await deletePin(childId);
    } catch (err) {
      handleMutationError(err);
    }
  }, [deletePin, handleMutationError]);

  const handleReorderChildren = useCallback(async (childIds: string[]) => {
    await Promise.all(childIds.map((id, idx) => updatePin(id, { sortOrder: idx })));
  }, [updatePin]);

  const closeOverlay = useCallback(() => {
    setOverlay({ mode: 'none' });
    setSelectedPinId(null);
  }, []);

  // Keep detail overlay fresh when pins update
  useEffect(() => {
    if (overlay.mode === 'detail') {
      const fresh = pins.find((p) => p.id === overlay.pin.id);
      if (fresh) setOverlay({ mode: 'detail', pin: fresh });
    }
  }, [pins]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine which child pins to show on the globe:
  // - always show children of the currently selected pin
  // - if showAllChildren, show ALL child pins
  const visibleChildParentIds = new Set<string>();
  if (showAllChildren) {
    pins.forEach((p) => { if (p.parentId) visibleChildParentIds.add(p.parentId); });
  } else if (selectedPinId) {
    visibleChildParentIds.add(selectedPinId);
  }

  const visiblePins = pins.filter(
    (p) => !p.parentId || visibleChildParentIds.has(p.parentId)
  );

  // Root pins (no parent) for the Places list
  const rootPins = pins.filter((p) => !p.parentId);

  // Set of root pin IDs that have at least one national park child (or legacy nationalParks array)
  const pinsWithNpIds = useMemo(() => {
    const s = new Set<string>();
    pins.forEach((p) => {
      if (p.pinType === 'national_park' && p.parentId) s.add(p.parentId);
    });
    rootPins.forEach((p) => {
      if (p.nationalParks && p.nationalParks.length > 0) s.add(p.id);
    });
    return s;
  }, [pins, rootPins]);

  return (
    <PageWrapper>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border shrink-0 bg-background">
          <button
            onClick={() => setActiveTab('globe')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === 'globe'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Globe className="h-4 w-4" />
            Globe
          </button>
          <button
            onClick={() => setActiveTab('places')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === 'places'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-4 w-4" />
            Places
            {rootPins.length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
                {rootPins.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 relative overflow-hidden">
          {/* Globe tab */}
          <div className={cn('absolute inset-0 flex', activeTab !== 'globe' && 'invisible pointer-events-none')}>
            <div className="flex-1 p-4 flex relative">
              <TravelGlobe
                pins={visiblePins}
                selectedPinId={selectedPinId}
                darkMode={globeDarkMode}
                onPinClick={handlePinClick}
                onMapClick={handleMapClick}
              />
              {/* Globe controls — overlaid on globe */}
              <div className="absolute top-7 left-7 z-10 flex items-center gap-1.5">
                <button
                  onClick={() => setShowAllChildren((v) => !v)}
                  title={showAllChildren ? 'Hide all sub-locations' : 'Show all sub-locations on map'}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shadow transition-colors',
                    showAllChildren
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background/90 text-foreground border border-border hover:bg-muted'
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Sub-locations
                </button>
                <button
                  onClick={() => setGlobeDarkMode((v) => !v)}
                  title={globeDarkMode ? 'Switch to light map' : 'Switch to dark map'}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shadow transition-colors bg-background/90 text-foreground border border-border hover:bg-muted"
                >
                  {globeDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Overlay panel */}
            <div className={cn(
              'absolute top-4 right-4 bottom-4 w-96 bg-card border border-border rounded-lg shadow-xl flex flex-col transition-transform duration-200',
              overlay.mode === 'none' ? 'translate-x-[calc(100%+2rem)]' : 'translate-x-0'
            )}>
              {overlay.mode === 'add' ? (
                <PinForm
                  initialLatLng={overlay.latLng}
                  parentId={overlay.parentId}
                  pinType={overlay.pinType ?? 'location'}
                  onSave={handleSaveNew}
                  onCancel={() => {
                    // If adding a child, go back to parent detail
                    if (overlay.parentId) {
                      const parent = pins.find((p) => p.id === overlay.parentId);
                      if (parent) {
                        setOverlay({ mode: 'detail', pin: parent });
                        setSelectedPinId(parent.id);
                        return;
                      }
                    }
                    closeOverlay();
                  }}
                />
              ) : overlay.mode === 'detail' ? (
                <PinDetail
                  pin={overlay.pin}
                  childPins={pins.filter((p) => p.parentId === overlay.pin.id)}
                  onUpdate={(data, pendingChildren) => handleUpdate(overlay.pin.id, data, pendingChildren)}
                  onDelete={() => handleDelete(overlay.pin.id)}
                  onDeleteChild={handleDeleteChild}
                  onClose={closeOverlay}
                  onAddChildDirect={(name, lat, lng, placeName, pinType) =>
                    handleAddChildDirect(overlay.pin.id, name, lat, lng, placeName, pinType)
                  }
                  onReorderChildren={(childIds) => handleReorderChildren(childIds)}
                  onSelectChild={(child) => {
                    setSelectedPinId(child.id);
                    setOverlay({ mode: 'detail', pin: child });
                  }}
                />
              ) : null}
            </div>
          </div>

          {/* Places tab */}
          <div className={cn('absolute inset-0 overflow-y-auto', activeTab !== 'places' && 'invisible pointer-events-none')}>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <PinList
                pins={rootPins}
                pinsWithNpIds={pinsWithNpIds}
                selectedPinId={selectedPinId}
                photoCounts={photoCounts}
                onSelectPin={handleListSelectPin}
                onAddPin={handleAddFromList}
              />
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
