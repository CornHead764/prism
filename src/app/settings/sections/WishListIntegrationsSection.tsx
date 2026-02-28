'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useSearchParams } from 'next/navigation';
import { useFamily } from '@/components/providers/FamilyProvider';
import {
  RefreshCw,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Link2,
  Gift,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface WishItemSource {
  id: string;
  userId: string;
  userName: string | null;
  provider: string;
  externalListId: string;
  externalListName: string | null;
  memberId: string;
  memberName: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

const PROVIDER_INFO: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
  microsoft_todo: {
    name: 'Microsoft To-Do',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#0078D4">
        <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
      </svg>
    ),
    color: '#0078D4',
  },
};

const ERROR_MESSAGES: Record<string, string> = {
  microsoft_auth_denied: 'Microsoft authorization was denied or cancelled.',
  microsoft_auth_failed: 'Microsoft authentication failed. Please try again.',
  missing_code: 'Authorization code was missing. Please try again.',
};

export function WishListIntegrationsSection() {
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();
  const searchParams = useSearchParams();
  const { members, loading: membersLoading } = useFamily();
  const [sources, setSources] = useState<WishItemSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [updatingSource, setUpdatingSource] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // MS To-Do list selection after OAuth
  const [showMsListModal, setShowMsListModal] = useState(false);
  const [msLists, setMsLists] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [loadingMsLists, setLoadingMsLists] = useState(false);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [finalizingConnection, setFinalizingConnection] = useState(false);

  // Provider picker modal
  const [showProviderPickerModal, setShowProviderPickerModal] = useState(false);
  const [connectingMemberId, setConnectingMemberId] = useState<string | null>(null);

  // Check URL params for OAuth results
  useEffect(() => {
    const error = searchParams.get('error');
    const section = searchParams.get('section');
    const selectMsList = searchParams.get('selectMsList');
    const wishMemberId = searchParams.get('wishMemberId');

    if (section === 'wish') {
      if (error) {
        setStatusMessage({
          type: 'error',
          text: ERROR_MESSAGES[error] || `Error: ${error}`,
        });
      } else if (selectMsList === 'true' && wishMemberId) {
        setPendingMemberId(wishMemberId);
        fetchMsLists(wishMemberId);
      }
    }
  }, [searchParams]);

  const fetchMsLists = async (memberId: string) => {
    setLoadingMsLists(true);
    try {
      const res = await fetch(`/api/task-sources/microsoft-lists?wishMemberId=${memberId}`);
      if (res.ok) {
        const data = await res.json();
        setMsLists(data.lists || []);
        setShowMsListModal(true);
      } else {
        const data = await res.json();
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to fetch Microsoft To-Do lists',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to fetch Microsoft To-Do lists',
      });
    } finally {
      setLoadingMsLists(false);
    }
  };

  const handleSelectMsList = async (externalListId: string, externalListName: string) => {
    if (!pendingMemberId) return;

    setFinalizingConnection(true);
    try {
      const res = await fetch('/api/wish-item-sources/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: pendingMemberId,
          externalListId,
          externalListName,
        }),
      });

      if (res.ok) {
        setShowMsListModal(false);
        setMsLists([]);
        setPendingMemberId(null);
        setStatusMessage({
          type: 'success',
          text: `Connected to "${externalListName}" in Microsoft To-Do!`,
        });
        await fetchSources();
        window.history.replaceState({}, '', '/settings?section=wish');
      } else {
        const data = await res.json();
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to complete connection',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to complete connection',
      });
    } finally {
      setFinalizingConnection(false);
    }
  };

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/wish-item-sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (error) {
      console.error('Failed to fetch wish item sources:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleToggleSync = async (sourceId: string, enabled: boolean) => {
    setUpdatingSource(sourceId);
    try {
      const res = await fetch(`/api/wish-item-sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled: enabled }),
      });
      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, syncEnabled: enabled } : s))
        );
      }
    } catch (error) {
      console.error('Failed to update source:', error);
    } finally {
      setUpdatingSource(null);
    }
  };

  const handleDeleteSource = async (sourceId: string, sourceName: string) => {
    if (!await confirm(`Disconnect "${sourceName}"?`, 'Items already synced will remain in Prism.')) {
      return;
    }

    setUpdatingSource(sourceId);
    try {
      const res = await fetch(`/api/wish-item-sources/${sourceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
      }
    } catch (error) {
      console.error('Failed to delete source:', error);
    } finally {
      setUpdatingSource(null);
    }
  };

  const handleSyncNow = async (sourceId: string) => {
    setSyncing(sourceId);
    try {
      const res = await fetch(`/api/wish-item-sources/${sourceId}/sync`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        await fetchSources();
        const msg = `Sync complete: ${data.created} created, ${data.updated} updated, ${data.deleted} deleted`;
        if (data.errors?.length > 0) {
          toast({ title: msg, description: data.errors.join('\n'), variant: 'warning' });
        }
      } else {
        toast({ title: `Sync failed: ${data.error || 'Unknown error'}`, variant: 'destructive' });
        await fetchSources();
      }
    } catch (error) {
      console.error('Failed to sync:', error);
      toast({ title: 'Sync failed: Network error', variant: 'destructive' });
    } finally {
      setSyncing(null);
    }
  };

  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    const enabledSources = sources.filter(s => s.syncEnabled);
    if (enabledSources.length === 0) return;

    setSyncingAll(true);
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;
    const allErrors: string[] = [];

    try {
      const results = await Promise.allSettled(
        enabledSources.map(async (source) => {
          const res = await fetch(`/api/wish-item-sources/${source.id}/sync`, {
            method: 'POST',
          });
          const data = await res.json();
          if (res.ok) {
            return { success: true, data, sourceName: source.externalListName };
          } else {
            return { success: false, error: data.error, sourceName: source.externalListName };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            totalCreated += result.value.data.created || 0;
            totalUpdated += result.value.data.updated || 0;
            totalDeleted += result.value.data.deleted || 0;
            if (result.value.data.errors?.length > 0) {
              allErrors.push(`${result.value.sourceName}: ${result.value.data.errors.join(', ')}`);
            }
          } else {
            allErrors.push(`${result.value.sourceName}: ${result.value.error || 'Unknown error'}`);
          }
        } else {
          allErrors.push(`Sync failed: ${result.reason}`);
        }
      }

      await fetchSources();

      const msg = `Sync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalDeleted} deleted`;
      if (allErrors.length > 0) {
        setStatusMessage({
          type: 'error',
          text: `${msg} (with errors)`,
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: msg,
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Sync all failed',
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleConnectProvider = (memberId: string) => {
    setConnectingMemberId(memberId);
    setShowProviderPickerModal(true);
  };

  const getProviderInfo = (provider: string) => {
    return PROVIDER_INFO[provider] || {
      name: provider,
      icon: <Gift className="h-5 w-5" />,
      color: '#6B7280',
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Wish List Sync</h2>
        <p className="text-muted-foreground">
          Sync family members&apos; wish lists with Microsoft To-Do
        </p>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={cn(
            'p-4 rounded-lg flex items-center gap-3',
            statusMessage.type === 'error'
              ? 'bg-destructive/10 text-destructive border border-destructive/20'
              : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
          )}
        >
          {statusMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="ml-auto text-sm underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connected Sources */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Sources</CardTitle>
              <CardDescription>
                External lists syncing with family wish lists
              </CardDescription>
            </div>
            {sources.filter(s => s.syncEnabled).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="gap-2"
              >
                <RefreshCw className={cn('h-4 w-4', syncingAll && 'animate-spin')} />
                {syncingAll ? 'Syncing...' : 'Sync All'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading sources...
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No wish list sources connected yet</p>
              <p className="text-sm mt-1">
                Connect a family member&apos;s wish list to Microsoft To-Do to keep it in sync
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => {
                const providerInfo = getProviderInfo(source.provider);
                const isSyncing = syncing === source.id;
                const isUpdating = updatingSource === source.id;

                return (
                  <div
                    key={source.id}
                    className={cn(
                      'p-4 rounded-lg border border-border',
                      !source.syncEnabled && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {providerInfo.icon}
                        <div>
                          <div className="font-medium">
                            {source.externalListName || 'Unnamed List'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {providerInfo.name}
                            {source.userName && (
                              <span className="ml-2">• {source.userName}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSyncNow(source.id)}
                          disabled={isSyncing || !source.syncEnabled}
                        >
                          <RefreshCw
                            className={cn('h-4 w-4', isSyncing && 'animate-spin')}
                          />
                        </Button>

                        <Switch
                          checked={source.syncEnabled}
                          onCheckedChange={(checked) => handleToggleSync(source.id, checked)}
                          disabled={isUpdating}
                        />

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            handleDeleteSource(
                              source.id,
                              source.externalListName || 'this source'
                            )
                          }
                          disabled={isUpdating}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>Member:</span>
                          <Badge variant="secondary" className="font-normal">
                            {source.memberName || 'Unknown'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {source.lastSyncError ? (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            Sync error
                          </span>
                        ) : source.lastSyncAt ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {new Date(source.lastSyncAt).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never synced</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family Members */}
      <Card>
        <CardHeader>
          <CardTitle>Family Members</CardTitle>
          <CardDescription>
            Connect each member&apos;s wish list to a Microsoft To-Do list
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading members...
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No family members found. Add members from the Family section.
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => {
                const connectedSource = sources.find(
                  (s) => s.memberId === member.id
                );

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-md border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Gift className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{member.name}</span>
                        {connectedSource && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="#0078D4">
                              <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
                            </svg>
                            <span>Synced with: {connectedSource.externalListName || 'MS To-Do'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!connectedSource && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnectProvider(member.id)}
                          className="gap-1"
                        >
                          <Link2 className="h-4 w-4" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Picker Modal */}
      <Dialog open={showProviderPickerModal} onOpenChange={setShowProviderPickerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Wish List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which service to sync with{' '}
              <strong>{members.find(m => m.id === connectingMemberId)?.name}&apos;s</strong> wish list
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowProviderPickerModal(false);
                  if (connectingMemberId) {
                    window.location.href = `/api/auth/microsoft-tasks?wishMemberId=${connectingMemberId}&returnSection=wish`;
                  }
                }}
                className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="#0078D4">
                  <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
                </svg>
                <div>
                  <span className="font-medium">Microsoft To-Do</span>
                  <p className="text-xs text-muted-foreground">
                    Sync wish items as tasks in a To-Do list
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowProviderPickerModal(false);
                setConnectingMemberId(null);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MS To-Do List Selection Modal */}
      <Dialog open={showMsListModal} onOpenChange={(open) => {
        if (!open) {
          setShowMsListModal(false);
          setMsLists([]);
          setPendingMemberId(null);
          window.history.replaceState({}, '', '/settings?section=wish');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Microsoft To-Do List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which Microsoft To-Do list to sync with this member&apos;s wish list
            </p>
            {loadingMsLists ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading lists from Microsoft To-Do...
              </div>
            ) : msLists.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No lists found in Microsoft To-Do
              </div>
            ) : (
              <div className="space-y-2">
                {msLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => handleSelectMsList(list.id, list.name)}
                    disabled={finalizingConnection}
                    className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left disabled:opacity-50"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="#0078D4">
                      <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
                    </svg>
                    <span className="font-medium">{list.name}</span>
                    {list.isDefault && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Default
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMsListModal(false);
                setMsLists([]);
                setPendingMemberId(null);
                window.history.replaceState({}, '', '/settings?section=wish');
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
