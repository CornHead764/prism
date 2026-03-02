'use client';

import * as React from 'react';
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { PaintBucket, Square, Type } from 'lucide-react';
import { isLightColor } from '@/lib/utils/color';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { useTheme } from '@/components/providers';
import { getColorPalette, FIXED_COLORS, PALETTE_ORDER, type PaletteId } from '@/lib/constants/colorPalettes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { CssGridDisplay } from './grid/CssGridDisplay';
import { CssGridEditor } from './grid/CssGridEditor';
import { useSquareCells } from './grid/useSquareCells';

export type { EditorTheme } from './grid/gridEditorTypes';
export { DASHBOARD_THEME, SCREENSAVER_THEME } from './grid/gridEditorTypes';
export type { LayoutGridEditorProps } from './grid/gridEditorTypes';

// Re-import for local use
import { DASHBOARD_THEME } from './grid/gridEditorTypes';
import type { LayoutGridEditorProps } from './grid/gridEditorTypes';

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
  const cols = 12;
  const containerPadding = 12;
  const margin = marginProp;
  const { width, containerRef, mounted, cellSize } = useSquareCells(cols, containerPadding, margin);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLInputElement | null>(null);
  const [colorTarget, setColorTarget] = useState<'fill' | 'outline' | 'text'>('fill');
  const [paletteId, setPaletteId] = useState<PaletteId>('seasonal');
  const [scrollY, setScrollY] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [screenGuideOrientationInternal, setScreenGuideOrientationInternal] = useState<'landscape' | 'portrait'>('landscape');
  const [enabledSizesInternal, setEnabledSizesInternal] = useState<string[]>(allSizeNames);

  const screenGuideOrientation = screenGuideOrientationProp ?? screenGuideOrientationInternal;
  const enabledSizes = enabledSizesProp ?? enabledSizesInternal;

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

  const updateWidgetColor = useCallback((widgetId: string, updates: { backgroundColor?: string | null; backgroundOpacity?: number; outlineColor?: string | null; outlineOpacity?: number; textColor?: string | null; textOpacity?: number }) => {
    const updated = layoutRef.current.map(w => {
      if (w.i === widgetId) {
        return {
          ...w,
          backgroundColor: updates.backgroundColor === null ? undefined : (updates.backgroundColor ?? w.backgroundColor),
          backgroundOpacity: updates.backgroundOpacity ?? w.backgroundOpacity,
          outlineColor: updates.outlineColor === null ? undefined : (updates.outlineColor ?? w.outlineColor),
          outlineOpacity: updates.outlineOpacity ?? w.outlineOpacity,
          textColor: updates.textColor === null ? undefined : (updates.textColor ?? w.textColor),
          textOpacity: updates.textOpacity ?? w.textOpacity,
        };
      }
      return w;
    });
    onLayoutChange(updated);
  }, [onLayoutChange]);

  // Clear selection when widget becomes invisible
  useEffect(() => {
    if (selectedWidget && !layout.find(w => w.i === selectedWidget && w.visible !== false)) {
      setSelectedWidget(null);
    }
  }, [selectedWidget, layout]);

  const selectedWidgetConfig = selectedWidget
    ? layoutRef.current.find(w => w.i === selectedWidget && w.visible !== false)
    : null;

  // Get current color value for whichever target is active
  const getActiveColor = (widget: WidgetConfig): string | undefined => {
    if (colorTarget === 'fill') return widget.backgroundColor;
    if (colorTarget === 'outline') return widget.outlineColor;
    return widget.textColor;
  };

  // Apply a color to whichever target is active
  const applyColorToTarget = (widgetId: string, color: string | null) => {
    if (colorTarget === 'fill') {
      updateWidgetColor(widgetId, { backgroundColor: color });
    } else if (colorTarget === 'outline') {
      updateWidgetColor(widgetId, { outlineColor: color });
    } else {
      updateWidgetColor(widgetId, { textColor: color });
    }
  };

  const renderPropertiesBar = () => {
    if (!selectedWidgetConfig || !selectedWidget) return null;
    const bgColor = selectedWidgetConfig.backgroundColor;
    const olColor = selectedWidgetConfig.outlineColor;
    const txtColor = selectedWidgetConfig.textColor;
    const bgOpacity = selectedWidgetConfig.backgroundOpacity ?? 1;
    const olOpacity = selectedWidgetConfig.outlineOpacity ?? 1;
    const txtOpacity = selectedWidgetConfig.textOpacity ?? 1;
    const displayName = selectedWidgetConfig.i.charAt(0).toUpperCase() + selectedWidgetConfig.i.slice(1);
    const hasColorFill = bgColor && bgColor !== 'transparent';
    const hasColorOutline = !!olColor;
    const hasColorText = !!txtColor;
    const activeColor = getActiveColor(selectedWidgetConfig);

    const palette = getColorPalette(paletteId, isDark);
    const swatchColors = palette.colors;
    // Append black + white unless monochrome (which already has them)
    const fixedColors = paletteId === 'mono' ? [] : FIXED_COLORS;

    // Determine which swatch is selected based on active target
    const isSwatchSelected = (hex: string) => activeColor === hex;

    return (
      <div className="bg-card/95 backdrop-blur-sm border-b border-border" onPointerDown={(e) => e.stopPropagation()}>
        {/* Row 1: Widget name + close */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <span className="text-sm font-medium">{displayName} Widget</span>
          <button
            onClick={() => setSelectedWidget(null)}
            className="p-1.5 hover:bg-accent rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
            aria-label="Close properties"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Row 2: Theme selector pills */}
        <div className="flex gap-1 px-3 pb-1.5">
          {PALETTE_ORDER.map((id) => {
            const p = getColorPalette(id, isDark);
            return (
              <button
                key={id}
                onClick={() => setPaletteId(id)}
                onPointerDown={(e) => e.stopPropagation()}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors touch-manipulation ${
                  paletteId === id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent/50 text-muted-foreground'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Row 3: Special swatch + themed colors + B/W + custom picker */}
        <div className="flex items-center gap-1 px-3 pb-1.5">
          {/* Special swatch — checkerboard for all targets */}
          {(() => {
            const specialValue = colorTarget === 'fill' ? 'transparent' : null;
            const isSpecialSelected = colorTarget === 'fill'
              ? bgColor === 'transparent'
              : colorTarget === 'outline' ? !olColor : !txtColor;
            const title = colorTarget === 'fill' ? 'Transparent' : colorTarget === 'outline' ? 'None' : 'Auto';
            return (
              <button
                onClick={() => applyColorToTarget(selectedWidget, specialValue)}
                onPointerDown={(e) => e.stopPropagation()}
                className={`w-8 h-8 rounded-full border border-gray-300 overflow-hidden transition-transform hover:scale-110 touch-manipulation ${
                  isSpecialSelected ? 'ring-2 ring-primary ring-offset-1' : ''
                }`}
                title={title}
              >
                <svg viewBox="0 0 32 32" className="w-full h-full">
                  <pattern id="checker-props" width="8" height="8" patternUnits="userSpaceOnUse">
                    <rect width="4" height="4" fill="#ccc" />
                    <rect x="4" y="4" width="4" height="4" fill="#ccc" />
                    <rect x="4" width="4" height="4" fill="#fff" />
                    <rect y="4" width="4" height="4" fill="#fff" />
                  </pattern>
                  <circle cx="16" cy="16" r="16" fill="url(#checker-props)" />
                </svg>
              </button>
            );
          })()}

          <div className="w-px h-6 bg-border mx-0.5" />

          {/* Themed color swatches */}
          {swatchColors.map((hex) => (
            <button
              key={hex}
              onClick={() => applyColorToTarget(selectedWidget, hex)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`w-8 h-8 rounded-full border border-gray-400 transition-transform hover:scale-110 touch-manipulation ${
                isSwatchSelected(hex) ? 'ring-2 ring-primary ring-offset-1' : ''
              }`}
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}

          {/* Fixed colors: black + white (unless mono) */}
          {fixedColors.map((hex) => (
            <button
              key={hex}
              onClick={() => applyColorToTarget(selectedWidget, hex)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`w-8 h-8 rounded-full border border-gray-400 transition-transform hover:scale-110 touch-manipulation ${
                isSwatchSelected(hex) ? 'ring-2 ring-primary ring-offset-1' : ''
              }`}
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}

          {/* Custom color picker (rainbow button) */}
          <div className="relative">
            <button
              onClick={() => colorPickerRef.current?.click()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full border border-gray-400 transition-transform hover:scale-110 touch-manipulation overflow-hidden"
              style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
              title="Custom color"
            />
            <input
              ref={(el) => { (colorPickerRef as React.MutableRefObject<HTMLInputElement | null>).current = el; }}
              type="color"
              className="sr-only"
              value={activeColor || '#3B82F6'}
              onChange={(e) => applyColorToTarget(selectedWidget, e.target.value)}
            />
          </div>

          {/* Opacity — inline on swatch row, visible when active target has a color */}
          {((colorTarget === 'fill' && hasColorFill) || (colorTarget === 'outline' && hasColorOutline) || (colorTarget === 'text' && hasColorText)) && (
            <>
              <div className="w-px h-6 bg-border mx-0.5" />
              {[0, 0.25, 0.5, 0.75, 1].map((o) => {
                const currentOpacity = colorTarget === 'fill' ? bgOpacity : colorTarget === 'outline' ? olOpacity : txtOpacity;
                const handleOpacityClick = () => {
                  if (colorTarget === 'fill') updateWidgetColor(selectedWidget, { backgroundOpacity: o });
                  else if (colorTarget === 'outline') updateWidgetColor(selectedWidget, { outlineOpacity: o });
                  else updateWidgetColor(selectedWidget, { textOpacity: o });
                };
                return (
                  <button
                    key={o}
                    onClick={handleOpacityClick}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`w-8 h-8 rounded-full text-[10px] border transition-colors touch-manipulation ${
                      currentOpacity === o
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-accent/50'
                    }`}
                  >
                    {Math.round(o * 100)}%
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Row 4: Target buttons with harvey ball indicators */}
        <div className="flex items-center gap-2 px-3 pb-2">
          <div className="flex gap-1">
            {([
              { id: 'fill' as const, icon: PaintBucket, label: 'Fill', color: bgColor, opacity: bgOpacity },
              { id: 'outline' as const, icon: Square, label: 'Outline', color: olColor, opacity: olOpacity },
              { id: 'text' as const, icon: Type, label: 'Text', color: txtColor, opacity: txtOpacity },
            ]).map(({ id, icon: Icon, label, color, opacity }) => {
              const fillColor = color && color !== 'transparent' ? color : '#999';
              const fillLevel = !color || color === 'transparent' ? 0 : opacity;
              const isActive = colorTarget === id;
              // Contrasting stroke: light stroke on dark fills, dark stroke on light fills
              const ballStroke = fillLevel > 0 && color && color !== 'transparent'
                ? (isLightColor(color) ? '#333' : '#fff')
                : (isActive ? 'rgba(255,255,255,0.6)' : '#999');

              return (
                <button
                  key={id}
                  onClick={() => setColorTarget(id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`relative flex items-center gap-1.5 px-2.5 min-h-[44px] min-w-[44px] text-xs rounded border transition-colors touch-manipulation ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                  {/* Harvey ball pie-slice indicator: 25% per slice, starting from 12 o'clock clockwise */}
                  <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0">
                    <circle cx="8" cy="8" r="7" fill={isActive ? 'rgba(255,255,255,0.3)' : '#e5e5e5'} stroke={ballStroke} strokeWidth="1" />
                    {fillLevel > 0 && (() => {
                      // Each 25% = one quarter pie slice; compute arc path
                      const slices = Math.round(fillLevel * 4); // 0-4 slices
                      if (slices >= 4) {
                        // Full circle
                        return <circle cx="8" cy="8" r="7" fill={fillColor} stroke={ballStroke} strokeWidth="0.5" />;
                      }
                      // SVG arc from 12 o'clock clockwise
                      const endAngle = (slices / 4) * 2 * Math.PI - Math.PI / 2;
                      const ex = 8 + 7 * Math.cos(endAngle);
                      const ey = 8 + 7 * Math.sin(endAngle);
                      const largeArc = slices > 2 ? 1 : 0;
                      return (
                        <path
                          d={`M8,8 L8,1 A7,7 0 ${largeArc},1 ${ex.toFixed(2)},${ey.toFixed(2)} Z`}
                          fill={fillColor}
                          stroke={ballStroke}
                          strokeWidth="0.5"
                        />
                      );
                    })()}
                    {color === 'transparent' && (
                      <>
                        <defs>
                          <pattern id={`hb-checker-${id}`} width="4" height="4" patternUnits="userSpaceOnUse">
                            <rect width="2" height="2" fill="#ccc" />
                            <rect x="2" y="2" width="2" height="2" fill="#ccc" />
                            <rect x="2" width="2" height="2" fill="#fff" />
                            <rect y="2" width="2" height="2" fill="#fff" />
                          </pattern>
                        </defs>
                        <circle cx="8" cy="8" r="7" fill={`url(#hb-checker-${id})`} stroke={ballStroke} strokeWidth="0.5" />
                      </>
                    )}
                  </svg>
                </button>
              );
            })}
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
              <CssGridEditor
                layout={stableLayout}
                onLayoutChange={onLayoutChange}
                renderWidget={renderWidget}
                widgetConstraints={widgetConstraints}
                cellSize={cellSize}
                margin={margin}
                containerPadding={containerPadding}
                cols={cols}
                totalRows={totalRows}
                totalCols={totalCols}
                selectedWidget={selectedWidget}
                onSelectWidget={setSelectedWidget}
                theme={theme}
              />
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

  // Display mode (non-editable) — pure CSS Grid, SSR-safe
  return (
    <CssGridDisplay
      layout={layout}
      renderWidget={renderWidget}
      margin={margin}
      containerPadding={containerPadding}
      cols={cols}
      headerOffset={headerOffset}
      bottomOffset={bottomOffset}
      minVisibleRows={minVisibleRows}
      className={className}
    />
  );
}
