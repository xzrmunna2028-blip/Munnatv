import { pgTable, text, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';

export const appState = pgTable('app_state', {
  id: text('id').primaryKey(),
  noticeText: text('notice_text').notNull(),
  comingSoonUrl: text('coming_soon_url'),
  comingSoonType: text('coming_soon_type'),
  maintenanceMode: boolean('maintenance_mode').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  iconName: text('icon_name'),
});

export const channels = pgTable('channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  logo: text('logo'),
  categoryId: text('category_id').references(() => categories.id).notNull(),
  active: boolean('active').default(false).notNull(),
  order: text('order'), // Optional ordering field
  team1: text('team1'),
  team2: text('team2'),
  matchTime: text('match_time'),
  status: text('status').default('inactive').notNull(), // 'live', 'coming_soon', 'inactive'
});

export const streamServers = pgTable('stream_servers', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').references(() => channels.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
});

export const bannedIps = pgTable('banned_ips', {
  ip: text('ip').primaryKey(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
