import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/db/schema';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://nestjs_user:nestjs_pass@localhost:5432/enterprise_platform?schema=public',
});
const db = drizzle(pool, { schema });

async function main() {
  // 创建部门
  const tech = await db
    .insert(schema.departments)
    .values({ name: '技术部', sortOrder: 1 })
    .returning();
  const finance = await db
    .insert(schema.departments)
    .values({ name: '财务部', sortOrder: 2 })
    .returning();
  const hr = await db
    .insert(schema.departments)
    .values({ name: '人事部', sortOrder: 3 })
    .returning();
  console.log(`部门: ${tech[0].name}, ${finance[0].name}, ${hr[0].name}`);

  // 创建用户
  const admin = await db
    .insert(schema.users)
    .values({ username: 'admin', email: 'admin@company.com', passwordHash: '', realName: '系统管理员', role: 'ADMIN' })
    .returning();
  const manager = await db
    .insert(schema.users)
    .values({ username: 'manager', email: 'manager@company.com', passwordHash: '', realName: '部门经理', role: 'DEPARTMENT_MANAGER', departmentId: tech[0].id })
    .returning();
  const user = await db
    .insert(schema.users)
    .values({ username: 'user', email: 'user@company.com', passwordHash: '', realName: '普通员工', role: 'USER', departmentId: tech[0].id })
    .returning();
  console.log(`用户: ${admin[0].username}, ${manager[0].username}, ${user[0].username}`);

  // 创建报表
  const report = await db
    .insert(schema.reports)
    .values({
      title: '2024年Q1技术部工作汇总', category: 'DATA_SUMMARY',
      content: { revenue: 500000, projects: 12, bugs: 45 },
      submitterId: manager[0].id, departmentId: tech[0].id, status: 'SUBMITTED',
    })
    .returning();
  console.log(`报表: ${report[0].title}`);

  // 创建审批
  await db
    .insert(schema.approvals)
    .values({ reportId: report[0].id, approverId: admin[0].id, step: 1, status: 'PENDING' });

  // 创建通知
  await db
    .insert(schema.notifications)
    .values({ userId: admin[0].id, title: '有新的报表待审批', content: `${manager[0].realName} 提交了报表`, type: 'REPORT_SUBMITTED' });

  console.log('种子数据填充完成');
}

main().catch(console.error).finally(() => pool.end());
