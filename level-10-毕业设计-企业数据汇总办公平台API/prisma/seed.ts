import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("填充种子数据...");

  // 创建部门
  const techDept = await prisma.department.upsert({
    where: { name: "技术部" }, update: {}, create: { name: "技术部", sortOrder: 1 },
  });
  const financeDept = await prisma.department.upsert({
    where: { name: "财务部" }, update: {}, create: { name: "财务部", sortOrder: 2 },
  });
  const hrDept = await prisma.department.upsert({
    where: { name: "人事部" }, update: {}, create: { name: "人事部", sortOrder: 3 },
  });

  // 创建用户
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", email: "admin@company.com", passwordHash: "", realName: "系统管理员", role: "ADMIN" },
  });
  const manager = await prisma.user.upsert({
    where: { username: "manager" },
    update: {},
    create: { username: "manager", email: "manager@company.com", passwordHash: "", realName: "部门经理", role: "DEPARTMENT_MANAGER", departmentId: techDept.id },
  });
  await prisma.user.upsert({
    where: { username: "user" },
    update: {},
    create: { username: "user", email: "user@company.com", passwordHash: "", realName: "普通员工", role: "USER", departmentId: techDept.id },
  });

  // 创建示例报表
  const report = await prisma.report.create({
    data: {
      title: "2024年Q1技术部工作汇总", category: "DATA_SUMMARY",
      content: { revenue: 500000, projects: 12, bugs: 45, say: "报告内容" },
      submitterId: manager.id, departmentId: techDept.id, status: "SUBMITTED",
    },
  });

  // 创建审批记录
  await prisma.approval.create({
    data: { reportId: report.id, approverId: admin.id, step: 1, status: "PENDING" },
  });

  // 创建通知
  await prisma.notification.create({
    data: { userId: admin.id, title: "有新的报表待审批", content: `${manager.realName} 提交了报表"${report.title}"`, type: "REPORT_SUBMITTED" },
  });

  console.log(`种子数据: 3个部门, 3个用户, 1个报表, 1个审批, 1个通知`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
