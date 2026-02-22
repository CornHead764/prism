'use client';

import * as React from 'react';
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { ResponsiveGridLayout as RGL, useContainerWidth, getCompactor } from 'react-grid-layout';
import type { LayoutItem, Layout } from 'react-grid-layout';
import { isLightColor, hexToRgba } from '@/lib/utils/color';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { WidgetBgOverrideProvider } from '@/components/widgets/WidgetContainer';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const overlapCompactor = getCompactor(null, true);

const COLOR_PALETTE = [
  '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#FFFFFF', '#9CA3AF', '#6B7280', '#374151', '#000000',
];

// Fill options: None, Transparent (checkerboard), then colors
const FILL_OPTIONS: (string | null)[] = [null, 'transparent', ...COLOR_PALETTE];
// Outline/Text options: None/Auto, then colors
const COLOR_OPTIONS: (string | null)[] = [null, ...COLOR_PALETTE];

export interface EditorTheme {
  gridBg: string;
  gridStroke: string;
  gridOpacity: number;
  gridPatternId: string;
  borderDash: string;
}

const DASHBOARD_THEME: EditorTheme = {
  gridBg: '',
  gridStroke: 'currentColor',
  gridOpacity: 0.3,
  gridPatternId: 'grid-dash',
  borderDash: 'border-white/50 dark:border-white/40',
};

const SCREENSAVER_THEME: EditorTheme = {
  gridBg: 'bg-black/80',
  gridStroke: 'white',
  gridOpacity: 0.2,
  gridPatternId: 'grid-ss',
  borderDash: 'border-white/40',
};

export { DASHBOARD_THEME, SCREENSAVER_THEME };

export interface LayoutGridEditorProps {
  layout: WidgetConfig[];
  onLayoutChange: (layout: WidgetConfig[]) => void;
  isEditable?: boolean;
  renderWidget: (widget: WidgetConfig) => React.ReactNode;
  widgetConstraints?: Record<string, { minW?: number; minH?: number }>;
  margin?: number;
  headerOffset?: number;
  bottomOffset?: number;
  minVisibleRows?: number;
  theme?: EditorTheme;
  gridHelperText?: string;
  className?: string;
  screenGuideOrientation?: 'landscape' | 'portrait';
  enabledSizes?: string[];
  onScrollInfo?: (info: { scrollY: number; visibleRows: number; scrollX: number; visibleCols: number; totalRows: number; totalCols: number }) => void;
  scrollToRef?: React.MutableRefObject<((row: number, col?: number) => void) | null>;
}

export function LayoutGridEditor({
  layout,
  onLayoutChange,
  isEditable = false,
  renderWidget,
  widgetConstraints,
  margin: marginProp = 8,
  headerOffset = 140,
  bottomOffset = 0,
  minVisibleRows = 0,
  theme = DASHBOARD_THEME,
  gridHelperText,
  className,
  screenGuideOrientation: screenGuideOrientationProp,
  enabledSizes: enabledSizesProp,
  onScrollInfo,
  scrollToRef,
}: LayoutGridEditorProps) {
  const { zones: SAFE_ZONES, allSizeNames } = useScreenSafeZones();
  const { width, containerRef, mounted } = useContainerWidth();
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const tapStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [screenGuideOrientationInternal, setScreenGuideOrientationInternal] = useState<'landscape' | 'portrait'>('landscape');
  const [enabledSizesInternal, setEnabledSizesInternal] = useState<string[]>(allSizeNames);

  const screenGuideOrientation = screenGuideOrientationProp ?? screenGuideOrientationInternal;
  const enabledSizes = enabledSizesProp ?? enabledSizesInternal;

  const cols = 12;
  const containerPadding = 12;
  const margin = marginProp;

  const cellSize = useMemo(() => {
    if (!mounted || width <= 0) return 60;
    const availableWidth = width - 2 * containerPadding - (cols - 1) * margin;
    return Math.floor(availableWidth / cols);
  }, [mounted, width, margin]);

  const visibleRows = useMemo(() => {
    if (typeof window === 'undefined') return 24;
    const availableHeight = window.innerHeight - headerOffset - bottomOffset;
    return Math.max(minVisibleRows, Math.floor((availableHeight + margin) / (cellSize + margin)));
  }, [cellSize, margin, headerOffset, bottomOffset, minVisibleRows]);

  const visibleCols = useMemo(() => {
    if (width <= 0) return cols;
    return Math.floor((width - 2 * containerPadding + margin) / (cellSize + margin));
  }, [width, cellSize, margin]);

  const { totalRows, totalCols } = useMemo(() => {
    let maxY = visibleRows;
    let maxX = cols;
    layout.forEach(w => {
      if (w.visible !== false) {
        const bottom = w.y + w.h;
        const right = w.x + w.w;
        if (bottom > maxY) maxY = bottom;
        if (right > maxX) maxX = right;
      }
    });
    // Ensure grid extends to show all screen size guides
    const maxScreenRows = Math.max(...SAFE_ZONES[screenGuideOrientation].map(z => z.rows));
    return {
      totalRows: Math.max(maxY + 4, maxScreenRows + 4),
      totalCols: Math.max(maxX, cols),
    };
  }, [layout, visibleRows, cols, screenGuideOrientation, SAFE_ZONES]);

  const handleScrollTo = useCallback((targetRow: number, targetCol?: number) => {
    if (scrollContainerRef.current) {
      const scrollTop = targetRow * (cellSize + margin);
      const opts: ScrollToOptions = { top: scrollTop, behavior: 'smooth' };
      if (targetCol != null) {
        opts.left = targetCol * (cellSize + margin);
      }
      scrollContainerRef.current.scrollTo(opts);
    }
  }, [cellSize, margin]);

  // Expose scrollTo via ref
  useEffect(() => {
    if (scrollToRef) scrollToRef.current = handleScrollTo;
    return () => { if (scrollToRef) scrollToRef.current = null; };
  }, [scrollToRef, handleScrollTo]);

  // Report scroll info to parent
  useEffect(() => {
    onScrollInfo?.({ scrollY, visibleRows, scrollX, visibleCols, totalRows, totalCols });
  }, [scrollY, visibleRows, scrollX, visibleCols, totalRows, totalCols, onScrollInfo]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrolledRows = Math.floor(target.scrollTop / (cellSize + margin));
    const scrolledCols = Math.floor(target.scrollLeft / (cellSize + margin));
    setScrollY(scrolledRows);
    setScrollX(scrolledCols);
  }, [cellSize, margin]);

  const toggleSize = useCallback((size: string) => {
    setEnabledSizesInternal(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  }, []);

  const layoutRef = useRef(layout);
  const layoutJson = JSON.stringify(layout);
  const stableLayout = useMemo(() => {
    layoutRef.current = layout;
    return layout;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutJson]);

  const rglLayout: LayoutItem[] = useMemo(
    () =>
      stableLayout
        .filter(w => w.visible !== false)
        .map(w => {
          const constraints = widgetConstraints?.[w.i];
          return {
            i: w.i,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            minW: constraints?.minW ?? 1,
            minH: constraints?.minH ?? 1,
          };
        }),
    [stableLayout, widgetConstraints]
  );

  const visibleWidgets = useMemo(
    () => stableLayout.filter(w => w.visible !== false),
    [stableLayout]
  );

  const handleLayoutChange = useMemo(() => {
    return (newLayout: Layout) => {
      const current = layoutRef.current;
      const updated: WidgetConfig[] = current.map(w => {
        const found = newLayout.find((l: LayoutItem) => l.i === w.i);
        if (found) {
          return { ...w, x: found.x, y: found.y, w: found.w, h: found.h };
        }
        return w;
      });
      onLayoutChange(updated);
    };
  }, [onLayoutChange]);

  const updateWidgetColor = useCallback((widgetId: string, updates: { backgroundColor?: string | null; backgroundOpacity?: number; outlineColor?: string | null; textColor?: string | null }) => {
    const updated = layoutRef.current.map(w => {
      if (w.i === widgetId) {
        return {
          ...w,
          backgroundColor: updates.backgroundColor === null ? undefined : (updates.backgroundColor ?? w.backgroundColor),
          backgroundOpacity: updates.backgroundOpacity ?? w.backgroundOpacity,
          outlineColor: updates.outlineColor === null ? undefined : (updates.outlineColor ?? w.outlineColor),
          textColor: updates.textColor === null ? undefined : (updates.textColor ?? w.textColor),
        };
      }
      return w;
    });
    onLayoutChange(updated);
  }, [onLayoutChange]);

  const getWidgetStyle = (widget: WidgetConfig): React.CSSProperties | undefined => {
    if (!widget.backgroundColor && !widget.outlineColor) return undefined;
    const style: React.CSSProperties = { borderRadius: '0.5rem' };
    if (widget.backgroundColor && widget.backgroundColor !== 'transparent') {
      const opacity = widget.backgroundOpacity ?? 1;
      style.backgroundColor = opacity < 1
        ? hexToRgba(widget.backgroundColor, opacity)
        : widget.backgroundColor;
    }
    if (widget.outlineColor) {
      style.border = `2px solid ${widget.outlineColor}`;
    }
    return style;
  };

  const getTextClass = (widget: WidgetConfig, fallback: string) => {
    // textColor is applied via context → WidgetContainer inline style, not as a class
    if (widget.textColor) return '';
    if (!widget.backgroundColor || widget.backgroundColor === 'transparent' || widget.backgroundOpacity === 0) return fallback;
    return isLightColor(widget.backgroundColor) ? 'text-black' : 'text-white';
  };

  // Clear selection when widget becomes invisible
  useEffect(() => {
    if (selectedWidget && !layout.find(w => w.i === selectedWidget && w.visible !== false)) {
      setSelectedWidget(null);
    }
  }, [selectedWidget, layout]);

  const selectedWidgetConfig = selectedWidget
    ? layoutRef.current.find(w => w.i === selectedWidget && w.visible !== false)
    : null;

  const renderPropertiesBar = () => {
    if (!selectedWidgetConfig || !selectedWidget) return null;
    const bgColor = selectedWidgetConfig.backgroundColor;
    const olColor = selectedWidgetConfig.outlineColor;
    const txtColor = selectedWidgetConfig.textColor;
    const bgOpacity = selectedWidgetConfig.backgroundOpacity ?? 1;
    const displayName = selectedWidgetConfig.i.charAt(0).toUpperCase() + selectedWidgetConfig.i.slice(1);
    const hasColorFill = bgColor && bgColor !== 'transparent';

    return (
      <div className="bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <span className="text-sm font-medium">{displayName} Widget</span>
          <button
            onClick={() => setSelectedWidget(null)}
            className="p-1.5 hover:bg-accent rounded transition-colors"
            aria-label="Close properties"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-4 px-3 pb-2 overflow-x-auto">
          {/* Fill */}
          <div className="shrink-0">
            <div className="text-[10px] text-muted-foreground mb-1">Fill</div>
            <div className="grid grid-cols-9 gap-1">
              {FILL_OPTIONS.map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => updateWidgetColor(selectedWidget, { backgroundColor: c })}
                  className={`w-8 h-8 rounded-full border transition-transform hover:scale-110 ${
                    c === null
                      ? 'bg-gradient-to-br from-white to-gray-400 border-gray-300'
                      : c === 'transparent'
                        ? 'border-gray-300 overflow-hidden'
                        : 'border-gray-400'
                  } ${bgColor === c || (!bgColor && c === null) ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                  style={c && c !== 'transparent' ? { backgroundColor: c } : undefined}
                  title={c === null ? 'None' : c === 'transparent' ? 'Transparent' : c}
                >
                  {c === 'transparent' && (
                    <svg viewBox="0 0 32 32" className="w-full h-full">
                      <pattern id="checker" width="8" height="8" patternUnits="userSpaceOnUse">
                        <rect width="4" height="4" fill="#ccc" />
                        <rect x="4" y="4" width="4" height="4" fill="#ccc" />
                        <rect x="4" width="4" height="4" fill="#fff" />
                        <rect y="4" width="4" height="4" fill="#fff" />
                      </pattern>
                      <circle cx="16" cy="16" r="16" fill="url(#checker)" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px bg-border self-stretch shrink-0" />
          {/* Outline */}
          <div className="shrink-0">
            <div className="text-[10px] text-muted-foreground mb-1">Outline</div>
            <div className="grid grid-cols-8 gap-1">
              {COLOR_OPTIONS.map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => updateWidgetColor(selectedWidget, { outlineColor: c })}
                  className={`w-8 h-8 rounded-full border transition-transform hover:scale-110 ${
                    c === null ? 'bg-gradient-to-br from-white to-gray-400 border-gray-300' : 'border-gray-400'
                  } ${olColor === c || (!olColor && c === null) ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                  style={c ? { backgroundColor: c } : undefined}
                  title={c === null ? 'None' : c}
                />
              ))}
            </div>
          </div>
          <div className="w-px bg-border self-stretch shrink-0" />
          {/* Opacity — only meaningful with a color fill */}
          {hasColorFill && (
            <>
              <div className="shrink-0">
                <div className="text-[10px] text-muted-foreground mb-1">Opacity</div>
                <div className="flex gap-1">
                  {[0, 0.25, 0.5, 0.75, 1].map((o) => (
                    <button
                      key={o}
                      onClick={() => updateWidgetColor(selectedWidget, { backgroundOpacity: o })}
                      className={`px-3 min-h-[44px] text-xs rounded border transition-colors ${
                        bgOpacity === o
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-accent/50'
                      }`}
                    >
                      {Math.round(o * 100)}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-px bg-border self-stretch shrink-0" />
            </>
          )}
          {/* Text Color */}
          <div className="shrink-0">
            <div className="text-[10px] text-muted-foreground mb-1">Text</div>
            <div className="grid grid-cols-8 gap-1">
              {COLOR_OPTIONS.map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => updateWidgetColor(selectedWidget, { textColor: c })}
                  className={`w-8 h-8 rounded-full border transition-transform hover:scale-110 ${
                    c === null ? 'bg-gradient-to-br from-white to-gray-400 border-gray-300' : 'border-gray-400'
                  } ${txtColor === c || (!txtColor && c === null) ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                  style={c ? { backgroundColor: c } : undefined}
                  title={c === null ? 'Auto' : c}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const gridBackground = useMemo(() => {
    if (!isEditable || !mounted || width <= 0) return null;
    const patternW = cellSize + margin;
    const patternH = cellSize + margin;
    const gridHeight = totalRows * patternH + 2 * containerPadding;
    const gridWidth = totalCols * patternW + 2 * containerPadding;

    return (
      <svg
        className="absolute inset-0 pointer-events-none z-0"
        width={gridWidth}
        height={gridHeight}
        style={{ opacity: theme.gridOpacity }}
      >
        <defs>
          <pattern id={theme.gridPatternId} width={patternW} height={patternH} patternUnits="userSpaceOnUse" x={containerPadding} y={containerPadding}>
            <rect width={cellSize} height={cellSize} fill="none" stroke={theme.gridStroke} strokeWidth="0.5" className={theme.gridStroke === 'currentColor' ? 'text-primary' : ''} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${theme.gridPatternId})`} />
      </svg>
    );
  }, [isEditable, mounted, width, cellSize, margin, totalRows, totalCols, theme]);

  const screenGuideLines = useMemo(() => {
    if (!isEditable || !mounted || width <= 0) return null;
    const safeZones = SAFE_ZONES[screenGuideOrientation].filter(z => enabledSizes.includes(z.name));
    const patternH = cellSize + margin;
    const patternW = cellSize + margin;

    const gridW = totalCols * patternW + containerPadding;
    const gridH = totalRows * patternH + containerPadding;

    return (
      <div
        className="absolute pointer-events-none z-[5]"
        style={{ left: containerPadding, top: containerPadding, width: gridW, height: gridH }}
      >
        {safeZones.map(zone => {
          const rectW = zone.cols * patternW - margin;
          const rectH = zone.rows * patternH - margin;
          return (
            <div
              key={`rect-${zone.name}`}
              className="absolute"
              style={{
                left: 0,
                top: 0,
                width: rectW,
                height: rectH,
                border: `2px dashed ${zone.color}`,
                boxSizing: 'border-box',
                opacity: 0.6,
              }}
            >
              <span
                className="absolute text-[10px] px-1 py-0.5 rounded-tl font-medium"
                style={{ backgroundColor: zone.color, color: 'white', bottom: 2, right: 2 }}
              >
                {zone.name}
              </span>
            </div>
          );
        })}
      </div>
    );
  }, [isEditable, mounted, width, cellSize, margin, screenGuideOrientation, enabledSizes, cols, totalRows, totalCols, containerPadding, SAFE_ZONES]);

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (containerRef && 'current' in containerRef) {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [containerRef]);

  if (isEditable) {
    return (
      <div className={className || ''}>
        {renderPropertiesBar()}
        <div
          ref={combinedRef}
          onScroll={handleScroll}
          className={`overflow-auto ${theme.gridBg}`}
          style={{ maxHeight: visibleRows * (cellSize + margin) + 2 * containerPadding }}
        >
          <div
            className="relative editing-mode"
            onClick={() => setSelectedWidget(null)}
            style={{
              minHeight: totalRows * (cellSize + margin) + 2 * containerPadding,
              minWidth: totalCols * (cellSize + margin) + 2 * containerPadding,
            }}
          >
            {gridBackground}
            {screenGuideLines}
            {gridHelperText && (
              <div className="absolute top-2 left-4 text-white/50 text-xs z-20">
                {gridHelperText}
              </div>
            )}
            {mounted && width > 0 ? (
              <RGL
                className="layout"
                width={Math.max(width, totalCols * (cellSize + margin) + 2 * containerPadding)}
                layouts={{ lg: rglLayout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
                cols={{ lg: cols, md: 9, sm: 6, xs: 3 }}
                rowHeight={cellSize}
                compactor={overlapCompactor}
                dragConfig={{ enabled: true }}
                resizeConfig={{ enabled: true, handles: ['n', 's', 'e', 'w', 'ne', 'se', 'sw'] }}
                onLayoutChange={handleLayoutChange}
                containerPadding={[containerPadding, containerPadding]}
                margin={[margin, margin]}
              >
                {visibleWidgets.map(w => {
                  const widgetStyle = getWidgetStyle(w);
                  const textClass = getTextClass(w, '');
                  const isSelected = selectedWidget === w.i;
                  const hasCustomBg = !!w.backgroundColor;

                  return (
                    <div
                      key={w.i}
                      className={`relative cursor-pointer ${isSelected ? 'ring-2 ring-primary ring-offset-2 z-[100]' : ''}`}
                      style={widgetStyle}
                      onClick={(e) => { e.stopPropagation(); setSelectedWidget(w.i); }}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        if (touch) tapStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
                      }}
                      onTouchEnd={(e) => {
                        if (!tapStartRef.current) return;
                        const t = e.changedTouches[0];
                        if (!t) { tapStartRef.current = null; return; }
                        const dx = Math.abs(t.clientX - tapStartRef.current.x);
                        const dy = Math.abs(t.clientY - tapStartRef.current.y);
                        const dt = Date.now() - tapStartRef.current.time;
                        tapStartRef.current = null;
                        if (dx < 10 && dy < 10 && dt < 500) {
                          setSelectedWidget(w.i);
                        }
                      }}
                    >
                      <div className={`absolute inset-0 z-10 border-2 border-dashed ${isSelected ? 'border-primary' : theme.borderDash} rounded-lg pointer-events-none`} />
                      <WidgetBgOverrideProvider value={{ hasCustomBg, textColor: w.textColor }}>
                        <div className={`h-full w-full overflow-hidden ${textClass}`}>
                          {renderWidget(w)}
                        </div>
                      </WidgetBgOverrideProvider>
                    </div>
                  );
                })}
              </RGL>
            ) : (
              <div style={{ padding: 20, color: 'yellow' }}>
                Waiting for container width...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Display mode (non-editable) - prevent scrolling beyond screen bounds
  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={`relative overflow-hidden ${className || ''}`}
      style={{ height: visibleRows * (cellSize + margin) + 2 * containerPadding }}
    >
      {mounted && width > 0 ? (
        <div style={{ height: '100%' }}>
          <RGL
            className="layout"
            width={width}
            layouts={{ lg: rglLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
            cols={{ lg: cols, md: 9, sm: 6, xs: 3 }}
            rowHeight={cellSize}
            compactor={overlapCompactor}
            dragConfig={{ enabled: false }}
            resizeConfig={{ enabled: false }}
            containerPadding={[containerPadding, containerPadding]}
            margin={[margin, margin]}
          >
            {visibleWidgets.map(w => {
              const widgetStyle = getWidgetStyle(w);
              const textClass = getTextClass(w, '');
              const hasCustomBg = !!w.backgroundColor;

              return (
                <div key={w.i} className="relative" style={widgetStyle}>
                  <WidgetBgOverrideProvider value={{ hasCustomBg, textColor: w.textColor }}>
                    <div className={`h-full w-full overflow-hidden ${textClass}`}>
                      {renderWidget(w)}
                    </div>
                  </WidgetBgOverrideProvider>
                </div>
              );
            })}
          </RGL>
        </div>
      ) : (
        <div style={{ padding: 20, color: 'yellow' }}>
          Waiting for container width...
        </div>
      )}
    </div>
  );
}
