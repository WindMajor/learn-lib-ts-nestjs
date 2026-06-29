import { Injectable, Logger } from "@nestjs/common";

export interface Cat {
  id: number;
  name: string;
  age: number;
  breed: string;
  role: string;
}

@Injectable()
export class CatsService {
  private readonly cats: Cat[] = [
    { id: 1, name: "咪咪", age: 2, breed: "波斯猫", role: "user" },
    { id: 2, name: "旺财", age: 3, breed: "橘猫", role: "user" },
    { id: 3, name: "管理员猫", age: 5, breed: "英短", role: "admin" },
  ];

  findAll(): Cat[] {
    return this.cats;
  }

  findByRole(role: string): Cat[] {
    return this.cats.filter((c) => c.role === role);
  }
}
