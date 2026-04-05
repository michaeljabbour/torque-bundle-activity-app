# @torquedev/bundle-activity-app

Activity feed, comments, notifications, and real-time broadcast.

## What It Provides

- **Activity Feed** -- action log for boards and cards, auto-populated from kanban events
- **Comments** -- add, edit, and delete comments on cards
- **Notifications** -- per-user notification inbox with read/unread tracking
- **Watchers** -- subscribe users to entities for targeted notifications
- **UI Pages** -- notifications page with bell icon in navigation

### API Routes

| Area | Endpoints |
|------|-----------|
| Activity | `GET /api/cards/:cardId/actions` |
| Comments | `POST /api/cards/:cardId/comments`, `PATCH/DELETE /api/comments/:commentId` |
| Notifications | `GET /api/notifications`, `POST /api/notifications/read` |

### Cross-Bundle Interfaces

`getCardActions`, `getBoardActions`

### Subscribed Events

Listens to card, list, board, workspace, label, and checklist events from the kanban bundles to build the activity feed automatically.

## Installation

```
npm install @torquedev/bundle-activity-app
```

Or as a git dependency in your mount plan:

```yaml
source: "git+https://github.com/torque-framework/torque-bundle-activity-app.git@main"
```

## Usage

Requires `kanban-app` bundle. Optionally integrates with `iam` for user resolution.

## License

MIT -- see [LICENSE](./LICENSE)
