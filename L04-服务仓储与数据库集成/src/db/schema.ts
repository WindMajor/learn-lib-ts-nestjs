// WHAT: Drizzle Schema——数据库模型的类型安全定义
//
// 【核心原理——Drizzle vs Prisma】
//   Prisma: 使用自定义 DSL（Prisma Schema Language）定义模型
//   Drizzle: 使用纯 TypeScript 函数定义模型 → 编译期类型推导、IDE 自动补全
//
//   差异：
//   - Prisma 生成 PrismaClient（代码生成）
//   - Drizzle 直接通过 TypeScript 推导类型（无需代码生成步骤）
//
// 【对比 TypeORM】
//   TypeORM 用 @Entity()/@Column() 装饰器 → 依赖 reflect-metadata
//   Drizzle 用 pgTable()/varchar()/serial() 函数 → 纯 TypeScript，无装饰器
//
// 【对比 Go (GORM)】
//   GORM: type Cat struct { ID uint; Name string }（struct tag 驱动）
//   Drizzle: pgTable('cats', { id: serial(), name: varchar() })（函数式）
//   都是"用代码定义 schema"，但 Drizzle 更接近 SQL

import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  pgEnum,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ====================================
// 枚举定义
// ====================================
export const roleEnum = pgEnum('role', ['ADMIN', 'USER', 'VIEWER']);

// ====================================
// Cat 模型——演示基础 CRUD + 软删除 + 审计字段
// ====================================
export const cats = pgTable('cats', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  age: integer('age').notNull(),
  breed: varchar('breed', { length: 30 }).notNull(),

  // 软删除字段
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

  // 审计字段
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// ====================================
// User 模型——演示关联关系
// ====================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  role: roleEnum('role').default('USER').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// ====================================
// 多对多关联表：User <-> Cat
// ====================================
export const catOnUsers = pgTable(
  'cat_on_users',
  {
    catId: integer('cat_id')
      .notNull()
      .references(() => cats.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ownershipDate: timestamp('ownership_date', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.catId, table.userId] })],
);
