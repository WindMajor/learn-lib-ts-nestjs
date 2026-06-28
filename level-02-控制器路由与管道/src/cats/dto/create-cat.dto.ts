/**
 * WHAT: CreateCatDto——创建猫的请求体 DTO
 *
 * WHY: class 而非 interface：
 *   - class 在编译后会保留运行时的构造函数（编译后JS中是实际存在的class）
 *   - ValidationPipe 需要运行时的 class 引用才能做反射验证
 *   - interface 编译后完全消失，无法做运行时验证
 *   - class-validator 和 class-transformer 都依赖 class 的运行时元数据
 *
 * 【核心原理——为什么 NestJS 用 class 做 DTO 而非 interface】
 *   TypeScript 的 interface 是纯编译期概念，编译成 JS 后完全不存在。
 *   NestJS 的 ValidationPipe 在运行时工作：
 *   1. 读取 @Body() 装饰器的类型元数据 → 获得 CreateCatDto 类引用
 *   2. 使用 class-transformer 的 plainToInstance(CreateCatDto, requestBody)
 *   3. 调用 class-validator 的 validate(instance) → 检查装饰器约束
 *   4. 如果验证失败 → 抛出 BadRequestException（400）
 *
 *   如果 DTO 是 interface → 步骤 2 失败（没有构造函数可调用）
 *   → 这就是为什么 NestJS 坚持用 class 做 DTO！
 *
 * 【对比 FastAPI】
 *   FastAPI 的 Pydantic 模型也是 class，但 Python 的 class 天生支持运行期反射
 *   （Python 的 type() 和 inspect 模块），不需要额外的"元数据保存"机制。
 *   共同点：都使用 class + 装饰器/field 定义验证规则
 *   差异：Pydantic 的验证在 Python 层面更快（C扩展），class-validator 纯 JS 慢一些
 *
 * 【对比 Spring】
 *   Spring 的 DTO 同样使用 class + @NotNull/@Size 等注解
 *   但 Spring 的验证是 JSR-380 Bean Validation 标准——
 *   NestJS 的 class-validator 是社区库，不是标准，但功能相近
 *
 * 【对比 Go】
 *   Go 没有"装饰器验证"——你手动写 validate() 函数或用 struct tag
 *   type CreateCatDto struct {
 *     Name string `json:"name" validate:"required,min=1,max=50"`
 *   }
 *   Go 的 struct tag 是编译期字符串，validate 库在运行时解析——机制类似于 NestJS
 */
import { IsString, IsInt, Min, Max, MinLength, MaxLength } from "class-validator";

export class CreateCatDto {
  // @IsString() 确保 name 是字符串类型
  // message 自定义错误消息——对前端更友好
  @IsString({ message: "猫名必须是字符串" })
  @MinLength(1, { message: "猫名至少需要 1 个字符" })
  @MaxLength(50, { message: "猫名不能超过 50 个字符" })
  name!: string;

  @IsInt({ message: "年龄必须是整数" })
  @Min(0, { message: "年龄不能是负数" })
  @Max(30, { message: "年龄不能超过 30 岁（猫的极限寿命）" })
  age!: number;

  @IsString({ message: "品种必须是字符串" })
  @MinLength(1, { message: "品种至少需要 1 个字符" })
  breed!: string;
}
