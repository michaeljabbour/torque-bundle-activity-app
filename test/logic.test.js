import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import ActivityApp from '../logic.js';
import { createMockData, createMockEvents, createMockCoordinator } from './helpers.js';

describe('ActivityApp bundle', () => {
  let activity, data, events;

  beforeEach(() => {
    data = createMockData();
    events = createMockEvents();
    activity = new ActivityApp({
      data,
      events,
      config: { config: {} },
      coordinator: createMockCoordinator(),
    });
  });

  describe('constructor', () => {
    it('creates an instance', () => {
      assert.ok(activity);
    });

    it('initializes boardClients map', () => {
      assert.ok(activity.boardClients instanceof Map);
      assert.equal(activity.boardClients.size, 0);
    });
  });

  describe('routes()', () => {
    it('returns an object with route handlers', () => {
      const routes = activity.routes();
      assert.equal(typeof routes, 'object');
      assert.ok(Object.keys(routes).length > 0);
    });

    it('exposes cardActions route', () => {
      assert.equal(typeof activity.routes().cardActions, 'function');
    });

    it('exposes addComment route', () => {
      assert.equal(typeof activity.routes().addComment, 'function');
    });

    it('exposes updateComment route', () => {
      assert.equal(typeof activity.routes().updateComment, 'function');
    });

    it('exposes deleteComment route', () => {
      assert.equal(typeof activity.routes().deleteComment, 'function');
    });

    it('exposes listNotifications route', () => {
      assert.equal(typeof activity.routes().listNotifications, 'function');
    });

    it('exposes markRead route', () => {
      assert.equal(typeof activity.routes().markRead, 'function');
    });
  });

  describe('interfaces()', () => {
    it('returns an object with interface handlers', () => {
      const ifaces = activity.interfaces();
      assert.equal(typeof ifaces, 'object');
    });

    it('exposes getCardActions interface', () => {
      assert.equal(typeof activity.interfaces().getCardActions, 'function');
    });

    it('exposes getBoardActions interface', () => {
      assert.equal(typeof activity.interfaces().getBoardActions, 'function');
    });
  });

  describe('intents()', () => {
    it('returns an empty object', () => {
      assert.deepEqual(activity.intents(), {});
    });
  });

  describe('cardActions route', () => {
    it('returns 200 with actions for a card', () => {
      data.insert('actions', { type: 'comment.added', card_id: 'card-1', board_id: 'board-1', member_id: 'user-1', data: '{"text":"hello"}' });
      data.insert('actions', { type: 'card.moved', card_id: 'card-1', board_id: 'board-1', member_id: 'user-1', data: null });

      const result = activity.routes().cardActions({
        params: { cardId: 'card-1' },
        query: { limit: '50', offset: '0' },
      });
      assert.equal(result.status, 200);
      assert.equal(result.data.length, 2);
    });
  });

  describe('addComment route', () => {
    it('returns 201 on success', async () => {
      const result = await activity.routes().addComment({
        params: { cardId: 'card-1' },
        body: { text: 'Great work!' },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.type, 'comment.added');
    });

  });

  describe('updateComment route', () => {
    it('updates own comment', () => {
      const action = data.insert('actions', {
        type: 'comment.added', card_id: 'card-1', board_id: 'board-1',
        member_id: 'user-1', data: '{"text":"original"}',
      });
      const result = activity.routes().updateComment({
        params: { commentId: action.id },
        body: { text: 'updated' },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 200);
    });

    it('rejects update by non-author', () => {
      const action = data.insert('actions', {
        type: 'comment.added', card_id: 'card-1', board_id: 'board-1',
        member_id: 'user-1', data: '{"text":"original"}',
      });
      const result = activity.routes().updateComment({
        params: { commentId: action.id },
        body: { text: 'hacked' },
        currentUser: { id: 'user-2' },
      });
      assert.equal(result.status, 403);
    });

    it('returns 404 for nonexistent comment', () => {
      const result = activity.routes().updateComment({
        params: { commentId: 'nonexistent' },
        body: { text: 'nope' },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 404);
    });
  });

  describe('deleteComment route', () => {
    it('deletes own comment', () => {
      const action = data.insert('actions', {
        type: 'comment.added', card_id: 'card-1', board_id: 'board-1',
        member_id: 'user-1', data: '{"text":"to delete"}',
      });
      const result = activity.routes().deleteComment({
        params: { commentId: action.id },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 200);
      assert.ok(result.data.success);
    });

    it('rejects delete by non-author', () => {
      const action = data.insert('actions', {
        type: 'comment.added', card_id: 'card-1', board_id: 'board-1',
        member_id: 'user-1', data: '{"text":"mine"}',
      });
      const result = activity.routes().deleteComment({
        params: { commentId: action.id },
        currentUser: { id: 'user-2' },
      });
      assert.equal(result.status, 403);
    });
  });

  describe('notifications routes', () => {
    it('listNotifications returns unread notifications for user', () => {
      data.insert('notifications', { user_id: 'user-1', type: 'card.created', message: 'New card', read: 0 });
      data.insert('notifications', { user_id: 'user-1', type: 'card.moved', message: 'Card moved', read: 0 });
      data.insert('notifications', { user_id: 'user-2', type: 'card.created', message: 'Other user', read: 0 });

      const result = activity.routes().listNotifications({
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 200);
      assert.equal(result.data.length, 2);
    });

    it('markRead marks notifications as read', () => {
      const n1 = data.insert('notifications', { user_id: 'user-1', type: 'card.created', message: 'Test', read: 0 });
      const result = activity.routes().markRead({
        body: { ids: [n1.id] },
      });
      assert.equal(result.status, 200);

      const updated = data.find('notifications', n1.id);
      assert.equal(updated.read, 1);
    });

    it('markRead rejects missing ids', () => {
      const result = activity.routes().markRead({ body: {} });
      assert.equal(result.status, 400);
    });
  });

  describe('interfaces - getCardActions', () => {
    it('returns actions for a card', () => {
      data.insert('actions', { type: 'comment.added', card_id: 'card-1', board_id: 'board-1', member_id: 'user-1', data: null });
      const actions = activity.interfaces().getCardActions({ cardId: 'card-1' });
      assert.equal(actions.length, 1);
    });
  });

  describe('interfaces - getBoardActions', () => {
    it('returns actions for a board', () => {
      data.insert('actions', { type: 'card.created', card_id: 'card-1', board_id: 'board-1', member_id: 'user-1', data: null });
      data.insert('actions', { type: 'card.moved', card_id: 'card-2', board_id: 'board-1', member_id: 'user-1', data: null });
      const actions = activity.interfaces().getBoardActions({ boardId: 'board-1' });
      assert.equal(actions.length, 2);
    });
  });

  describe('broadcast', () => {
    it('sends message to connected clients', () => {
      const sent = [];
      const mockWs = {
        send(msg) { sent.push(msg); },
        on() {},
      };
      activity.addClient('board-1', mockWs);
      activity.broadcast('board-1', 'card.created', { card_id: 'c1' });
      assert.equal(sent.length, 1);
      const parsed = JSON.parse(sent[0]);
      assert.equal(parsed.event, 'card.created');
    });

    it('does nothing when no clients are connected', () => {
      // Should not throw
      activity.broadcast('board-999', 'card.created', { card_id: 'c1' });
    });
  });

  describe('setupSubscriptions', () => {
    it('subscribes to kanban and board events', () => {
      const subscribed = [];
      const mockBus = { subscribe(event, bundle, handler) { subscribed.push({ event, bundle }); } };
      activity.setupSubscriptions(mockBus);
      const eventNames = subscribed.map((s) => s.event);
      assert.ok(eventNames.includes('kanban.card.created'));
      assert.ok(eventNames.includes('kanban.card.moved'));
      assert.ok(eventNames.includes('boards.board.created'));
    });
  });
});
