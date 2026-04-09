'use client';

import * as React from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { LAYOUT_TEMPLATES } from '@/lib/constants/layoutTemplates';
import { SCREENSAVER_TEMPLATES } from '@/lib/constants/screensaverTemplates';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import { CommunityGallery } from './CommunityGallery';
import { LayoutPreview } from './LayoutPreview';
import { CoordinateEditor } from './CoordinateEditor';
import { validateCommunityLayout } from '@/lib/community/validateLayout';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { LayoutEditorShareDialog } from './LayoutEditorShareDialog';
import { LayoutEditorImportDialog } from './LayoutEditorImportExport';
import { CreateDashboardDialog } from './LayoutEditorDashboardManager';

export interface SavedLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
}

export interface DashboardInfo {
  id: string;
  name: string;
  slug: string | null;
  isDefault: boolean;
}

export interface LayoutEditorProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  onSave: (name?: string) => void | Promise<void>;
  onSaveAs: (defaultName?: string) => void;
  onReset: () => void;
  onCancel: () => void;
  onDeleteLayout?: (id: string) => void;
  layoutName?: string;
  savedLayouts?: SavedLayout[];
  editingScreensaver?: boolean;
  onToggleScreensaverEdit?: () => void;
  screensaverWidgets?: WidgetConfig[];
  onScreensaverWidgetToggle?: (widgetType: string, visible: boolean) => void;
  onScreensaverSave?: () => void;
  onScreensaverSaveAs?: () => void;
  onScreensaverReset?: () => void;
  onSelectScreensaverTemplate?: (templateWidgets: WidgetConfig[]) => void;
  screensaverPresets?: Array<{ name: string; widgets: WidgetConfig[] }>;
  onSelectScreensaverPreset?: (widgets: WidgetConfig[]) => void;
  onDeleteScreensaverPreset?: (name: string) => void;
  screenGuideOrientation?: 'landscape' | 'portrait';
  onScreenGuideOrientationChange?: (o: 'landscape' | 'portrait') => void;
  enabledSizes?: string[];
  onToggleSize?: (size: string) => void;
  gridScrollY?: number;
  gridVisibleRows?: number;
  gridScrollX?: number;
  gridVisibleCols?: number;
  gridTotalRows?: number;
  gridTotalCols?: number;
  scrollToGridRef?: React.MutableRefObject<((row: number, col?: number) => void) | null>;
  // Multi-dashboard props
  allDashboards?: DashboardInfo[];
  currentDashboardId?: string;
  onSwitchDashboard?: (slug: string) => void;
  onCreateDashboard?: (name: string, startFrom: 'blank' | 'template' | 'copy') => void;
  onRenameDashboard?: (newName: string) => void;
  onDeleteDashboard?: () => void;
}

const EXPORT_VERSION = 2;

interface ExportWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  minW?: number;
  minH?: number;
}

interface LayoutExportV2 {
  type: 'prism-layout';
  version: number;
  mode: 'dashboard' | 'screensaver';
  name: string;
  description: string;
  author: string;
  tags: string[];
  screenSizes: string[];
  orientation: 'landscape' | 'portrait';
  widgets: ExportWidget[];
}

type ActivePopover = 'dashboard' | 'widgets' | 'templates' | 'community' | 'preview' | 'more' | 'save' | null;

export function LayoutEditor({
  widgets,
  onWidgetsChange,
  onSave,
  onSaveAs,
  onReset,
  onCancel,
  layoutName,
  savedLayouts = [],
  editingScreensaver = false,
  onToggleScreensaverEdit,
  screensaverWidgets,
  onScreensaverSave,
  onScreensaverSaveAs,
  onScreensaverReset,
  onSelectScreensaverTemplate,
  screensaverPresets = [],
  onSelectScreensaverPreset,
  onDeleteScreensaverPreset,
  screenGuideOrientation = 'landscape',
  onScreenGuideOrientationChange,
  enabledSizes = [],
  onToggleSize,
  gridScrollY = 0,
  gridVisibleRows = 48,
  gridScrollX = 0,
  gridVisibleCols = 48,
  gridTotalRows: _gridTotalRows = 96,
  gridTotalCols: _gridTotalCols = 48,
  scrollToGridRef,
  allDashboards = [],
  currentDashboardId,
  onSwitchDashboard,
  onCreateDashboard,
  onRenameDashboard,
  onDeleteDashboard,
}: LayoutEditorProps) {
  const { zones, allSizeNames } = useScreenSafeZones();
  const { confirm: confirmDelete, dialogProps: confirmDialogProps } = useConfirmDialog();
  const effectiveEnabledSizes = enabledSizes.length > 0 ? enabledSizes : allSizeNames;

  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [exportFeedback, setExportFeedback] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [saveFeedback, setSaveFeedback] = useState('');
  const [focusedWidget, setFocusedWidget] = useState<string | null>(null);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureHideNav, setMeasureHideNav] = useState(true);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Dispatch measure mode state to AppShell/DashboardHeader/LayoutGridEditor
  const dispatchMeasure = useCallback((active: boolean, hideNav: boolean) => {
    window.dispatchEvent(new CustomEvent('prism:measure-mode', {
      detail: { active, hideNav },
    }));
  }, []);

  // Toggle measure mode — hides toolbar, optionally hides nav
  const toggleMeasureMode = useCallback(() => {
    setMeasureMode(prev => {
      const next = !prev;
      dispatchMeasure(next, measureHideNav);
      if (next) setActivePopover(null);
      return next;
    });
  }, [dispatchMeasure, measureHideNav]);

  // Toggle nav visibility within measure mode
  const toggleMeasureNav = useCallback(() => {
    setMeasureHideNav(prev => {
      const next = !prev;
      dispatchMeasure(true, next);
      return next;
    });
  }, [dispatchMeasure]);

  // Keyboard shortcut: Ctrl+Shift+M
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        toggleMeasureMode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleMeasureMode]);

  // Clean up measure mode on unmount (editor closing)
  useEffect(() => {
    return () => {
      dispatchMeasure(false, false);
    };
  }, [dispatchMeasure]);

  const currentWidgets = useMemo(() =>
    editingScreensaver ? (screensaverWidgets || []) : widgets,
  [editingScreensaver, screensaverWidgets, widgets]);
  const visibleWidgets = useMemo(() =>
    currentWidgets.filter(w => w.visible !== false),
  [currentWidgets]);

  const validation = useMemo(() => {
    const layoutData = {
      type: 'prism-layout' as const,
      version: 2,
      mode: editingScreensaver ? 'screensaver' as const : 'dashboard' as const,
      name: '',
      description: '',
      author: '',
      tags: [],
      screenSizes: [],
      orientation: 'landscape' as const,
      widgets: visibleWidgets,
    };
    return validateCommunityLayout(layoutData);
  }, [visibleWidgets, editingScreensaver]);

  const mode = editingScreensaver ? 'screensaver' : 'dashboard';
  const saveLabel = editingScreensaver ? 'Save Screensaver' : 'Save';

  const togglePopover = useCallback((name: ActivePopover) => {
    setActivePopover(prev => prev === name ? null : name);
  }, []);

  // Close popover when clicking outside toolbar
  useEffect(() => {
    if (!activePopover) return;
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activePopover]);

  // Template list filtered by mode and orientation
  const templates = useMemo(() => {
    const allTemplates = editingScreensaver ? SCREENSAVER_TEMPLATES : LAYOUT_TEMPLATES;
    return Object.entries(allTemplates).filter(([, t]) => t.orientation === screenGuideOrientation);
  }, [editingScreensaver, screenGuideOrientation]);

  const handleSelectTemplate = (templateKey: string) => {
    const template = LAYOUT_TEMPLATES[templateKey];
    if (template) {
      onWidgetsChange(template.widgets.map(w => ({ ...w, visible: true })));
    }
  };

  const handleSelectSsTemplate = (templateKey: string) => {
    const template = SCREENSAVER_TEMPLATES[templateKey];
    if (template && onSelectScreensaverTemplate) {
      onSelectScreensaverTemplate(template.widgets);
    }
  };

  const handleSelectSsPreset = (preset: { name: string; widgets: WidgetConfig[] }) => {
    if (onSelectScreensaverPreset) {
      onSelectScreensaverPreset(preset.widgets);
    }
  };

  const handleApplyCommunityLayout = useCallback((newWidgets: WidgetConfig[], name: string) => {
    if (editingScreensaver && onSelectScreensaverPreset) {
      onSelectScreensaverPreset(newWidgets);
      onScreensaverSaveAs?.();
    } else {
      onWidgetsChange(newWidgets);
      onSaveAs(name);
    }
    setActivePopover(null);
  }, [editingScreensaver, onSelectScreensaverPreset, onWidgetsChange, onSaveAs, onScreensaverSaveAs]);

  const buildExportData = useCallback((): LayoutExportV2 => {
    return {
      type: 'prism-layout',
      version: EXPORT_VERSION,
      mode,
      name: layoutName || (editingScreensaver ? 'Screensaver' : 'Dashboard'),
      description: '',
      author: '',
      tags: [],
      screenSizes: [],
      orientation: 'landscape',
      widgets: currentWidgets
        .filter(w => w.visible !== false)
        .map(widget => {
          const reg = WIDGET_REGISTRY[widget.i];
          const exported: ExportWidget = {
            i: widget.i,
            x: widget.x,
            y: widget.y,
            w: widget.w,
            h: widget.h,
          };
          if (widget.backgroundColor) exported.backgroundColor = widget.backgroundColor;
          if (widget.backgroundOpacity !== undefined && widget.backgroundOpacity !== 1) {
            exported.backgroundOpacity = widget.backgroundOpacity;
          }
          if (reg?.minW) exported.minW = reg.minW;
          if (reg?.minH) exported.minH = reg.minH;
          return exported;
        }),
    };
  }, [mode, layoutName, editingScreensaver, currentWidgets]);

  const handleExport = () => {
    const exportData = buildExportData();
    const result = validateCommunityLayout(exportData);
    if (result.warnings.length > 0) {
      console.warn('Layout export warnings:', result.warnings);
    }
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2)).then(() => {
      setExportFeedback('Copied!');
      setTimeout(() => setExportFeedback(''), 2000);
    }).catch(() => {
      setExportFeedback('Failed');
      setTimeout(() => setExportFeedback(''), 2000);
    });
    setActivePopover(null);
  };

  const handleImportOpen = () => {
    setShowImportDialog(true);
    setActivePopover(null);
  };

  const handleImportApply = (importedWidgets: WidgetConfig[]) => {
    if (editingScreensaver && onSelectScreensaverPreset) {
      onSelectScreensaverPreset(importedWidgets);
    } else {
      onWidgetsChange(importedWidgets);
    }
  };

  const handleSave = async () => {
    try {
      if (editingScreensaver) {
        await onScreensaverSave?.();
      } else {
        await onSave();
      }
      setSaveFeedback('Saved!');
      setTimeout(() => setSaveFeedback(''), 2000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveFeedback('Failed!');
      setTimeout(() => setSaveFeedback(''), 3000);
      toast({ title: 'Failed to save layout', variant: 'destructive' });
    }
  };

  const handleShareOpen = () => {
    setShowShareDialog(true);
    setActivePopover(null);
  };

  const handleRenameOpen = () => {
    setRenameValue(layoutName || '');
    setShowRenameDialog(true);
    setActivePopover(null);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== layoutName) {
      onRenameDashboard?.(trimmed);
    }
    setShowRenameDialog(false);
  };

  const handleDelete = async () => {
    if (allDashboards.length <= 1) {
      toast({ title: 'Cannot delete the last dashboard', variant: 'warning' });
      return;
    }
    const currentSlug = allDashboards.find(d => d.id === currentDashboardId)?.slug;
    const ok = await confirmDelete(
      `Delete "${layoutName}"?`,
      `Devices bookmarked at /d/${currentSlug || '...'} will stop working.`
    );
    if (ok) onDeleteDashboard?.();
    setActivePopover(null);
  };

  const handleCreateOpen = () => {
    setShowCreateDialog(true);
    setActivePopover(null);
  };

  const btnClass = "px-2 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors";
  const moreItemClass = "w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors";

  if (measureMode) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg">
        <button
          onClick={toggleMeasureNav}
          className={`px-3 py-1.5 text-xs rounded-full transition-colors whitespace-nowrap ${
            measureHideNav
              ? 'bg-muted text-muted-foreground hover:bg-accent'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
          }`}
        >
          {measureHideNav ? 'Show Nav' : 'Hide Nav'}
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          onClick={toggleMeasureMode}
          className="px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          Exit
        </button>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">Ctrl+Shift+M</span>
      </div>
    );
  }

  return (
    <>
      <div ref={toolbarRef} className="relative z-[200] bg-card/85 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left group */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {!editingScreensaver && onRenameDashboard ? (
              <button
                onClick={handleRenameOpen}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="Rename dashboard"
              >
                <EditIcon />
              </button>
            ) : (
              <EditIcon />
            )}

            {/* Dashboard name dropdown */}
            {editingScreensaver ? (
              <span className="text-sm font-medium">Screensaver</span>
            ) : (
              <PopoverButton
                label={<span className="font-medium">{layoutName || 'Untitled'}</span>}
                isActive={activePopover === 'dashboard'}
                onToggle={() => togglePopover('dashboard')}
                width={220}
              >
                <div className="py-1 max-h-[40vh] overflow-auto">
                  {allDashboards.map(dashboard => (
                    <button
                      key={dashboard.id}
                      onClick={() => {
                        if (dashboard.id !== currentDashboardId && dashboard.slug) {
                          sessionStorage.setItem('prism:editing', 'true');
                          onSwitchDashboard?.(dashboard.slug);
                        } else if (dashboard.id !== currentDashboardId && dashboard.isDefault) {
                          sessionStorage.setItem('prism:editing', 'true');
                          window.location.href = '/';
                        }
                        setActivePopover(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                        dashboard.id === currentDashboardId ? 'bg-accent/50' : ''
                      }`}
                    >
                      <span className="flex-1 truncate">{dashboard.name}</span>
                      {dashboard.id === currentDashboardId && (
                        <CheckIcon />
                      )}
                      {dashboard.isDefault && dashboard.id !== currentDashboardId && (
                        <span className="text-[10px] text-muted-foreground">default</span>
                      )}
                    </button>
                  ))}
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={handleCreateOpen}
                    className={`${moreItemClass} text-primary`}
                  >
                    + New Dashboard...
                  </button>
                </div>
              </PopoverButton>
            )}

            <div className="h-4 w-px bg-border mx-0.5" />

            {/* Orientation toggle */}
            <button
              onClick={() => onScreenGuideOrientationChange?.(screenGuideOrientation === 'landscape' ? 'portrait' : 'landscape')}
              className={`${btnClass} border ${
                screenGuideOrientation === 'landscape'
                  ? 'bg-muted border-border hover:bg-accent'
                  : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
              }`}
            >
              {screenGuideOrientation === 'landscape' ? '\u2B1C Landscape' : '\u25AF Portrait'}
            </button>

            {/* Widgets popover */}
            <PopoverButton
              label="Widgets"
              isActive={activePopover === 'widgets'}
              onToggle={() => togglePopover('widgets')}
              width={340}
            >
              <div className="p-2 max-h-[60vh] overflow-auto">
                <CoordinateEditor
                  widgets={currentWidgets}
                  onWidgetsChange={editingScreensaver && onSelectScreensaverPreset
                    ? onSelectScreensaverPreset
                    : onWidgetsChange
                  }
                  mode={mode}
                  onFocusedWidgetChange={setFocusedWidget}
                />
              </div>
            </PopoverButton>

            {/* Templates popover */}
            <PopoverButton
              label="Templates"
              isActive={activePopover === 'templates'}
              onToggle={() => togglePopover('templates')}
              width={200}
            >
              <div className="py-1">
                {templates.map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (editingScreensaver) handleSelectSsTemplate(key);
                      else handleSelectTemplate(key);
                      setActivePopover(null);
                    }}
                    className={moreItemClass}
                  >
                    {template.name}
                  </button>
                ))}
                {templates.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground italic">
                    No templates for {screenGuideOrientation}
                  </div>
                )}
              </div>
            </PopoverButton>

            {/* Community popover */}
            <PopoverButton
              label="Community"
              isActive={activePopover === 'community'}
              onToggle={() => togglePopover('community')}
              width={640}
            >
              <div className="p-3 max-h-[60vh] overflow-auto">
                <CommunityGallery mode={mode} onApplyLayout={handleApplyCommunityLayout} />
              </div>
            </PopoverButton>

            {/* Preview popover */}
            <PopoverButton
              label={
                <>
                  Preview
                  {validation.errors.length > 0 && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-destructive inline-block" />
                  )}
                </>
              }
              isActive={activePopover === 'preview'}
              onToggle={() => togglePopover('preview')}
              width={320}
            >
              <div className="p-3 space-y-3">
                <div className="flex gap-2 items-start">
                  <LayoutPreview
                    widgets={visibleWidgets.map(w => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h }))}
                    width={200}
                    height={200}
                    highlightWidget={focusedWidget ?? undefined}
                    showLabels={true}
                    showGrid={true}
                    visibleRows={gridVisibleRows}
                    scrollY={gridScrollY}
                    visibleCols={gridVisibleCols}
                    scrollX={gridScrollX}
                    onScrollTo={(row, col) => scrollToGridRef?.current?.(row, col)}
                    screenGuideOrientation={screenGuideOrientation}
                    enabledSizes={effectiveEnabledSizes}
                    safeZones={zones}
                  />
                  <div className="flex flex-col gap-1">
                    {allSizeNames.map(size => {
                      const zone = zones[screenGuideOrientation].find(z => z.name === size);
                      const isEnabled = effectiveEnabledSizes.includes(size);
                      return (
                        <button
                          key={size}
                          onClick={() => onToggleSize?.(size)}
                          className={`text-xs px-1.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                            isEnabled ? 'text-white' : 'text-muted-foreground/50 line-through'
                          }`}
                          style={{
                            backgroundColor: isEnabled ? zone?.color : 'transparent',
                            border: `1px solid ${zone?.color || '#666'}`,
                          }}
                        >
                          {size}
                        </button>
                      );
                    })}
                    <span className="text-[9px] text-muted-foreground mt-1 leading-tight">Click map<br/>to scroll</span>
                  </div>
                </div>
                {validation.errors.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2">
                    <p className="text-xs font-medium text-destructive mb-0.5">
                      {validation.errors.length} issue{validation.errors.length > 1 ? 's' : ''}
                    </p>
                    {validation.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive/80 leading-tight">{err}</p>
                    ))}
                  </div>
                )}
                {validation.warnings.length > 0 && validation.errors.length === 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-2">
                    {validation.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-600 leading-tight">{w}</p>
                    ))}
                  </div>
                )}
              </div>
            </PopoverButton>
          </div>

          {/* Right group */}
          <div className="flex items-center gap-2">
            {/* Measure Mode */}
            <button
              onClick={toggleMeasureMode}
              className={`${btnClass} bg-muted hover:bg-accent`}
              title="Hide toolbar and nav to see true layout (Ctrl+Shift+M)"
            >
              Measure
            </button>

            {/* Screensaver toggle */}
            {onToggleScreensaverEdit && (
              <button
                onClick={onToggleScreensaverEdit}
                className={`${btnClass} ${
                  editingScreensaver
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted hover:bg-accent'
                }`}
              >
                {editingScreensaver ? '\u2190 Dashboard' : 'Screensaver'}
              </button>
            )}

            {/* Save split button (no Save As for screensaver — it's part of the dashboard) */}
            {editingScreensaver ? (
              <button
                onClick={handleSave}
                className="px-2 py-1.5 text-xs rounded-md whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {saveLabel}
              </button>
            ) : (
              <div className="relative flex">
                <button
                  onClick={handleSave}
                  className="px-2 py-1.5 text-xs rounded-l-md whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {saveFeedback || saveLabel}
                </button>
                <button
                  onClick={() => togglePopover('save')}
                  className="px-1.5 py-1.5 rounded-r-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors border-l border-primary-foreground/20"
                  aria-label="Save options"
                >
                  <ChevronIcon open={activePopover === 'save'} />
                </button>
                {activePopover === 'save' && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] bg-popover border border-border rounded-md shadow-md py-1">
                    <button
                      onClick={() => { onSaveAs?.(); setActivePopover(null); }}
                      className={moreItemClass}
                    >
                      Save As...
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* More dropdown */}
            <PopoverButton
              label="More"
              isActive={activePopover === 'more'}
              onToggle={() => togglePopover('more')}
              width={180}
              align="right"
            >
              <div className="py-1">
                {!editingScreensaver && onDeleteDashboard && (
                  <button
                    onClick={handleDelete}
                    className={`${moreItemClass} ${allDashboards.length <= 1 ? 'text-muted-foreground cursor-not-allowed' : 'text-destructive'}`}
                    disabled={allDashboards.length <= 1}
                  >
                    Delete Dashboard
                  </button>
                )}
                {!editingScreensaver && onDeleteDashboard && (
                  <div className="border-t border-border my-1" />
                )}
                <button onClick={() => { if (editingScreensaver) { onScreensaverReset?.(); } else { onReset(); } setActivePopover(null); }} className={moreItemClass}>
                  Reset
                </button>
                <button onClick={handleExport} className={moreItemClass}>
                  {exportFeedback || 'Export'}
                </button>
                <button onClick={handleImportOpen} className={moreItemClass}>
                  Import
                </button>
                <button onClick={handleShareOpen} className={moreItemClass}>
                  Share
                </button>
              </div>
            </PopoverButton>

            {/* Cancel */}
            <button
              onClick={onCancel}
              className="px-2 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <CreateDashboardDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={(name, startFrom) => { onCreateDashboard?.(name, startFrom); setShowCreateDialog(false); }}
      />

      {/* Rename Dashboard modal */}
      {showRenameDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowRenameDialog(false)}>
          <div className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-medium">Rename Dashboard</div>
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                type="text"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={100}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRenameDialog(false)}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={!renameValue.trim() || renameValue.trim() === layoutName}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      <LayoutEditorImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        editingScreensaver={editingScreensaver}
        onApply={handleImportApply}
      />

      <LayoutEditorShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        layoutName={layoutName}
        mode={mode}
        currentWidgets={currentWidgets}
      />
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}

function PopoverButton({
  label,
  isActive,
  onToggle,
  children,
  width,
  align = 'left',
}: {
  label: React.ReactNode;
  isActive: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  width?: number;
  align?: 'left' | 'right';
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`px-2 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'bg-muted hover:bg-accent'
        }`}
      >
        {label}
        <ChevronIcon open={isActive} />
      </button>
      {isActive && (
        <div
          className="absolute top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg"
          style={{
            width: width ?? 'auto',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
