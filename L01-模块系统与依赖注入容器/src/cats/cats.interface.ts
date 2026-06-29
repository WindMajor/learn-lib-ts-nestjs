/**
 * WHAT: 定义 Cat 实体的形状——TypeScript 接口，无运行时开销
 *
 * WHY: 使用 interface 而非 class：
 *   - interface 在编译后完全消失（零运行时开销）
 *   - 不需要 @Injectable() 装饰器（它不是一个 Provider）
 *   - 不需要在 Module 的 providers 中注册
 *
 * 【对比 Rust】
 *   Rust 用 struct + trait 定义实体，编译期保证类型安全。
 *   TS 的 interface 只存在于编译时，运行时不保证任何事——
 *   这就是为什么后几关需要 DTO + class-validator 做运行期验证。
 *
 * 【对比 Go】
 *   Go 的 struct 在编译后保留字段信息（通过 reflect 包），
 *   TS 的 interface 编译后完全消失——如果你需要在运行期检查类型，
 *   必须用 class 或搭配 class-transformer。
 */
export interface Cat {
  id: number;
  name: string;
  age: number;
  breed: string;
}
