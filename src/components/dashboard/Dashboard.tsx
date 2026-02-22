'use client';

import * as React from 'react';
import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardGrid, DashboardLayout, DashboardHeader } from '@/components/layout/DashboardGrid';
import { LayoutGridEditor, SCREENSAVER_THEME } from '@/components/layout/LayoutGridEditor';
import { LayoutEditor } from '@/components/layout/LayoutEditor';
import { useAuth } from '@/components/providers';
import { useScreenSafeZones } from '@/lib/hooks/useScreenSafeZones';
import { AddTaskModal, AddMessageModal, AddChoreModal, AddShoppingItemModal } from '@/components/modals';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import { renderScreensaverPreview } from '@/components/screensaver/ScreensaverWidgetPreview';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { WidgetErrorBoundary } from '@/components/dashboard/WidgetErrorBoundary';
import { useDashboardData } from './useDashboardData';
import { useDashboardLayout } from './useDashboardLayout';
import { buildWidgetProps } from './useWidgetProps';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';

class WidgetBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, background: '#300', color: '#f88', fontSize: 12, overflow: 'auto' }}>
          <strong>{this.props.name} crashed:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface DashboardProps {
  weatherLocation?: string;
  className?: string;
  slug?: string;
}

export function Dashboard({
  weatherLocation = 'Springfield, IL',
  className,
  slug,
}: DashboardProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const { activeUser, requireAuth, clearActiveUser } = useAuth();
  const { confirm: confirmAction, dialogProps: confirmDialogProps } = useConfirmDialog();
  const data = useDashboardData();

  const [showAddMessage, setShowAddMessage] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddChore, setShowAddChore] = useState(false);
  const [showAddShopping, setShowAddShopping] = useState(false);

  const layout = useDashboardLayout(data.layouts, slug);

  // Redirect to / if slug doesn't resolve to a layout (after layouts have loaded)
  useEffect(() => {
    if (slug && !data.layouts.loading && data.layouts.allLayouts.length > 0 && !layout.activeLayout) {
      router.replace('/');
    }
  }, [slug, data.layouts.loading, data.layouts.allLayouts.length, layout.activeLayout, router]);

  // Grid control state shared between LayoutEditor toolbar and LayoutGridEditor
  const { allSizeNames } = useScreenSafeZones();

  // Orientation from active layout (DB), fallback to landscape
  const [screenGuideOrientation, setScreenGuideOrientationState] = useState<'landscape' | 'portrait'>(() => {
    const fromLayout = layout.activeLayout?.orientation;
    if (fromLayout === 'portrait' || fromLayout === 'landscape') return fromLayout;
    return 'landscape';
  });

  // Sync orientation when active layout changes
  useEffect(() => {
    const fromLayout = layout.activeLayout?.orientation;
    if (fromLayout === 'portrait' || fromLayout === 'landscape') {
      setScreenGuideOrientationState(fromLayout);
    }
  }, [layout.activeLayout?.orientation]);

  const setScreenGuideOrientation = useCallback(async (o: 'landscape' | 'portrait') => {
    setScreenGuideOrientationState(o);
    // Persist to DB
    if (layout.activeLayout) {
      try {
        await data.layouts.saveLayout({
          id: layout.activeLayout.id,
          name: layout.activeLayout.name,
          widgets: layout.activeLayout.widgets,
          orientation: o,
        });
      } catch { /* ignore */ }
    }
  }, [layout.activeLayout, data.layouts]);

  const [enabledSizes, setEnabledSizes] = useState<string[]>(allSizeNames);
  const [gridScrollY, setGridScrollY] = useState(0);
  const [gridVisibleRows, setGridVisibleRows] = useState(12);
  const [gridScrollX, setGridScrollX] = useState(0);
  const [gridVisibleCols, setGridVisibleCols] = useState(12);
  const [gridTotalRows, setGridTotalRows] = useState(24);
  const [gridTotalCols, setGridTotalCols] = useState(12);
  const scrollToGridRef = useRef<((row: number, col?: number) => void) | null>(null);

  const handleScrollInfo = useCallback((info: { scrollY: number; visibleRows: number; scrollX: number; visibleCols: number; totalRows: number; totalCols: number }) => {
    setGridScrollY(info.scrollY);
    setGridVisibleRows(info.visibleRows);
    setGridScrollX(info.scrollX);
    setGridVisibleCols(info.visibleCols);
    setGridTotalRows(info.totalRows);
    setGridTotalCols(info.totalCols);
  }, []);

  const handleToggleSize = useCallback((size: string) => {
    setEnabledSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    );
  }, []);

  // Dashboard management callbacks for LayoutEditor
  const handleSwitchDashboard = useCallback((targetSlug: string) => {
    router.push(`/d/${targetSlug}`);
  }, [router]);

  const handleCreateDashboard = useCallback(async (name: string, startFrom: 'blank' | 'template' | 'copy') => {
    const { DEFAULT_TEMPLATE } = await import('@/lib/constants/layoutTemplates');
    let widgets: WidgetConfig[];
    if (startFrom === 'copy' && layout.activeLayout) {
      widgets = layout.activeLayout.widgets;
    } else if (startFrom === 'template') {
      widgets = DEFAULT_TEMPLATE.widgets;
    } else {
      // Blank: single clock widget
      widgets = [{ i: 'clock', x: 4, y: 4, w: 4, h: 4, visible: true }];
    }
    try {
      const result = await data.layouts.saveLayout({ name, widgets, isDefault: false });
      const saved = result as { slug?: string };
      if (saved?.slug) {
        router.push(`/d/${saved.slug}`);
      }
    } catch (err) {
      console.error('Failed to create dashboard:', err);
    }
  }, [layout.activeLayout, data.layouts, router]);

  const handleRenameDashboard = useCallback(async (newName: string) => {
    if (!layout.activeLayout) return;
    try {
      await data.layouts.saveLayout({
        id: layout.activeLayout.id,
        name: newName,
        widgets: layout.activeLayout.widgets,
      });
    } catch (err) {
      console.error('Failed to rename dashboard:', err);
    }
  }, [layout.activeLayout, data.layouts]);

  const handleDeleteDashboard = useCallback(async () => {
    if (!layout.activeLayout) return;
    try {
      await data.layouts.deleteLayout(layout.activeLayout.id);
      router.push('/');
    } catch (err) {
      console.error('Failed to delete dashboard:', err);
    }
  }, [layout.activeLayout, data.layouts, router]);

  const widgetProps = buildWidgetProps(data, requireAuth, {
    setShowAddTask, setShowAddMessage, setShowAddChore, setShowAddShopping,
  }, weatherLocation, confirmAction);

  const handleLogin = async () => {
    await requireAuth('Login', 'Select your profile');
  };

  const dashboardConstraints = useMemo(() => {
    const constraints: Record<string, { minW?: number; minH?: number }> = {};
    for (const [key, reg] of Object.entries(WIDGET_REGISTRY)) {
      constraints[key] = { minW: reg.minW, minH: reg.minH };
    }
    return constraints;
  }, []);

  const renderDashboardWidget = useCallback((w: WidgetConfig) => {
    const reg = WIDGET_REGISTRY[w.i];
    if (!reg) {
      return <div style={{ background: '#330', color: '#ff0', padding: 8 }}>Unknown widget: {w.i}</div>;
    }
    const Component = reg.component;
    const props = { ...widgetProps[w.i] || {}, gridW: w.w, gridH: w.h };
    return (
      <WidgetBoundary name={w.i}>
        <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading...</div>}>
          <Component {...props} />
        </Suspense>
      </WidgetBoundary>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const renderSsWidget = useCallback((w: WidgetConfig) => {
    // Use actual widgets with real data in the screensaver designer
    const reg = WIDGET_REGISTRY[w.i];
    if (!reg) {
      return renderScreensaverPreview(w);
    }
    const Component = reg.component;
    const props = { ...widgetProps[w.i] || {}, gridW: w.w, gridH: w.h };
    return (
      <WidgetBoundary name={w.i}>
        <Suspense fallback={<div className="flex items-center justify-center h-full text-white/50 text-sm">Loading...</div>}>
          <div className="h-full w-full [&_*]:!bg-transparent [&_.bg-card]:!bg-white/10 [&_.border-border]:!border-white/20">
            <Component {...props} />
          </div>
        </Suspense>
      </WidgetBoundary>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <AppShell
      user={activeUser ? { id: activeUser.id, name: activeUser.name, avatarUrl: activeUser.avatarUrl, color: activeUser.color } : undefined}
      onLogout={activeUser ? clearActiveUser : undefined}
      onLogin={handleLogin}
      showWallpaper
    >
      <DashboardLayout className={className}>
        <DashboardHeader
          onScreensaverClick={() => window.dispatchEvent(new Event('prism:screensaver'))}
          onEditClick={activeUser?.role === 'parent' ? layout.handleEditStart : undefined}
        />

        {layout.isEditing && (
          <LayoutEditor
            widgets={layout.editingWidgets}
            onWidgetsChange={layout.setEditingWidgets}
            onSave={layout.handleSave}
            onSaveAs={layout.handleSaveAs}
            onReset={layout.handleReset}
            onCancel={() => { layout.setEditingScreensaver(false); layout.handleCancel(); }}
            onDeleteLayout={data.layouts.deleteLayout}
            layoutName={layout.activeLayout?.name}
            savedLayouts={data.layouts.allLayouts.map(l => ({ id: l.id, name: l.name, widgets: l.widgets }))}
            editingScreensaver={layout.editingScreensaver}
            onToggleScreensaverEdit={() => layout.setEditingScreensaver(!layout.editingScreensaver)}
            screensaverWidgets={layout.ssLayout}
            onScreensaverWidgetToggle={layout.handleSsWidgetToggle}
            onScreensaverSave={layout.handleSsSave}
            onScreensaverSaveAs={layout.handleSsSaveAs}
            onScreensaverReset={layout.handleSsReset}
            onSelectScreensaverTemplate={layout.handleSelectSsTemplate}
            screensaverPresets={layout.ssPresets}
            onSelectScreensaverPreset={layout.handleSelectSsPreset}
            onDeleteScreensaverPreset={layout.handleDeleteSsPreset}
            screenGuideOrientation={screenGuideOrientation}
            onScreenGuideOrientationChange={setScreenGuideOrientation}
            enabledSizes={enabledSizes}
            onToggleSize={handleToggleSize}
            gridScrollY={gridScrollY}
            gridVisibleRows={gridVisibleRows}
            gridScrollX={gridScrollX}
            gridVisibleCols={gridVisibleCols}
            gridTotalRows={gridTotalRows}
            gridTotalCols={gridTotalCols}
            scrollToGridRef={scrollToGridRef}
            allDashboards={data.layouts.allLayouts.map(l => ({ id: l.id, name: l.name, slug: l.slug, isDefault: l.isDefault }))}
            currentDashboardId={layout.activeLayout?.id}
            onSwitchDashboard={handleSwitchDashboard}
            onCreateDashboard={handleCreateDashboard}
            onRenameDashboard={handleRenameDashboard}
            onDeleteDashboard={handleDeleteDashboard}
          />
        )}

        {layout.editingScreensaver && layout.isEditing ? (
          <LayoutGridEditor
            layout={layout.ssLayout}
            onLayoutChange={layout.handleSsLayoutChange}
            isEditable
            renderWidget={renderSsWidget}
            margin={4}
            headerOffset={100}
            minVisibleRows={8}
            theme={SCREENSAVER_THEME}
            gridHelperText="Drag widgets to reposition &bull; Scroll to see more"
            className="mx-4"
            screenGuideOrientation={screenGuideOrientation}
            enabledSizes={enabledSizes}
            onScrollInfo={handleScrollInfo}
            scrollToRef={scrollToGridRef}
          />
        ) : !isMounted ? (
          <DashboardGrid>
            <div className="col-span-4 flex items-center justify-center h-64 text-muted-foreground">Loading widgets...</div>
          </DashboardGrid>
        ) : (
          <WidgetErrorBoundary>
            <LayoutGridEditor
              layout={layout.activeWidgets}
              onLayoutChange={layout.isEditing ? layout.setEditingWidgets : () => {}}
              isEditable={layout.isEditing}
              renderWidget={renderDashboardWidget}
              widgetConstraints={dashboardConstraints}
              margin={8}
              headerOffset={140}
              screenGuideOrientation={screenGuideOrientation}
              enabledSizes={enabledSizes}
              onScrollInfo={handleScrollInfo}
              scrollToRef={scrollToGridRef}
            />
          </WidgetErrorBoundary>
        )}

        {showAddTask && (
          <AddTaskModal open={showAddTask} onOpenChange={setShowAddTask}
            onTaskCreated={() => { data.tasks.refresh(); }} />
        )}
        {showAddMessage && (
          <AddMessageModal open={showAddMessage} onOpenChange={setShowAddMessage}
            currentUser={activeUser ? { id: activeUser.id, name: activeUser.name, color: activeUser.color, avatarUrl: activeUser.avatarUrl } : undefined}
            onMessageCreated={() => { data.messages.refresh(); }} />
        )}
        {showAddChore && (
          <AddChoreModal open={showAddChore} onOpenChange={setShowAddChore}
            onChoreCreated={() => { data.chores.refresh(); }} />
        )}
        {showAddShopping && (
          <AddShoppingItemModal open={showAddShopping} onOpenChange={setShowAddShopping}
            onItemCreated={() => { data.shopping.refresh(); }} />
        )}
      </DashboardLayout>
      <ConfirmDialog {...confirmDialogProps} />
    </AppShell>
  );
}
