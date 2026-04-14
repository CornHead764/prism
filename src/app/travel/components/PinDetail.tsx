'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Edit2, Trash2, X, Image as ImageIcon, MapPin, Star, TreePine, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TravelPin, PinType } from '../types';
import { STATUS_CONFIG, NPS_COLOR } from '../types';
import { PinForm } from './PinForm';
import type { PinPendingChildren } from './PinForm';

interface PinDetailProps {
  pin: TravelPin;
  childPins: TravelPin[];
  photoCount: number;
  onUpdate: (data: Partial<TravelPin>, pendingChildren?: PinPendingChildren) => Promise<void>;
  onDelete: () => void;
  onDeleteChild: (id: string) => void;
  onClose: () => void;
  onAddChild: (parentId: string, pinType: PinType) => void;
  onSelectChild: (child: TravelPin) => void;
}

export function PinDetail({ pin, childPins, photoCount, onUpdate, onDelete, onDeleteChild, onClose, onAddChild, onSelectChild }: PinDetailProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const config = STATUS_CONFIG[pin.status];
  const stops = childPins.filter((c) => c.pinType === 'stop');
  const parks = childPins.filter((c) => c.pinType === 'national_park');
  const isChildPin = !!pin.parentId;

  if (editing) {
    return (
      <PinForm
        pin={pin}
        pinType={pin.pinType}
        parentId={pin.parentId ?? undefined}
        childPins={childPins}
        onSave={async (data, pendingChildren) => {
          await onUpdate(data, pendingChildren); // throws on auth/error — form stays open
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {pin.pinType === 'national_park' && <TreePine className="h-4 w-4 shrink-0" style={{ color: NPS_COLOR }} />}
            {pin.pinType === 'stop' && <MapPin className="h-4 w-4 text-violet-500 shrink-0" />}
            <h3 className="font-semibold text-base leading-tight truncate">{pin.name}</h3>
            {pin.isBucketList && <Star className="h-4 w-4 fill-amber-500 text-amber-500 shrink-0" />}
          </div>
          {pin.tripLabel && <p className="text-sm text-muted-foreground mt-0.5">{pin.tripLabel}</p>}
          {!pin.tripLabel && pin.placeName && pin.placeName !== pin.name && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{pin.placeName}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {!isChildPin && (
              <Badge variant="outline" className="text-xs"
                style={{ borderColor: pin.color || config.color, color: pin.color || config.color }}>
                {config.label}
              </Badge>
            )}
            {pin.visitedDate && (
              <span className="text-xs text-muted-foreground">
                {pin.visitedEndDate
                  ? `${format(parseISO(pin.visitedDate), 'MMM d')} – ${format(parseISO(pin.visitedEndDate), 'MMM d, yyyy')}`
                  : format(parseISO(pin.visitedDate), 'MMMM yyyy')}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {/* ── Stops & Parks (root pins only, shown first) ── */}
        {!isChildPin && (
          <>
            {/* Stops */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-violet-500" />
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Stops{stops.length > 0 ? ` (${stops.length})` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onAddChild(pin.id, 'stop')}
                  className="flex items-center gap-0.5 text-xs text-primary hover:underline font-medium"
                >
                  <Plus className="h-3 w-3" />Add stop
                </button>
              </div>
              {stops.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {stops.map((s) => (
                    <div key={s.id} className="flex items-center gap-0 rounded-full border border-violet-300 dark:border-violet-700 overflow-hidden">
                      <button onClick={() => onSelectChild(s)}
                        className="flex items-center gap-1 pl-2.5 pr-2 py-1 text-violet-700 dark:text-violet-400 text-xs hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                      >
                        📍 {s.name}
                        {!s.latitude && !s.longitude && <span className="text-[10px] text-amber-500 ml-0.5">no location</span>}
                      </button>
                      <button onClick={() => onDeleteChild(s.id)}
                        className="pr-2 py-1 text-violet-400 hover:text-red-500 transition-colors"
                        title="Remove stop"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No stops yet — add cities or specific spots within this trip</p>
              )}
            </div>

            {/* National Parks */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TreePine className="h-3.5 w-3.5" style={{ color: NPS_COLOR }} />
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    National Parks{parks.length > 0 ? ` (${parks.length})` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onAddChild(pin.id, 'national_park')}
                  className="flex items-center gap-0.5 text-xs text-primary hover:underline font-medium"
                >
                  <Plus className="h-3 w-3" />Add park
                </button>
              </div>
              {parks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {parks.map((p) => (
                    <div key={p.id} className="flex items-center gap-0 rounded-full overflow-hidden" style={{ backgroundColor: NPS_COLOR }}>
                      <button onClick={() => onSelectChild(p)}
                        className="flex items-center gap-1 pl-2.5 pr-2 py-1 text-xs text-white hover:opacity-90 transition-opacity"
                      >
                        🌲 {p.name}
                        {!p.latitude && !p.longitude && <span className="text-[10px] text-emerald-200 ml-0.5">no location</span>}
                      </button>
                      <button onClick={() => onDeleteChild(p.id)}
                        className="pr-2 py-1 text-emerald-200 hover:text-white transition-colors"
                        title="Remove park"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No parks linked yet</p>
              )}
            </div>

            <div className="border-t border-border" />
          </>
        )}

        {/* Description */}
        {pin.description && <p className="text-sm text-muted-foreground">{pin.description}</p>}

        {/* Photos placeholder */}
        <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
          <ImageIcon className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/50" />
          {photoCount > 0 ? (
            <p className="text-sm font-medium">{photoCount} photo{photoCount !== 1 ? 's' : ''}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No photos linked</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">Photo linking via GPS coming in Phase 2</p>
        </div>

        {/* Tags */}
        {pin.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pin.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Coordinates */}
        {(pin.latitude !== 0 || pin.longitude !== 0) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-border flex gap-2 shrink-0">
        {confirmDelete ? (
          <>
            <span className="text-xs text-muted-foreground flex-1 flex items-center">
              {isChildPin ? 'Delete this stop?' : `Delete${childPins.length > 0 ? ` + ${childPins.length} sub-pin${childPins.length !== 1 ? 's' : ''}` : ''}?`}
            </span>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>No</Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(true)}>
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
