import {
  pgTable, pgEnum, serial, varchar, integer, text, jsonb,
  timestamp, boolean, primaryKey,
} from 'drizzle-orm/pg-core';

// ====================================
// 枚举定义
// ====================================
export const roleEnum = pgEnum('role', [
  'ADMIN', 'DEPARTMENT_MANAGER', 'USER', 'VIEWER',
]);
export const reportCategoryEnum = pgEnum('report_category', [
  'DATA_SUMMARY', 'FINANCE_INCOME', 'HR_PERSONNEL', 'PROJECT_PROGRESS',
]);
export const reportStatusEnum = pgEnum('report_status', [
  'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED',
]);
export const approvalStatusEnum = pgEnum('approval_status', [
  'PENDING', 'APPROVED', 'REJECTED',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'SYSTEM', 'APPROVAL_REMINDER', 'REPORT_SUBMITTED',
]);

// ====================================
// 部门表
// ====================================
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  parentId: integer('parent_id'),
  leaderId: integer('leader_id'),
  description: varchar('description', { length: 500 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow().notNull().$onUpdate(() => new Date()),
});

// ====================================
// 用户表
// ====================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  realName: varchar('real_name', { length: 50 }),
  role: roleEnum('role').default('USER').notNull(),
  departmentId: integer('department_id').references(() => departments.id),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow().notNull().$onUpdate(() => new Date()),
});

// ====================================
// 报表表
// ====================================
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  category: reportCategoryEnum('category').default('DATA_SUMMARY').notNull(),
  content: jsonb('content').notNull(),
  status: reportStatusEnum('status').default('DRAFT').notNull(),
  submitterId: integer('submitter_id')
    .notNull()
    .references(() => users.id),
  departmentId: integer('department_id')
    .notNull()
    .references(() => departments.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow().notNull().$onUpdate(() => new Date()),
});

// ====================================
// 报表附件表
// ====================================
export const reportAttachments = pgTable('report_attachments', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id')
    .notNull()
    .references(() => reports.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ====================================
// 审批表
// ====================================
export const approvals = pgTable('approvals', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id')
    .notNull()
    .references(() => reports.id),
  approverId: integer('approver_id')
    .notNull()
    .references(() => users.id),
  step: integer('step').default(1).notNull(),
  status: approvalStatusEnum('status').default('PENDING').notNull(),
  comment: varchar('comment', { length: 500 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ====================================
// 通知表
// ====================================
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull(),
  type: notificationTypeEnum('type').default('SYSTEM').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
