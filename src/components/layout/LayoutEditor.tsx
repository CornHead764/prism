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
  onSave: (name?: string) => void;
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

function validateImport(data: unknown): LayoutExportV2 | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj.type !== 'prism-layout') return null;
  if (typeof obj.version !== 'number') return null;
  if (obj.mode !== 'dashboard' && obj.mode !== 'screensaver') return null;
  if (!Array.isArray(obj.widgets)) return null;
  for (const w of obj.widgets) {
    if (!w || typeof w !== 'object') return null;
    const wObj = w as Record<string, unknown>;
    if (typeof wObj.i !== 'string' || typeof wObj.x !== 'number' ||
        typeof wObj.y !== 'number' || typeof wObj.w !== 'number' ||
        typeof wObj.h !== 'number') return null;
  }
  return obj as unknown as LayoutExportV2;
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
  gridVisibleRows = 12,
  gridScrollX = 0,
  gridVisibleCols = 12,
  gridTotalRows: _gridTotalRows = 24,
  gridTotalCols: _gridTotalCols = 12,
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
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [exportFeedback, setExportFeedback] = useState('');
  const [saveFeedback, setSaveFeedback] = useState('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', startFrom: 'template' as 'blank' | 'template' | 'copy' });
  const [shareForm, setShareForm] = useState({
    name: '',
    description: '',
    author: '',
    screenSizes: [] as string[],
    orientation: 'landscape' as 'landscape' | 'portrait',
    tags: '',
  });
  const [shareErrors, setShareErrors] = useState<string[]>([]);
  const [focusedWidget, setFocusedWidget] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

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
    setImportText('');
    setImportError('');
    setShowImportDialog(true);
    setActivePopover(null);
  };

  const handleImportApply = () => {
    try {
      const parsed = JSON.parse(importText);
      const validated = validateImport(parsed);
      if (!validated) {
        setImportError('Invalid layout format. Expected a Prism layout export.');
        return;
      }
      const expectedMode = editingScreensaver ? 'screensaver' : 'dashboard';
      if (validated.mode !== expectedMode) {
        setImportError(`This is a ${validated.mode} layout, but you're editing the ${expectedMode}. Switch modes first.`);
        return;
      }
      const importedWidgets = validated.widgets.map(w => ({
        i: w.i,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        visible: true,
        ...(w.backgroundColor && { backgroundColor: w.backgroundColor }),
        ...(w.backgroundOpacity !== undefined && { backgroundOpacity: w.backgroundOpacity }),
      }));
      if (editingScreensaver && onSelectScreensaverPreset) {
        onSelectScreensaverPreset(importedWidgets);
      } else {
        onWidgetsChange(importedWidgets);
      }
      setShowImportDialog(false);
    } catch {
      setImportError('Invalid JSON. Please paste a valid layout export.');
    }
  };

  const handleSave = () => {
    if (editingScreensaver) {
      onScreensaverSave?.();
    } else {
      onSave();
    }
    setSaveFeedback('Saved!');
    setTimeout(() => setSaveFeedback(''), 2000);
  };

  const handleShareOpen = () => {
    setShareForm({
      name: layoutName || '',
      description: '',
      author: '',
      screenSizes: [],
      orientation: 'landscape',
      tags: '',
    });
    setShareErrors([]);
    setShowShareDialog(true);
    setActivePopover(null);
  };

  const handleShareSubmit = () => {
    const exportData = buildExportData();
    const submissionData = {
      ...exportData,
      name: shareForm.name,
      description: shareForm.description,
      author: shareForm.author,
      screenSizes: shareForm.screenSizes,
      orientation: shareForm.orientation,
      tags: shareForm.tags.split(',').map(t => t.trim()).filter(Boolean),
    };

    const result = validateCommunityLayout(submissionData, { communitySubmission: true });
    if (!result.valid) {
      setShareErrors(result.errors);
      return;
    }

    const title = encodeURIComponent(`Community Layout: ${shareForm.name}`);
    const body = encodeURIComponent(
      '```json\n' + JSON.stringify(submissionData, null, 2) + '\n```\n\n' +
      `**Author:** ${shareForm.author}\n` +
      `**Screen Sizes:** ${shareForm.screenSizes.join(', ')}\n` +
      `**Orientation:** ${shareForm.orientation}\n`
    );
    const url = `https://github.com/sandydargoport/prism/issues/new?labels=layout-submission&title=${title}&body=${body}`;
    window.open(url, '_blank');
    setShowShareDialog(false);
  };

  const handleRename = () => {
    const newName = window.prompt('Rename dashboard:', layoutName || '');
    if (newName && newName !== layoutName) {
      onRenameDashboard?.(newName);
    }
    setActivePopover(null);
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
    setCreateForm({ name: '', startFrom: 'template' });
    setShowCreateDialog(true);
    setActivePopover(null);
  };

  const handleCreateSubmit = () => {
    if (!createForm.name.trim()) return;
    onCreateDashboard?.(createForm.name.trim(), createForm.startFrom);
    setShowCreateDialog(false);
  };

  const btnClass = "px-2 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors";
  const moreItemClass = "w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors";

  return (
    <>
      <div ref={toolbarRef} className="relative z-50 bg-card/85 backdrop-blur-sm border-b border-border px-4 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left group */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <EditIcon />

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
                          onSwitchDashboard?.(dashboard.slug);
                        } else if (dashboard.id !== currentDashboardId && dashboard.isDefault) {
                          // Default dashboard uses /
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
              {screenGuideOrientation === 'landscape' ? '\u2B1C Land' : '\u25AF Port'}
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

            {/* Save split button */}
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
                    onClick={() => { (editingScreensaver ? onScreensaverSaveAs : onSaveAs)?.(); setActivePopover(null); }}
                    className={moreItemClass}
                  >
                    Save As...
                  </button>
                </div>
              )}
            </div>

            {/* More dropdown */}
            <PopoverButton
              label="More"
              isActive={activePopover === 'more'}
              onToggle={() => togglePopover('more')}
              width={180}
              align="right"
            >
              <div className="py-1">
                {!editingScreensaver && onRenameDashboard && (
                  <button onClick={handleRename} className={moreItemClass}>
                    Rename Dashboard...
                  </button>
                )}
                {!editingScreensaver && onDeleteDashboard && (
                  <button
                    onClick={handleDelete}
                    className={`${moreItemClass} ${allDashboards.length <= 1 ? 'text-muted-foreground cursor-not-allowed' : 'text-destructive'}`}
                    disabled={allDashboards.length <= 1}
                  >
                    Delete Dashboard
                  </button>
                )}
                {!editingScreensaver && (onRenameDashboard || onDeleteDashboard) && (
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

      {/* Create Dashboard modal */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-medium">New Dashboard</div>
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kitchen Display"
                className="w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                maxLength={100}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleCreateSubmit(); }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Start from</label>
              <div className="flex gap-2">
                {([
                  { value: 'template' as const, label: 'Default Template' },
                  { value: 'copy' as const, label: 'Copy Current' },
                  { value: 'blank' as const, label: 'Blank' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCreateForm(f => ({ ...f, startFrom: opt.value }))}
                    className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                      createForm.startFrom === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted border-border hover:bg-accent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={!createForm.name.trim()}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import modal */}
      {showImportDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowImportDialog(false)}>
          <div className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-lg w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-medium">Import Layout</div>
            <textarea
              className="w-full h-32 text-xs font-mono bg-muted text-foreground border border-border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder='Paste exported layout JSON here...'
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
            />
            {importError && (
              <p className="text-xs text-destructive">{importError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportApply}
                disabled={!importText.trim()}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share to Community modal */}
      {showShareDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setShowShareDialog(false)}>
          <div className="bg-popover border border-border rounded-lg shadow-xl p-4 max-w-2xl w-full mx-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-medium">Share to Community</div>
            <p className="text-xs text-muted-foreground">
              Submit your layout to the Prism community gallery. This opens a GitHub Issue with your layout data.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Layout Name *</label>
                <input
                  type="text"
                  value={shareForm.name}
                  onChange={e => setShareForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-2 py-1 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Author Name *</label>
                <input
                  type="text"
                  value={shareForm.author}
                  onChange={e => setShareForm(f => ({ ...f, author: e.target.value }))}
                  className="w-full px-2 py-1 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  maxLength={50}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description *</label>
              <input
                type="text"
                value={shareForm.description}
                onChange={e => setShareForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-2 py-1 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Target Resolutions *</label>
                <div className="flex gap-1 flex-wrap items-center">
                  {['1920x1080', '2560x1440', '3840x2160', '2560x1600', '2048x1536', '1366x768'].map(size => (
                    <button
                      key={size}
                      onClick={() => setShareForm(f => ({
                        ...f,
                        screenSizes: f.screenSizes.includes(size)
                          ? f.screenSizes.filter(s => s !== size)
                          : [...f.screenSizes, size],
                      }))}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                        shareForm.screenSizes.includes(size)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted border-border hover:bg-accent'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder="Custom (e.g. 2736x1824)"
                    className="px-2 py-0.5 text-xs bg-muted border border-border rounded-full w-[155px] focus:outline-none focus:ring-1 focus:ring-primary"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (/^\d{3,5}x\d{3,5}$/.test(val) && !shareForm.screenSizes.includes(val)) {
                          setShareForm(f => ({ ...f, screenSizes: [...f.screenSizes, val] }));
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                </div>
                {shareForm.screenSizes.filter(s => !['1920x1080', '2560x1440', '3840x2160', '2560x1600', '2048x1536', '1366x768'].includes(s)).length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {shareForm.screenSizes.filter(s => !['1920x1080', '2560x1440', '3840x2160', '2560x1600', '2048x1536', '1366x768'].includes(s)).map(size => (
                      <button
                        key={size}
                        onClick={() => setShareForm(f => ({ ...f, screenSizes: f.screenSizes.filter(s => s !== size) }))}
                        className="px-2 py-0.5 text-xs rounded-full border bg-primary text-primary-foreground border-primary transition-colors"
                      >
                        {size} &times;
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Orientation *</label>
                <div className="flex gap-1">
                  {(['landscape', 'portrait'] as const).map(orient => (
                    <button
                      key={orient}
                      onClick={() => setShareForm(f => ({ ...f, orientation: orient }))}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                        shareForm.orientation === orient
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted border-border hover:bg-accent'
                      }`}
                    >
                      {orient}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tags (comma-separated)</label>
              <input
                type="text"
                value={shareForm.tags}
                onChange={e => setShareForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g. family, minimal, kitchen"
                className="w-full px-2 py-1 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {shareErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2">
                {shareErrors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">{err}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowShareDialog(false)}
                className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShareSubmit}
                className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Open GitHub Issue
              </button>
            </div>
          </div>
        </div>
      )}
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
