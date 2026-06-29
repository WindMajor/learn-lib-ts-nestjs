/**
 * WHAT: 自定义验证装饰器 @IsCatBreed()——检查品种是否在允许列表中
 *
 * 【核心原理——NestJS 自定义验证器的工作流程】
 *   1. 定义验证逻辑类（实现 ValidatorConstraintInterface）
 *      - validate(value): boolean —— 核心验证逻辑
 *      - defaultMessage(args): string —— 验证失败时的错误消息
 *   2. 用 @ValidatorConstraint 装饰器标记（name 唯一，async 标记是否异步）
 *   3. 使用 validate() 或 registerDecorator() 注册到 class-validator
 *   4. 像内置装饰器一样使用：@IsCatBreed()
 *
 * 【对比 Spring】
 *   Spring 的 @Constraint + ConstraintValidator 接口机制几乎一样
 *   差异：Spring 的 Validator 可以注入 Spring Bean（通过 @Autowired），
 *         NestJS 的 Validator 类需要用 @Injectable() + 构造器注入
 *
 * 【对比 FastAPI(Pydantic)】
 *   Pydantic 的 @validator('field') 作用在 Model 类的方法上，更 Pythonic：
 *   @validator('breed')
 *   def validate_breed(cls, v):
 *       return v
 *   本质都是"在字段上附加验证逻辑"
 *
 * 【对比 Go (go-playground/validator)】
 *   Go 的自定义验证需要注册到 validate 实例：
 *   validate.RegisterValidation("catbreed", func(fl validator.FieldLevel) bool { ... })
 *   然后用 struct tag: Breed string `validate:"catbreed"`
 *   比 NestJS 的装饰器方式更动态（运行时注册），NestJS 的装饰器方式更声明式
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";

// WHAT: 允许的猫品种列表
const ALLOWED_BREEDS = [
  "波斯猫",
  "英短",
  "美短",
  "橘猫",
  "布偶猫",
  "暹罗猫",
  "缅因猫",
  "田园猫",
  "无毛猫",
  "德文卷毛猫",
];

/**
 * WHAT: 验证逻辑实现
 * WHY: @ValidatorConstraint({ name: 'isCatBreed', async: false })
 *   name: 验证器的唯一标识（用于错误信息和查找）
 *   async: false 表示同步验证，true 可用于查数据库（如检查用户名是否存在）
 */
@ValidatorConstraint({ name: "isCatBreed", async: false })
export class IsCatBreedConstraint implements ValidatorConstraintInterface {
  /**
   * WHAT: 核心验证方法
   * @returns true = 通过验证, false = 验证失败
   *
   * LIFECYCLE: 在 ValidationPipe 的 validate() 阶段执行
   */
  validate(breed: string, args: ValidationArguments): boolean {
    if (typeof breed !== "string") return false;
    return ALLOWED_BREEDS.includes(breed);
  }

  /**
   * WHAT: 验证失败时的默认错误消息
   * args.value: 传入的实际值
   * args.constraints: @IsCatBreed() 中传入的参数
   */
  defaultMessage(args: ValidationArguments): string {
    return `品种 "${args.value}" 不在允许列表中。允许的品种: ${ALLOWED_BREEDS.join("、")}`;
  }
}

/**
 * WHAT: 导出装饰器工厂函数
 * 【对比 Rust】这个模式类似于 Rust 的 proc macro——你定义一个函数，
 *   它在编译/注册时执行，生成额外的运行时代码
 */
export function IsCatBreed(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      // target: 目标类（如 CreateCatDto 的原型）
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCatBreedConstraint,
    });
  };
}
