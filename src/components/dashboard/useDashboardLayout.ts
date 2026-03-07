'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { DEFAULT_TEMPLATE } from '@/lib/constants/layoutTemplates';
import {
  loadScreensaverLayout,
  saveScreensaverLayout,
  DEFAULT_SCREENSAVER_LAYOUT,
  getScreensaverPresets,
  saveScreensaverPreset,
  deleteScreensaverPreset,
} from '@/components/screensaver/screensaverStorage';
import type { WidgetConfig, Layout } from '@/lib/hooks/useLayouts';

interface LayoutsData {
  savedLayout: Layout | null;
  saveLayout: (data: Partial<Layout> & { name: string; widgets: WidgetConfig[] }) => Promise<unknown>;
  deleteLayout: (id: string) => Promise<void>;
  allLayouts: Layout[];
}

export function useDashboardLayout(layouts: LayoutsData, slug?: string) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingWidgets, setEditingWidgets] = useState<WidgetConfig[]>([]);
  const preEditWidgetsRef = useRef<WidgetConfig[]>([]);
  const [editingScreensaver, setEditingScreensaver] = useState(false);

  // Resolve active layout: by slug if provided, otherwise default
  const activeLayout = slug
    ? layouts.allLayouts.find(l => l.slug === slug) || null
    : layouts.savedLayout;

  const [ssLayout, setSsLayout] = useState<WidgetConfig[]>(() => {
    // Initialize from DB if available, otherwise from localStorage
    if (activeLayout?.screensaverWidgets) return activeLayout.screensaverWidgets;
    return loadScreensaverLayout();
  });
  const [ssPresets, setSsPresets] = useState(() =>
    typeof window !== 'undefined' ? getScreensaverPresets() : []
  );

  // Bridge: write active dashboard's screensaver to localStorage on layout change
  // so the global Screensaver component (which reads from localStorage) uses the right one
  const bridgedLayoutId = useRef<string | null>(null);
  useEffect(() => {
    if (!activeLayout) return;
    if (bridgedLayoutId.current === activeLayout.id) return;
    bridgedLayoutId.current = activeLayout.id;

    if (activeLayout.screensaverWidgets) {
      setSsLayout(activeLayout.screensaverWidgets);
      saveScreensaverLayout(activeLayout.screensaverWidgets);
    } else {
      // First load: migrate localStorage screensaver to this dashboard
      const fromLocal = loadScreensaverLayout();
      setSsLayout(fromLocal);
    }
  }, [activeLayout]);

  // Re-enter edit mode after dashboard switch (sessionStorage flag)
  useEffect(() => {
    if (activeLayout && typeof window !== 'undefined') {
      const flag = sessionStorage.getItem('prism:editing');
      if (flag) {
        sessionStorage.removeItem('prism:editing');
        const current = activeLayout.widgets ?? DEFAULT_TEMPLATE.widgets;
        preEditWidgetsRef.current = current;
        setEditingWidgets(current);
        setIsEditing(true);
      }
    }
  }, [activeLayout]);

  const activeWidgets = isEditing
    ? editingWidgets
    : activeLayout?.widgets ?? DEFAULT_TEMPLATE.widgets;

  const handleEditStart = useCallback(() => {
    const current = activeLayout?.widgets ?? DEFAULT_TEMPLATE.widgets;
    preEditWidgetsRef.current = current;
    setEditingWidgets(current);
    setIsEditing(true);
  }, [activeLayout]);

  const handleSave = useCallback(async (name?: string) => {
    try {
      const saveData: Partial<Layout> & { name: string; widgets: WidgetConfig[] } = {
        ...(activeLayout ? { id: activeLayout.id } : {}),
        name: name || activeLayout?.name || 'My Layout',
        widgets: editingWidgets,
        isDefault: activeLayout?.isDefault ?? true,
        screensaverWidgets: ssLayout,
        orientation: activeLayout?.orientation || 'landscape',
      };
      await layouts.saveLayout(saveData);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }, [activeLayout, editingWidgets, ssLayout, layouts]);

  const handleSaveAs = useCallback(async (defaultName?: string) => {
    const name = window.prompt('Layout name:', defaultName || 'New Layout');
    if (!name) return;
    try {
      await layouts.saveLayout({
        name,
        widgets: editingWidgets,
        isDefault: true,
        screensaverWidgets: ssLayout,
        orientation: activeLayout?.orientation || 'landscape',
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  }, [editingWidgets, ssLayout, activeLayout, layouts]);

  const handleReset = useCallback(() => {
    setEditingWidgets(DEFAULT_TEMPLATE.widgets);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingWidgets(preEditWidgetsRef.current);
    setIsEditing(false);
  }, []);

  // Screensaver callbacks — save to both DB (via layout) and localStorage
  const handleSsLayoutChange = useCallback((newLayout: WidgetConfig[]) => {
    setSsLayout(newLayout);
    saveScreensaverLayout(newLayout);
  }, []);

  const handleSsWidgetToggle = useCallback((widgetType: string, visible: boolean) => {
    setSsLayout(prev => {
      const exists = prev.find(w => w.i === widgetType);
      let updated: WidgetConfig[];
      if (exists) {
        updated = prev.map(w => w.i === widgetType ? { ...w, visible } : w);
      } else if (visible) {
        const maxY = Math.max(0, ...prev.map(w => w.y + w.h));
        updated = [...prev, { i: widgetType, x: 0, y: maxY, w: 3, h: 3, visible: true }];
      } else {
        return prev;
      }
      saveScreensaverLayout(updated);
      return updated;
    });
  }, []);

  const handleSsSave = useCallback(async () => {
    // Save screensaver to DB by updating the current layout
    saveScreensaverLayout(ssLayout);
    if (activeLayout) {
      try {
        await layouts.saveLayout({
          id: activeLayout.id,
          name: activeLayout.name,
          widgets: activeLayout.widgets,
          isDefault: activeLayout.isDefault,
          screensaverWidgets: ssLayout,
        });
      } catch (err) {
        console.error('Failed to save screensaver to DB:', err);
      }
    }
    setIsEditing(false);
  }, [ssLayout, activeLayout, layouts]);

  const handleSsSaveAs = useCallback(() => {
    const name = window.prompt('Preset name:', 'My Screensaver');
    if (!name) return;
    saveScreensaverPreset(name, ssLayout);
    setSsPresets(getScreensaverPresets());
  }, [ssLayout]);

  const handleSsReset = useCallback(() => {
    const fresh = DEFAULT_SCREENSAVER_LAYOUT.map(w => ({ ...w }));
    setSsLayout(fresh);
    saveScreensaverLayout(fresh);
  }, []);

  const handleSelectSsTemplate = useCallback((templateWidgets: WidgetConfig[]) => {
    const visibleIds = new Set(templateWidgets.filter(w => w.visible !== false).map(w => w.i));
    const merged = DEFAULT_SCREENSAVER_LAYOUT.map(def => {
      const tw = templateWidgets.find(t => t.i === def.i);
      if (tw) return { ...tw, visible: true };
      return { ...def, visible: false };
    });
    templateWidgets.forEach(tw => {
      if (!merged.find(m => m.i === tw.i)) {
        merged.push({ ...tw, visible: visibleIds.has(tw.i) });
      }
    });
    setSsLayout(merged);
    saveScreensaverLayout(merged);
  }, []);

  const handleSelectSsPreset = useCallback((presetWidgets: WidgetConfig[]) => {
    setSsLayout(presetWidgets);
    saveScreensaverLayout(presetWidgets);
  }, []);

  const handleDeleteSsPreset = useCallback((name: string) => {
    deleteScreensaverPreset(name);
    setSsPresets(getScreensaverPresets());
  }, []);

  return {
    isEditing, setIsEditing,
    editingWidgets, setEditingWidgets,
    editingScreensaver, setEditingScreensaver,
    ssLayout, ssPresets,
    activeWidgets,
    activeLayout,
    handleEditStart, handleSave, handleSaveAs, handleReset, handleCancel,
    handleSsLayoutChange, handleSsWidgetToggle, handleSsSave, handleSsSaveAs,
    handleSsReset, handleSelectSsTemplate, handleSelectSsPreset, handleDeleteSsPreset,
  };
}
