import {
  Stack, Grid, Text, TextField, Button, Card, Badge, Spinner,
  Divider, Icon, Checkbox, FilterDropdown,
} from './ui-kit.js';

const TYPE_COLORS = {
  'card.created': 'success',
  'card.moved': 'info',
  'card.updated': 'primary',
  'list.created': 'warning',
  'list.reordered': 'warning',
  'board.created': 'secondary',
  'board.updated': 'secondary',
  'member.added': 'info',
  'checkitem.toggled': 'default',
  'label.created': 'default',
  'comment.added': 'primary',
};

const NOTIFICATION_TYPES = [
  { label: 'All Types', value: '' },
  { label: 'Card Created', value: 'card.created' },
  { label: 'Card Moved', value: 'card.moved' },
  { label: 'Card Updated', value: 'card.updated' },
  { label: 'List Created', value: 'list.created' },
  { label: 'List Reordered', value: 'list.reordered' },
  { label: 'Board Created', value: 'board.created' },
  { label: 'Board Updated', value: 'board.updated' },
  { label: 'Member Added', value: 'member.added' },
  { label: 'Comment Added', value: 'comment.added' },
];

const READ_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
];

export default function NotificationsView({ data, actions }) {
  if (!data || !data[0]) return Spinner({});

  const notifications = Array.isArray(data[0]) ? data[0] : [];

  // Local state via closure — the framework re-renders on actions.refresh()
  let searchTerm = '';
  let typeFilter = '';
  let readFilter = 'all';
  let sortColumn = 'created_at';
  let sortDirection = 'desc';
  let selectedIds = new Set();

  const unreadCount = notifications.filter(n => !n.read).length;

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return diffHrs + 'h ago';
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return diffDays + 'd ago';
    return d.toLocaleDateString();
  }

  function truncateId(id) {
    if (!id) return '';
    return String(id).substring(0, 8) + '...';
  }

  function typeColor(type) {
    return TYPE_COLORS[type] || 'default';
  }

  // Filter notifications
  function getFiltered() {
    let items = [...notifications];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(n =>
        (n.message || '').toLowerCase().includes(q) ||
        (n.type || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter) {
      items = items.filter(n => n.type === typeFilter);
    }
    if (readFilter === 'unread') {
      items = items.filter(n => !n.read);
    } else if (readFilter === 'read') {
      items = items.filter(n => !!n.read);
    }
    // Sort
    items.sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      if (sortColumn === 'created_at') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }
      if (sortColumn === 'read') {
        aVal = aVal ? 1 : 0;
        bVal = bVal ? 1 : 0;
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }

  const filtered = getFiltered();
  const selectedCount = selectedIds.size;

  function handleSelectAll(checked) {
    if (checked) {
      filtered.forEach(n => selectedIds.add(n.id));
    } else {
      selectedIds.clear();
    }
    actions.refresh();
  }

  function handleSelectOne(id, checked) {
    if (checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
    actions.refresh();
  }

  async function handleMarkSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await actions.api('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: ids }),
    });
    selectedIds.clear();
    actions.refresh();
  }

  async function handleMarkAllRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await actions.api('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: unreadIds }),
    });
    actions.refresh();
  }

  function handleSearch(value) {
    searchTerm = value;
    actions.refresh();
  }

  function handleTypeFilter(value) {
    typeFilter = value;
    actions.refresh();
  }

  function handleReadFilter(value) {
    readFilter = value;
    actions.refresh();
  }

  function handleSort(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = column === 'created_at' ? 'desc' : 'asc';
    }
    actions.refresh();
  }

  function sortIndicator(column) {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  // Header row for the grid
  function renderHeader() {
    return Stack(
      {
        direction: 'row',
        spacing: 0,
        sx: {
          px: 1.5,
          py: 1,
          backgroundColor: 'grey.100',
          borderRadius: 1,
          fontWeight: 700,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'text.secondary',
          alignItems: 'center',
        },
      },
      [
        Checkbox({
          checked: filtered.length > 0 && selectedIds.size === filtered.length,
          onChange: (e) => handleSelectAll(e.target.checked),
          sx: { width: 40, flexShrink: 0 },
        }),
        Text({
          content: 'Status' + sortIndicator('read'),
          sx: { width: 70, flexShrink: 0, cursor: 'pointer' },
          onClick: () => handleSort('read'),
        }),
        Text({
          content: 'Type' + sortIndicator('type'),
          sx: { width: 120, flexShrink: 0, cursor: 'pointer' },
          onClick: () => handleSort('type'),
        }),
        Text({
          content: 'Message' + sortIndicator('message'),
          sx: { flex: 1, cursor: 'pointer' },
          onClick: () => handleSort('message'),
        }),
        Text({
          content: 'Time' + sortIndicator('created_at'),
          sx: { width: 100, flexShrink: 0, cursor: 'pointer', textAlign: 'right' },
          onClick: () => handleSort('created_at'),
        }),
        Text({
          content: 'ID',
          sx: { width: 90, flexShrink: 0, textAlign: 'right' },
        }),
      ]
    );
  }

  // Single notification row
  function renderRow(notification) {
    const isSelected = selectedIds.has(notification.id);
    return Stack(
      {
        direction: 'row',
        spacing: 0,
        sx: {
          px: 1.5,
          py: 0.75,
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: isSelected ? 'action.selected' : (notification.read ? 'transparent' : 'action.hover'),
          cursor: 'pointer',
          '&:hover': { backgroundColor: 'action.hover' },
          transition: 'background-color 0.15s',
        },
      },
      [
        Checkbox({
          checked: isSelected,
          onChange: (e) => handleSelectOne(notification.id, e.target.checked),
          sx: { width: 40, flexShrink: 0 },
        }),
        Badge({
          content: notification.read ? 'Read' : 'New',
          color: notification.read ? 'default' : 'primary',
          sx: {
            width: 70,
            flexShrink: 0,
            fontSize: '0.7rem',
            fontWeight: notification.read ? 400 : 700,
          },
        }),
        Badge({
          content: notification.type || 'unknown',
          color: typeColor(notification.type),
          sx: {
            width: 120,
            flexShrink: 0,
            fontSize: '0.7rem',
          },
        }),
        Text({
          content: notification.message || 'No message',
          variant: 'body2',
          sx: {
            flex: 1,
            fontWeight: notification.read ? 400 : 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
        }),
        Text({
          content: formatTime(notification.created_at),
          variant: 'caption',
          sx: { width: 100, flexShrink: 0, textAlign: 'right', color: 'text.secondary' },
        }),
        Text({
          content: truncateId(notification.id),
          variant: 'caption',
          sx: { width: 90, flexShrink: 0, textAlign: 'right', color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.7rem' },
        }),
      ]
    );
  }

  return Stack({ spacing: 2, sx: { p: 2, maxWidth: 1100, mx: 'auto' } }, [
    // Title bar
    Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center', justifyContent: 'space-between' } }, [
      Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
        Icon({ name: 'bell', sx: { color: 'primary.main' } }),
        Text({ variant: 'h4', content: 'Notifications' }),
        unreadCount > 0
          ? Badge({ content: String(unreadCount), color: 'primary' })
          : null,
      ].filter(Boolean)),
      Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
        selectedCount > 0
          ? Button({
              label: 'Mark ' + selectedCount + ' Read',
              variant: 'contained',
              size: 'small',
              onClick: handleMarkSelected,
            })
          : null,
        unreadCount > 0
          ? Button({
              label: 'Mark All Read',
              variant: 'outlined',
              size: 'small',
              onClick: handleMarkAllRead,
            })
          : null,
      ].filter(Boolean)),
    ]),

    // Filter bar
    Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center', flexWrap: 'wrap' } }, [
      TextField({
        placeholder: 'Search notifications...',
        size: 'small',
        sx: { flex: 1, minWidth: 200 },
        onChange: (e) => handleSearch(e.target.value),
      }),
      FilterDropdown({
        label: 'Type',
        options: NOTIFICATION_TYPES,
        value: typeFilter,
        onChange: handleTypeFilter,
        size: 'small',
        sx: { minWidth: 150 },
      }),
      FilterDropdown({
        label: 'Status',
        options: READ_FILTERS,
        value: readFilter,
        onChange: handleReadFilter,
        size: 'small',
        sx: { minWidth: 120 },
      }),
      Text({
        content: filtered.length + ' notification' + (filtered.length !== 1 ? 's' : ''),
        variant: 'caption',
        sx: { color: 'text.secondary', ml: 'auto' },
      }),
    ]),

    Divider(),

    // Grid header
    renderHeader(),

    // Notification rows
    ...(filtered.length > 0
      ? filtered.map(renderRow)
      : [
          Stack({ sx: { py: 6, textAlign: 'center' } }, [
            Icon({ name: 'inbox', sx: { fontSize: 48, color: 'text.disabled', mb: 1 } }),
            Text({
              content: notifications.length === 0
                ? 'No notifications yet.'
                : 'No notifications match your filters.',
              variant: 'body2',
              sx: { color: 'text.secondary' },
            }),
          ]),
        ]
    ),
  ].filter(Boolean));
}
