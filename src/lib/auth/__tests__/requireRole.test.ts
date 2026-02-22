import { requireRole } from '../requireAuth';
import type { AuthResult } from '../requireAuth';
import { NextResponse } from 'next/server';

const parentAuth: AuthResult = { userId: 'user-1', role: 'parent' };
const childAuth: AuthResult = { userId: 'user-2', role: 'child' };
const guestAuth: AuthResult = { userId: 'user-3', role: 'guest' };

describe('requireRole', () => {
  describe('parent permissions', () => {
    it('allows parent all permissions', () => {
      expect(requireRole(parentAuth, 'canModifySettings')).toBeNull();
      expect(requireRole(parentAuth, 'canApproveChores')).toBeNull();
      expect(requireRole(parentAuth, 'canManageUsers')).toBeNull();
      expect(requireRole(parentAuth, 'canDeleteAnyEvent')).toBeNull();
      expect(requireRole(parentAuth, 'canToggleAwayMode')).toBeNull();
      expect(requireRole(parentAuth, 'canManageGoals')).toBeNull();
      expect(requireRole(parentAuth, 'canManageIntegrations')).toBeNull();
    });
  });

  describe('child permissions', () => {
    it('allows child basic actions', () => {
      expect(requireRole(childAuth, 'canViewAllCalendars')).toBeNull();
      expect(requireRole(childAuth, 'canAddEvent')).toBeNull();
      expect(requireRole(childAuth, 'canCompleteTasks')).toBeNull();
      expect(requireRole(childAuth, 'canCompleteChores')).toBeNull();
      expect(requireRole(childAuth, 'canPostMessages')).toBeNull();
    });

    it('denies child admin actions', () => {
      expect(requireRole(childAuth, 'canModifySettings')).toBeInstanceOf(NextResponse);
      expect(requireRole(childAuth, 'canApproveChores')).toBeInstanceOf(NextResponse);
      expect(requireRole(childAuth, 'canManageUsers')).toBeInstanceOf(NextResponse);
      expect(requireRole(childAuth, 'canDeleteAnyEvent')).toBeInstanceOf(NextResponse);
      expect(requireRole(childAuth, 'canToggleAwayMode')).toBeInstanceOf(NextResponse);
      expect(requireRole(childAuth, 'canManageGoals')).toBeInstanceOf(NextResponse);
      expect(requireRole(childAuth, 'canManageIntegrations')).toBeInstanceOf(NextResponse);
    });
  });

  describe('guest permissions', () => {
    it('allows guest to view calendars', () => {
      expect(requireRole(guestAuth, 'canViewAllCalendars')).toBeNull();
    });

    it('denies guest all write actions', () => {
      expect(requireRole(guestAuth, 'canAddEvent')).toBeInstanceOf(NextResponse);
      expect(requireRole(guestAuth, 'canCompleteTasks')).toBeInstanceOf(NextResponse);
      expect(requireRole(guestAuth, 'canPostMessages')).toBeInstanceOf(NextResponse);
      expect(requireRole(guestAuth, 'canModifySettings')).toBeInstanceOf(NextResponse);
      expect(requireRole(guestAuth, 'canManageUsers')).toBeInstanceOf(NextResponse);
    });
  });

  describe('return format', () => {
    it('returns null on success (permission granted)', () => {
      const result = requireRole(parentAuth, 'canModifySettings');
      expect(result).toBeNull();
    });

    it('returns NextResponse with 403 on failure', async () => {
      const result = requireRole(guestAuth, 'canModifySettings');
      expect(result).toBeInstanceOf(NextResponse);
      const body = await result!.json();
      expect(body.error).toBe('Forbidden');
      expect(result!.status).toBe(403);
    });
  });
});
