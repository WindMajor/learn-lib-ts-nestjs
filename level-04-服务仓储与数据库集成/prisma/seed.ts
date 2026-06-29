// level-04 seed 已迁移至 Drizzle ORM
// 运行: npx ts-node prisma/seed.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://nestjs_user:nestjs_pass@localhost:5432/nestjs_learn?schema=public",
});
const db = drizzle(pool, { schema });

async function main() {
  console.log("开始填充种子数据...");

  // 创建测试用户
  const [user1] = await db
    .insert(schema.users)
    .values({
      name: "管理员",
      email: "admin@company.com",
      role: "ADMIN",
    })
    .returning();

  const [user2] = await db
    .insert(schema.users)
    .values({
      name: "普通用户",
      email: "user@company.com",
      role: "USER",
    })
    .returning();

  // 创建测试猫
  const [cat1] = await db
    .insert(schema.cats)
    .values({ name: "咪咪", age: 2, breed: "波斯猫" })
    .returning();

  const [cat2] = await db
    .insert(schema.cats)
    .values({ name: "旺财", age: 3, breed: "橘猫" })
    .returning();

  // 建立用户-猫关系
  await db
    .insert(schema.catOnUsers)
    .values({ catId: cat1.id, userId: user1.id });

  await db
    .insert(schema.catOnUsers)
    .values({ catId: cat2.id, userId: user2.id });

  console.log(`创建了 2 个用户, 2 只猫, 2 个关系`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
