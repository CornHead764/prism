import { microsoftTodoShoppingProvider } from '../microsoft-todo';
import type { ShoppingProviderTokens } from '../types';

const TOKENS: ShoppingProviderTokens = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: new Date('2026-12-31'),
};

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe('microsoftTodoShoppingProvider', () => {
  it('has correct provider metadata', () => {
    expect(microsoftTodoShoppingProvider.providerId).toBe('microsoft_todo');
    expect(microsoftTodoShoppingProvider.displayName).toBe('Microsoft To-Do');
  });

  describe('fetchLists', () => {
    it('returns lists mapped from Graph API response', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        value: [
          { id: 'list-1', displayName: 'Groceries', isOwner: true, isShared: false, wellknownListName: 'defaultList' },
          { id: 'list-2', displayName: 'Hardware', isOwner: true, isShared: false },
        ],
      }));

      const lists = await microsoftTodoShoppingProvider.fetchLists(TOKENS);

      expect(lists).toEqual([
        { id: 'list-1', name: 'Groceries', isDefault: true },
        { id: 'list-2', name: 'Hardware', isDefault: false },
      ]);
    });

    it('sends bearer token in Authorization header', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ value: [] }));

      await microsoftTodoShoppingProvider.fetchLists(TOKENS);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/todo/lists'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        })
      );
    });
  });

  describe('fetchItems', () => {
    it('parses Graph tasks into shopping items', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        value: [
          {
            id: 'task-1',
            title: 'Milk',
            body: { content: '2% gallon', contentType: 'text' },
            status: 'notStarted',
            createdDateTime: '2026-02-15T10:00:00Z',
            lastModifiedDateTime: '2026-02-16T08:00:00Z',
          },
          {
            id: 'task-2',
            title: 'Bread',
            status: 'completed',
            createdDateTime: '2026-02-14T09:00:00Z',
            lastModifiedDateTime: '2026-02-15T12:00:00Z',
          },
        ],
      }));

      const items = await microsoftTodoShoppingProvider.fetchItems(TOKENS, 'list-1');

      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        id: 'task-1',
        listId: 'list-1',
        name: 'Milk',
        notes: '2% gallon',
        checked: false,
        updatedAt: new Date('2026-02-16T08:00:00Z'),
        createdAt: new Date('2026-02-15T10:00:00Z'),
      });
      expect(items[1]!.name).toBe('Bread');
      expect(items[1]!.checked).toBe(true);
      expect(items[1]!.notes).toBeNull();
    });
  });

  describe('createItem', () => {
    it('sends POST with title and body', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'new-1',
        title: 'Eggs',
        body: { content: 'Dozen', contentType: 'text' },
        status: 'notStarted',
        createdDateTime: '2026-02-16T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T10:00:00Z',
      }));

      const result = await microsoftTodoShoppingProvider.createItem(TOKENS, {
        listId: 'list-1',
        name: 'Eggs',
        notes: 'Dozen',
      });

      expect(result.name).toBe('Eggs');
      expect(result.notes).toBe('Dozen');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/todo/lists/list-1/tasks'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('omits body when no notes provided', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'new-2',
        title: 'Butter',
        status: 'notStarted',
        createdDateTime: '2026-02-16T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T10:00:00Z',
      }));

      await microsoftTodoShoppingProvider.createItem(TOKENS, {
        listId: 'list-1',
        name: 'Butter',
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.body).toBeUndefined();
    });
  });

  describe('updateItem', () => {
    it('sends PATCH with name, notes, and checked', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'task-1',
        title: 'Updated',
        body: { content: 'New note', contentType: 'text' },
        status: 'completed',
        createdDateTime: '2026-02-15T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T12:00:00Z',
      }));

      const result = await microsoftTodoShoppingProvider.updateItem(
        TOKENS, 'task-1', 'list-1',
        { name: 'Updated', notes: 'New note', checked: true }
      );

      expect(result.name).toBe('Updated');
      expect(result.checked).toBe(true);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.title).toBe('Updated');
      expect(sentBody.status).toBe('completed');
      expect(sentBody.body).toEqual({ content: 'New note', contentType: 'text' });
    });

    it('sets body to null when notes cleared', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'task-1',
        title: 'Item',
        status: 'notStarted',
        createdDateTime: '2026-02-15T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T12:00:00Z',
      }));

      await microsoftTodoShoppingProvider.updateItem(
        TOKENS, 'task-1', 'list-1',
        { notes: null }
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.body).toBeNull();
    });

    it('maps unchecked to notStarted status', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        id: 'task-1',
        title: 'Item',
        status: 'notStarted',
        createdDateTime: '2026-02-15T10:00:00Z',
        lastModifiedDateTime: '2026-02-16T12:00:00Z',
      }));

      await microsoftTodoShoppingProvider.updateItem(
        TOKENS, 'task-1', 'list-1',
        { checked: false }
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.status).toBe('notStarted');
    });
  });

  describe('deleteItem', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockReturnValueOnce(Promise.resolve({
        ok: true,
        status: 204,
        json: () => Promise.resolve(undefined),
        text: () => Promise.resolve(''),
      }));

      await microsoftTodoShoppingProvider.deleteItem(TOKENS, 'task-1', 'list-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/todo/lists/list-1/tasks/task-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('error handling', () => {
    it('throws on non-OK response', async () => {
      mockFetch.mockReturnValueOnce(Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }));

      await expect(microsoftTodoShoppingProvider.fetchLists(TOKENS))
        .rejects.toThrow('Microsoft Graph API error: 401');
    });
  });

  describe('refreshTokens', () => {
    beforeEach(() => {
      process.env.MICROSOFT_CLIENT_ID = 'test-client-id';
      process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret';
    });

    afterEach(() => {
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;
    });

    it('returns new tokens on success', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      }));

      const result = await microsoftTodoShoppingProvider.refreshTokens!(TOKENS);

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe('new-access');
      expect(result!.refreshToken).toBe('new-refresh');
    });

    it('keeps old refresh token when not returned', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({
        access_token: 'new-access',
        expires_in: 3600,
      }));

      const result = await microsoftTodoShoppingProvider.refreshTokens!(TOKENS);
      expect(result!.refreshToken).toBe('test-refresh-token');
    });

    it('returns null when no refresh token available', async () => {
      const result = await microsoftTodoShoppingProvider.refreshTokens!({
        accessToken: 'test',
      });
      expect(result).toBeNull();
    });

    it('returns null when credentials not configured', async () => {
      delete process.env.MICROSOFT_CLIENT_ID;
      delete process.env.MICROSOFT_CLIENT_SECRET;

      const result = await microsoftTodoShoppingProvider.refreshTokens!(TOKENS);
      expect(result).toBeNull();
    });

    it('returns null on failed refresh', async () => {
      mockFetch.mockReturnValueOnce(Promise.resolve({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      }));

      const result = await microsoftTodoShoppingProvider.refreshTokens!(TOKENS);
      expect(result).toBeNull();
    });
  });
});
