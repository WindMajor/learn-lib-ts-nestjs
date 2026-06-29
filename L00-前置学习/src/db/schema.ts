// ============================================================
// Drizzle Schema - NestJS 学习项目数据库模型定义
// 使用命令：npx drizzle-kit generate
//            npx drizzle-kit migrate
// 查看数据：npx drizzle-kit studio
// ============================================================

import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

// ----------------------------------------------------------
// Role 枚举 —— 用户角色
// 映射到 PostgreSQL 的 native enum 类型
// ----------------------------------------------------------
export const roleEnum = pgEnum('role', ['USER', 'EDITOR', 'ADMIN']);

// ----------------------------------------------------------
// User 表 —— 用户
// 对应 TypeScript 类型（由 Drizzle 自动推断）：
//   typeof users.$inferSelect → { id: number; email: string; ... }
// 关联：一对多 → posts
// ----------------------------------------------------------
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  password: varchar('password', { length: 255 }).notNull(), // bcrypt 哈希值
  avatar: varchar('avatar', { length: 500 }), // 头像 URL
  role: roleEnum('role').default('USER').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// ----------------------------------------------------------
// Post 表 —— 文章
// 字段类型映射：
//   varchar → TypeScript string
//   serial (integer) → TypeScript number
//   boolean → TypeScript boolean
//   timestamp → TypeScript Date
//   varchar().nullable() → TypeScript string | null
// ----------------------------------------------------------
export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content'), // 文章内容（可为空，允许草稿）
    published: boolean('published').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(), // 浏览量
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id), // 外键：关联 users
    deletedAt: timestamp('deleted_at', { withTimezone: true }), // 软删除标记
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('idx_posts_author_id').on(table.authorId), // 为外键创建索引
    index('idx_posts_deleted_at').on(table.deletedAt), // 软删除过滤索引
  ],
);
