---
meta:
  name: activity-app-expert
  description: "Expert on the activity-app bundle"
  modes:
    - name: implement
      trigger: "work on activity-app"
    - name: debug
      trigger: "debug activity-app"
  context:
    include:
      - foundation/context/DESIGN_PRINCIPLES.md
      - foundation/context/DOMAIN_CONVENTIONS.md
---

# Activity-App Bundle — Agent Guide

## What this bundle does
Consolidates activity tracking, notifications, and real-time WebSocket broadcast into a single bundle. Records actions (comments, card/board/list events), manages user notifications, and pushes live updates to connected board clients.

## Domain model
- **actions** — immutable log of every significant event (card created, comment added, etc.)
- **notifications** — per-user alerts derived from actions, with read/unread state
- **watchers** — user subscriptions to specific entities for targeted notifications
- **boardClients** (in-memory) — WebSocket connections grouped by board for real-time broadcast

## Key interfaces
- `getCardActions({ cardId })` — returns all actions for a card, newest first
- `getBoardActions({ boardId })` — returns all actions for a board, newest first

## Anti-patterns
- Never import from other bundles — use coordinator.call()
- Never access other bundles' database tables
- Never hardcode config — use this.config from mount plan
- Events are past-tense facts, not commands
