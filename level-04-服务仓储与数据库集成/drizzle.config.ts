// WHAT: Drizzle 配置文件
// WHY: 定义 schema 文件位置、数据库连接、迁移目录
//
// 【对比 Prisma】
//   Prisma: prisma/schema.prisma 是 DSL + 数据源 + 生成器 三合一
//   Drizzle: schema.ts 是纯 TypeScript + drizzle.config.ts 仅配置路径
//   差异：Drizzle 的 schema 是 TS 代码，享受 IDE 自动补全和类型检查

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://nestjs_user:nestjs_pass@localhost:5432/nestjs_learn?schema=public',
  },
});
