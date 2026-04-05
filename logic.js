export default class ActivityApp {
  constructor({ data, events, config, coordinator }) {
    this.data = data;
    this.events = events;
    this.config = config;
    this.coordinator = coordinator;
    this.boardClients = new Map(); // boardId -> Set<ws>
  }

  // ── Activity helpers ──────────────────────────────────────

  _recordAction({ type, board_id, card_id, member_id, data }) {
    const action = this.data.insert('actions', {
      type,
      board_id: board_id || null,
      card_id: card_id || null,
      member_id: member_id || null,
      data: data ? JSON.stringify(data) : null,
    });
    return action;
  }

  // ── Realtime helpers ──────────────────────────────────────

  addClient(boardId, ws) {
    if (!this.boardClients.has(boardId)) {
      this.boardClients.set(boardId, new Set());
    }
    this.boardClients.get(boardId).add(ws);

    ws.on('close', () => {
      const clients = this.boardClients.get(boardId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) this.boardClients.delete(boardId);
      }
    });
  }

  broadcast(boardId, event, payload) {
    const clients = this.boardClients.get(boardId);
    if (!clients || clients.size === 0) return;
    const message = JSON.stringify({ event, payload });
    clients.forEach((ws) => {
      try {
        ws.send(message);
      } catch (e) {
        // client may have disconnected
      }
    });
  }

  // ── Intents ───────────────────────────────────────────────

  intents() {
    return {};
  }

  // ── Interfaces ────────────────────────────────────────────

  interfaces() {
    return {
      getCardActions: ({ cardId }) => {
        return this.data.query('actions', { card_id: cardId }, { order: 'created_at DESC' });
      },
      getBoardActions: ({ boardId }) => {
        return this.data.query('actions', { board_id: boardId }, { order: 'created_at DESC' });
      },
    };
  }

  // ── Routes ────────────────────────────────────────────────

  routes() {
    return {
      cardActions: (ctx) => {
        const limit = parseInt(ctx.query.limit, 10) || 50;
        const offset = parseInt(ctx.query.offset, 10) || 0;
        const actions = this.data.query(
          'actions',
          { card_id: ctx.params.cardId },
          { order: 'created_at DESC', limit, offset }
        );
        return { status: 200, data: actions };
      },

      addComment: async (ctx) => {
        const { text } = ctx.body;
        if (!text) return { status: 400, data: { error: 'text is required' } };

        let board_id = null;
        try {
          const card = await this.coordinator.call('kanban-app', 'getCard', { cardId: ctx.params.cardId });
          if (card) board_id = card.board_id;
        } catch (e) {
          // card lookup failed, continue without board_id
        }

        const action = this._recordAction({
          type: 'comment.added',
          board_id,
          card_id: ctx.params.cardId,
          member_id: ctx.currentUser.id,
          data: { text },
        });

        return { status: 201, data: action };
      },

      updateComment: (ctx) => {
        const action = this.data.find('actions', ctx.params.commentId);
        if (!action || action.type !== 'comment.added') {
          return { status: 404, data: { error: 'Comment not found' } };
        }
        if (action.member_id !== ctx.currentUser.id) {
          return { status: 403, data: { error: 'Not authorized' } };
        }
        const { text } = ctx.body;
        const updated = this.data.update('actions', action.id, {
          data: JSON.stringify({ text }),
        });
        return { status: 200, data: updated };
      },

      deleteComment: (ctx) => {
        const action = this.data.find('actions', ctx.params.commentId);
        if (!action || action.type !== 'comment.added') {
          return { status: 404, data: { error: 'Comment not found' } };
        }
        if (action.member_id !== ctx.currentUser.id) {
          return { status: 403, data: { error: 'Not authorized' } };
        }
        this.data.delete('actions', action.id);
        return { status: 200, data: { success: true } };
      },

      listNotifications: (ctx) => {
        const notifications = this.data.query(
          'notifications',
          { user_id: ctx.currentUser.id, read: 0 },
          { order: 'created_at DESC' }
        );
        return { status: 200, data: notifications };
      },

      markRead: (ctx) => {
        const { ids } = ctx.body;
        if (!ids || !Array.isArray(ids)) {
          return { status: 400, data: { error: 'ids array is required' } };
        }
        ids.forEach((id) => {
          try {
            this.data.update('notifications', id, { read: 1 });
          } catch (e) {
            // skip invalid ids
          }
        });
        return { status: 200, data: { success: true } };
      },
    };
  }

  // ── Subscriptions (activity + realtime) ───────────────────

  setupSubscriptions(eventBus) {
    // Activity event handlers — record actions and create notifications
    const activityEvents = [
      { event: 'kanban.card.created', type: 'card.created', extract: (p) => ({ board_id: p.board_id, card_id: p.card_id }) },
      { event: 'kanban.card.moved', type: 'card.moved', extract: (p) => ({ board_id: p.board_id, card_id: p.card_id }) },
      { event: 'kanban.card.updated', type: 'card.updated', extract: (p) => ({ board_id: p.board_id, card_id: p.card_id }) },
      { event: 'kanban.list.created', type: 'list.created', extract: (p) => ({ board_id: p.board_id }) },
      { event: 'boards.board.created', type: 'board.created', extract: (p) => ({ board_id: p.board_id }) },
      { event: 'boards.member.added', type: 'member.added', extract: (p) => ({ board_id: p.board_id }) },
      { event: 'workspace.workspace.created', type: 'workspace.created', extract: (p) => ({}) },
    ];

    activityEvents.forEach(({ event, type, extract }) => {
      eventBus.subscribe(event, 'activity-app', async (payload) => {
        try {
          const extracted = extract(payload);
          this._recordAction({
            type,
            board_id: extracted.board_id || null,
            card_id: extracted.card_id || null,
            member_id: payload.owner_id || payload.user_id || payload.created_by || null,
            data: payload,
          });

          // Create notifications for board members
          if (extracted.board_id) {
            try {
              const members = await this.coordinator.call('kanban-app', 'listBoardMembers', { boardId: extracted.board_id });
              const actorId = payload.owner_id || payload.user_id || payload.created_by;
              for (const m of (members || [])) {
                if (m.user_id === actorId) continue; // don't notify the actor
                this.data.insert('notifications', {
                  user_id: m.user_id,
                  type,
                  message: `${type} on board`,
                  read: 0,
                });
              }
            } catch { /* kanban-app bundle may not be available */ }
          }
        } catch (e) {
          // gracefully handle subscription errors
        }
      });
    });

    // Realtime broadcast handlers — push events to WebSocket clients
    const broadcastEvents = [
      'kanban.list.created',
      'kanban.list.reordered',
      'kanban.card.created',
      'kanban.card.moved',
      'kanban.card.updated',
      'kanban.label.created',
      'kanban.checkitem.toggled',
      'boards.board.created',
      'boards.board.updated',
      'boards.member.added',
    ];

    broadcastEvents.forEach((event) => {
      eventBus.subscribe(event, 'activity-app-realtime', (payload) => {
        try {
          const boardId = payload.board_id;
          if (boardId) {
            this.broadcast(boardId, event, payload);
          }
        } catch (e) {
          // gracefully handle broadcast errors
        }
      });
    });
  }
}
