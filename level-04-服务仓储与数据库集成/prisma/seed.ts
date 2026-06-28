// WHAT: Prisma 种子数据——开发/测试环境的初始数据
// 运行: npx ts-node prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("开始填充种子数据...");

  // 创建测试用户
  const user1 = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: { name: "管理员", email: "admin@company.com", role: "ADMIN" },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "user@company.com" },
    update: {},
    create: { name: "普通用户", email: "user@company.com", role: "USER" },
  });

  // 创建测试猫
  const cat1 = await prisma.cat.create({
    data: { name: "咪咪", age: 2, breed: "波斯猫" },
  });
  const cat2 = await prisma.cat.create({
    data: { name: "旺财", age: 3, breed: "橘猫" },
  });

  // 建立用户-猫关系
  await prisma.catOnUser.create({
    data: { catId: cat1.id, userId: user1.id },
  });
  await prisma.catOnUser.create({
    data: { catId: cat2.id, userId: user2.id },
  });

  console.log(`创建了 ${2} 个用户, ${2} 只猫, ${2} 个关系`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
