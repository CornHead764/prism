'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import {
  DndContext,
  useDraggable,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import { WidgetBgOverrideProvider } from '@/components/widgets/WidgetContainer';
import { getWidgetStyle, getTextColorClass } from './gridWidgetStyles';
import type { EditorTheme } from './gridEditorTypes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'se' | 'sw';

export interface CssGridEditorProps {
  layout: WidgetConfig[];
  onLayoutChange: (layout: WidgetConfig[]) => void;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  widgetConstraints?: Record<string, { minW?: number; minH?: number }>;
  cellSize: number;
  margin: number;
  containerPadding: number;
  cols: number;
  totalRows: number;
  totalCols: number;
  selectedWidget: string | null;
  onSelectWidget: (id: string | null) => void;
  theme: EditorTheme;
}

export function CssGridEditor({
  layout,
  onLayoutChange,
  renderWidget,
  widgetConstraints,
  cellSize,
  margin,
  containerPadding,
  cols,
  totalRows,
  totalCols,
  selectedWidget,
  onSelectWidget,
  theme,
}: CssGridEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    widgetId: string;
    x: number; y: number; w: number; h: number;
  } | null>(null);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const step = cellSize + margin;

  // Custom grid snap modifier — snaps drag overlay to grid cells
  const stepRef = useRef(step);
  stepRef.current = step;
  const gridSnapModifier: Modifier = useCallback(({ transform }) => ({
    ...transform,
    x: Math.round(transform.x / stepRef.current) * stepRef.current,
    y: Math.round(transform.y / stepRef.current) * stepRef.current,
  }), []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const visibleWidgets = useMemo(
    () => layout.filter(w => w.visible !== false),
    [layout],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveId(null);

    const deltaCol = Math.round(delta.x / step);
    const deltaRow = Math.round(delta.y / step);
    if (deltaCol === 0 && deltaRow === 0) return;

    const widgetId = active.id as string;
    const updated = layoutRef.current.map(w => {
      if (w.i === widgetId) {
        return { ...w, x: Math.max(0, w.x + deltaCol), y: Math.max(0, w.y + deltaRow) };
      }
      return w;
    });
    onLayoutChange(updated);
  }, [step, onLayoutChange]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Resize via pointer events on handles
  const handleResizeStart = useCallback((widgetId: string, edge: ResizeEdge, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const widget = layoutRef.current.find(w => w.i === widgetId);
    if (!widget) return;

    const orig = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    const startX = e.clientX;
    const startY = e.clientY;
    const currentStep = stepRef.current;

    setResizePreview({ widgetId, ...orig });

    const onMove = (ev: PointerEvent) => {
      const dCol = Math.round((ev.clientX - startX) / currentStep);
      const dRow = Math.round((ev.clientY - startY) / currentStep);

      const constraints = widgetConstraints?.[widgetId];
      const minW = constraints?.minW ?? 1;
      const minH = constraints?.minH ?? 1;

      let { x, y, w, h } = orig;

      if (edge.includes('e')) w = Math.max(minW, orig.w + dCol);
      if (edge.includes('s')) h = Math.max(minH, orig.h + dRow);
      if (edge.includes('w')) {
        const newX = Math.max(0, orig.x + dCol);
        x = Math.min(newX, orig.x + orig.w - minW);
        w = orig.x + orig.w - x;
      }
      if (edge.includes('n')) {
        const newY = Math.max(0, orig.y + dRow);
        y = Math.min(newY, orig.y + orig.h - minH);
        h = orig.y + orig.h - y;
      }

      setResizePreview({ widgetId, x, y, w, h });
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);

      setResizePreview(prev => {
        if (!prev) return null;
        const updated = layoutRef.current.map(w => {
          if (w.i === widgetId) {
            return { ...w, x: prev.x, y: prev.y, w: prev.w, h: prev.h };
          }
          return w;
        });
        onLayoutChange(updated);
        return null;
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [widgetConstraints, onLayoutChange]);

  // Get widget position — may be overridden during resize
  const getWidgetPos = useCallback((w: WidgetConfig) => {
    if (resizePreview?.widgetId === w.i) {
      return { x: resizePreview.x, y: resizePreview.y, w: resizePreview.w, h: resizePreview.h };
    }
    return { x: w.x, y: w.y, w: w.w, h: w.h };
  }, [resizePreview]);

  const activeWidget = activeId ? visibleWidgets.find(w => w.i === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      modifiers={[gridSnapModifier]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${totalCols}, ${cellSize}px)`,
          gridAutoRows: `${cellSize}px`,
          gap: `${margin}px`,
          padding: `${containerPadding}px`,
          position: 'relative',
          zIndex: 10,
        }}
        onClick={() => onSelectWidget(null)}
      >
        {visibleWidgets.map(w => (
          <DraggableWidget
            key={w.i}
            widget={w}
            pos={getWidgetPos(w)}
            isSelected={selectedWidget === w.i}
            isDragging={activeId === w.i}
            onSelect={onSelectWidget}
            onResizeStart={handleResizeStart}
            renderWidget={renderWidget}
            theme={theme}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeWidget ? (
          <DragOverlayContent
            widget={activeWidget}
            cellSize={cellSize}
            margin={margin}
            renderWidget={renderWidget}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Drag overlay — follows pointer with grid snapping
function DragOverlayContent({
  widget,
  cellSize,
  margin,
  renderWidget,
}: {
  widget: WidgetConfig;
  cellSize: number;
  margin: number;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
}) {
  const widgetStyle = getWidgetStyle(widget);
  const textClass = getTextColorClass(widget);

  return (
    <div
      style={{
        width: widget.w * cellSize + (widget.w - 1) * margin,
        height: widget.h * cellSize + (widget.h - 1) * margin,
        ...widgetStyle,
        opacity: 0.85,
      }}
      className={`rounded-lg border-2 border-primary shadow-lg ${textClass}`}
    >
      <WidgetBgOverrideProvider value={{ hasCustomBg: !!widget.backgroundColor, textColor: widget.textColor, textOpacity: widget.textOpacity }}>
        <div className="h-full w-full overflow-hidden">
          {renderWidget(widget)}
        </div>
      </WidgetBgOverrideProvider>
    </div>
  );
}

// Individual draggable widget cell
interface DraggableWidgetProps {
  widget: WidgetConfig;
  pos: { x: number; y: number; w: number; h: number };
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (id: string | null) => void;
  onResizeStart: (widgetId: string, edge: ResizeEdge, e: React.PointerEvent) => void;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  theme: EditorTheme;
}

function DraggableWidget({
  widget,
  pos,
  isSelected,
  isDragging,
  onSelect,
  onResizeStart,
  renderWidget,
  theme,
}: DraggableWidgetProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: widget.i });

  const widgetStyle = getWidgetStyle(widget);
  const textClass = getTextColorClass(widget, '');
  const hasCustomBg = !!widget.backgroundColor;

  return (
    <div
      ref={setNodeRef}
      className={`relative cursor-grab active:cursor-grabbing touch-manipulation ${
        isSelected ? 'ring-2 ring-primary ring-offset-2 z-[100]' : ''
      } ${isDragging ? 'opacity-30' : ''}`}
      style={{
        gridColumn: `${pos.x + 1} / span ${pos.w}`,
        gridRow: `${pos.y + 1} / span ${pos.h}`,
        ...widgetStyle,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(widget.i); }}
      {...listeners}
      {...attributes}
    >
      {/* Dashed border overlay */}
      <div className={`absolute inset-0 z-10 border-2 border-dashed ${isSelected ? 'border-primary' : theme.borderDash} rounded-lg pointer-events-none`} />

      {/* Widget content */}
      <WidgetBgOverrideProvider value={{ hasCustomBg, textColor: widget.textColor, textOpacity: widget.textOpacity }}>
        <div className={`h-full w-full overflow-hidden ${textClass}`}>
          {renderWidget(widget)}
        </div>
      </WidgetBgOverrideProvider>

      {/* Resize handles — visible when selected */}
      {isSelected && (
        <ResizeHandles widgetId={widget.i} onResizeStart={onResizeStart} />
      )}
    </div>
  );
}

// Resize handle hit areas + visual indicators
const EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'se', 'sw'];
const HIT = 16; // hit area size (px)

const EDGE_HIT_STYLES: Record<ResizeEdge, React.CSSProperties> = {
  n:  { top: -HIT / 2, left: HIT, right: HIT, height: HIT, cursor: 'ns-resize' },
  s:  { bottom: -HIT / 2, left: HIT, right: HIT, height: HIT, cursor: 'ns-resize' },
  e:  { right: -HIT / 2, top: HIT, bottom: HIT, width: HIT, cursor: 'ew-resize' },
  w:  { left: -HIT / 2, top: HIT, bottom: HIT, width: HIT, cursor: 'ew-resize' },
  ne: { top: -HIT / 2, right: -HIT / 2, width: HIT * 2, height: HIT * 2, cursor: 'nesw-resize' },
  se: { bottom: -HIT / 2, right: -HIT / 2, width: HIT * 2, height: HIT * 2, cursor: 'nwse-resize' },
  sw: { bottom: -HIT / 2, left: -HIT / 2, width: HIT * 2, height: HIT * 2, cursor: 'nesw-resize' },
};

function ResizeHandles({ widgetId, onResizeStart }: {
  widgetId: string;
  onResizeStart: (widgetId: string, edge: ResizeEdge, e: React.PointerEvent) => void;
}) {
  return (
    <>
      {EDGES.map(edge => (
        <div
          key={edge}
          className="absolute z-20"
          style={{ ...EDGE_HIT_STYLES[edge], touchAction: 'none' }}
          onPointerDown={(e) => onResizeStart(widgetId, edge, e)}
        >
          {/* Visual dot for corners */}
          {edge.length === 2 && (
            <div
              className="absolute bg-primary rounded-full"
              style={{
                width: 8,
                height: 8,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
          {/* Visual bar for edges */}
          {edge.length === 1 && (
            <div
              className="absolute bg-primary/60 rounded-full"
              style={{
                ...(edge === 'n' || edge === 's'
                  ? { width: 24, height: 4, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
                  : { width: 4, height: 24, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }),
              }}
            />
          )}
        </div>
      ))}
    </>
  );
}
