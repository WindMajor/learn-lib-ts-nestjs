/**
 * ============================================================
 * 第 06 章：DTO、验证与管道
 * ============================================================
 *
 * 【学习目标】
 *   1. 理解 DTO（Data Transfer Object）的本质：定义数据形状 + 验证规则
 *   2. 掌握 class-validator 核心装饰器及其组合使用
 *   3. 掌握 class-transformer 的 plainToInstance / instanceToPlain
 *   4. 掌握内置管道：ValidationPipe、ParseIntPipe、ParseUUIDPipe、DefaultValuePipe
 *   5. 掌握自定义管道的编写（实现 PipeTransform 接口）
 *   6. 理解 DTO 与 TS 接口的区别：DTO 是运行时存在的类，接口在编译时擦除
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：需要手动验证 req.body，通常用 joi 或 express-validator
 *   - FastAPI：Pydantic 模型（Basemodel）—— NestJS 的 DTO + class-validator 概念完全对应
 *   - Spring：Java Bean Validation（@NotNull、@Size 等），与 class-validator 装饰器风格一致
 *   - Django：ModelForm / Serializer 验证，概念相似
 *
 * 【与 Vue3 前端的协作关系】
 *   - DTO 中定义的验证规则 = 前端表单的校验规则（后端是最后一道防线）
 *   - 前后端可以共享 DTO 的类型定义（通过 monorepo 或从 OpenAPI 生成）
 *   - @IsOptional() = 前端表单的可选字段
 *   - ValidationPipe 的 whitelist: true = 前端发送多余字段会被自动剔除
 */

import {
  IsString,
  IsEmail,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsUUID,
  validate,
  validateOrReject,
  IsNotEmpty,
  IsDateString,
  Matches,
} from 'class-validator';
import { plainToInstance, instanceToPlain, Exclude, Expose, Transform, Type } from 'class-transformer';
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseBoolPipe,
  Get,
  Param,
  Query,
} from '@nestjs/common';

// ============================================================
// 示例 1：DTO 基本定义 —— class-validator 装饰器
// ============================================================

/**
 * 【场景】定义创建用户的请求体结构，包含验证规则
 * 【语法点】class-validator 装饰器直接在属性上声明验证规则
 * 【NestJS 设计意图】DTO 是运行时存在的类（与 TS interface 不同），装饰器元数据在运行时可通过反射读取，使验证成为可能
 * 【DI 容器行为】ValidationPipe 在管道阶段读取 DTO 的 class-validator 元数据并执行验证
 *  class-validator 是一个 TypeScript/JavaScript 运行时验证库，让你用装饰器声明验证规则，运行时自动校验对象。只管输入，不管输出
 */

/* 
DTO 必须是 class，不能是 interface！

Java的Spring体系里，前端给后端用DTO，后端给前端用VO。
但是 NestJS 社区没有区分DTO和VO，几乎一切数据载体都叫 DTO：
  前端 ──→ Request DTO ──→ 后端
  前端 ←── Response DTO ←── 后端
  后端 ──→ Request DTO ──→ 另一个后端
  后端 ←── Response DTO ←── 另一个后端

在 NestJS 语境下，DTO 不只是「数据」，更是「带验证规则的 class」：
  DTO = 数据形状 + 验证规则 + 双向传输
*/
class CreateUserDto {
  @IsString({ message: '姓名必须是字符串' })
  /* @IsString 是 class-validator 库提供的一个属性装饰器，声明「这个属性的值必须是一个 string 类型」，并把这个声明作为元数据挂到 class 上。
  在运行时自动校验请求体中的字段类型是否正确，不让你写手动 if (typeof body.name !== 'string')
  当请求体 { "name": 123 } 进来时，ValidationPipe 会自动拦截并返回 400 Bad Request: "姓名必须是字符串"，你写 0 行业务代码就完成了验证。
  */
  @IsNotEmpty({ message: '姓名不能为空' }) /* 三个条件：不是空字符串、不是 null、不是 undefined。 */
  @MinLength(2, { message: '姓名至少需要 2 个字符' }) /* 最小长度 */
  @MaxLength(50, { message: '姓名不能超过 50 个字符' }) /* 最大长度限制 */
  public name!: string;
  /* 上面4个装饰器都是修饰的name，装饰器里的message的信息是当入站数据违反条件后给的错误提示 */
  /* name后面的叹号，告诉 TypeScript "这个属性一定会被赋值，你先别报错"，（明确赋值断言） 
      TS默认开启要求：class 属性必须要么有初始值、要么在构造函数里赋值。必须写叹号断言，不然编译器就报错。
  */

  @IsEmail({}, { message: '请提供有效的邮箱地址' })
  public email!: string;

  @IsString() /* 如果不写message，返回给前端的是英文默认提示 "$property must be a string" */
  @MinLength(6, { message: '密码至少需要 6 个字符' })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: '密码必须包含大小写字母和数字' }) /* 传一个自定义正则表达式，是万能的过滤器 */
  public password!: string;

  @IsOptional() /* 意思是：这个字段可以不传，但如果你传了，就得符合我后面列的所有规则 【值不存在（undefined/null）→ 返回false → 跳过后续所有验证器】【值存在 → 返回true → @IsEnum照常执行】*/
  @IsEnum(['USER', 'EDITOR', 'ADMIN'] as const, {
    message: '角色只能是 USER、EDITOR 或 ADMIN',
  })
  public role?: 'USER' | 'EDITOR' | 'ADMIN';
  /* ? 表示属性可选，和@IsOptional() 搭配一起使用 */

  @IsOptional()
  @IsBoolean() /* 前端用JSON Body格式，Content-Type: application/json，true/false 就是原生布尔值 */
  public isActive?: boolean;
}

// 更新 DTO：手工枚举字段 + @IsOptional() 逐一声明选填
// 和 Partial<CreateUserDto> 的区别见下方对比注释
class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  public name?: string;

  @IsOptional()
  @IsEmail({})
  public email?: string;

  @IsOptional()
  @IsEnum(['USER', 'EDITOR', 'ADMIN'] as const)
  public role?: 'USER' | 'EDITOR' | 'ADMIN';
}

/**
 * 【Partial 补充对比】
 *
 * 上面 UpdateUserDto 是手工复制字段 + 逐一加?和@IsOptional()
 *
 * Partial<CreateUserDto> 是 TypeScript 内置工具类型，
 * 一键让 CreateUserDto 的所有属性变选填（编译期）：
 *
 *   type Partial<T> = { [P in keyof T]?: T[P] };
 *
 * 但它只管编译期类型，不影响运行时验证！
 * 所以运行时仍需 @IsOptional() 装饰器。
 */

// ── 方式 A：手工枚举（当前 UpdateUserDto） ──
// ✅ 推荐！安全、主流、可只暴露部分字段（如不暴露 password）
// 缺点：CreateUserDto 加字段时要手动同步

// ── 方式 B：Partial<CreateUserDto>（不推荐） ──
// 用法示例（Controller 中）：
//
//   @Patch('/users/:id')
//   update(@Body() dto: Partial<CreateUserDto>) {
//     // dto.name?、dto.email?、dto.password?… 全部允许 undefined
//   }
//
// ⚠️ 坑：Partial<CreateUserDto> 只改编译期类型，类上的 @IsNotEmpty 运行时照样生效！
//    前端传 { role: "ADMIN" }，name 没传 → name 是 undefined
//    → @IsNotEmpty 检查 undefined → ❌ 400，连 Controller 都进不去
//    所以必须单独定义 UpdateUserDto，每个字段加 @IsOptional() 让运行时跳过验证。

// ============================================================
// 示例 2：嵌套 DTO 验证
// ============================================================

/**
 * 【场景】请求体包含嵌套对象或数组，需要对嵌套数据进行递归验证
 * 【语法点】@ValidateNested() + @Type(() => NestedClass)
 * 【关键】@Type() 是 class-transformer 的装饰器，告诉 transformer 如何实例化嵌套类
 *         没有 @Type()，plainToInstance 不知道嵌套属性的构造函数
 */
class AddressDto {
  @IsString()
  @IsNotEmpty()
  public street!: string;

  @IsString()
  @IsNotEmpty()
  public city!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: '邮编必须是 6 位数字' })
  public zipCode!: string;
}

class CreateOrderDto {
  @IsInt()
  @Min(1)
  public userId!: number;

  // 嵌套对象：需要 @ValidateNested 和 @Type
  @ValidateNested({ each: false }) // 步骤 2：递归验证这个嵌套对象。each是false表示只验证address本身
  @Type(() => AddressDto) // 步骤1：告诉transformer，创建AddressDto实例，把普通对象转成AddressDto实例
  public shippingAddress!: AddressDto;

  // 嵌套数组：each: true 表示验证数组中每一项
  @IsArray() // 步骤3：必须是数组
  @ValidateNested({ each: true }) // 步骤2：数组里每个元素都递归验证。each是true表示对数组里每个元素调用 validate()。不加 each: true 的话，@ValidateNested 会验证整个数组本身
  @Type(() => OrderItemDto) // 步骤1：每个元素转成 OrderItemDto 实例
  public items!: OrderItemDto[];
}

class OrderItemDto {
  @IsInt()
  @Min(1)
  public productId!: number;

  @IsInt()
  @Min(1)
  @Max(999)
  public quantity!: number;
}

// ============================================================
// 示例 3：class-transformer —— 数据转换
// ============================================================

/**
 * 【场景】从 API 响应中排除敏感字段、转换日期格式、重命名字段
 * 【语法点】@Exclude()、@Expose()、@Transform()
 * 【NestJS 设计意图】数据脱敏和格式转换应是声明式的，而非在 Service 中手动删字段
 */

/* 
NestJS 默认是 exposeAll（全部暴露），即：只要没加 @Exclude()，字段都会出现在响应里。
*/
class UserResponseDto {
  // 暴露此字段（配合 excludeExtraneousValues: true 或 strategy: 'excludeAll' 使用）
  @Expose()
  public id!: number;
  /* Expose 单词含义是暴露 */

  @Expose()
  public email!: string;

  @Expose()
  public name!: string;

  // 排除此字段 —— 永远不会出现在序列化结果中
  @Exclude()
  public password!: string;

  // 转换：将 Date日期对象 转为可读字符串
  @Expose()
  @Transform(({ value }: { value: Date }) => value?.toISOString() ?? null)
  public createdAt!: string;
  /* 
  @Transform — 序列化/反序列化时改字段值，只帮你做类型/格式转换，不做验证
  Date 转字符串、字符串转数字、脱敏手机号、拼接字段等，都靠它
  { value }: { value: Date } 是解构赋值：
    写法1（不解构）：@Transform((params: TransformFnParams) => params.value?.toISOString() ?? null)
    写法2（完整，拿到所有字段）：@Transform(({ value, key, obj, type }: TransformFnParams) => value?.toISOString() ?? null)
    写法3（最简洁，但只拿到 value）：@Transform(({ value }: { value: Date }) => value?.toISOString() ?? null)

  常用的几个字段
    value	当前字段的原始值
    key	字段名（这里 "createdAt"）
    obj	整个对象实例
    type	转换方向：plainToClass 或 classToPlain
  更复杂的案例：
    @Transform(({ value, obj }) => {
      // 根据另一个字段的值来决定输出格式
      return obj.locale === 'zh' ? formatCN(value) : formatISO(value);
    })
  */

  // 重命名：API 返回 displayName，但数据库字段是 name
  @Expose({ name: 'displayName' })
  public nameAlias!: string;
}

// class-transformer 使用的完整示例
const rawUser: Record<string, unknown> = {
  id: 1,
  email: 'test@example.com',
  name: '张三',
  password: 'hashed-password',
  createdAt: new Date('2024-01-01'),
};

// plainToInstance：将普通对象转换为 DTO 实例（执行 @Exclude/@Expose/@Transform）
/* 把 JSON/数据库查出来的普通对象，转换成指定 class 的实例，并在此过程中执行 @Exclude / @Expose / @Transform 等装饰器。 */
const userDto: UserResponseDto = plainToInstance(UserResponseDto, rawUser, {
  excludeExtraneousValues: true, // 显式开启：只保留 @Expose 的字段
});

// instanceToPlain：将 DTO 实例转换回普通对象（准备发送给前端）
const response: Record<string, unknown> = instanceToPlain(userDto);
console.log('序列化后（password 被排除）:', JSON.stringify(response));
// 输出: {"id":1,"email":"test@example.com","displayName":"张三","createdAt":"2024-01-01T00:00:00.000Z"}

// ============================================================
// 示例 4：内置管道详解
// ============================================================

/**
 * 【场景】使用 NestJS 内置管道进行参数转换和验证
 * 【语法点】ParseIntPipe、ParseUUIDPipe、DefaultValuePipe、ParseBoolPipe
 * 【NestJS 设计意图】管道在数据到达 Controller 之前执行，实现「关注点分离」
 *                   管道可以做两件事：转换（Transformation）和验证（Validation）
 */

class PipeDemoController {
  @Get(':id')
  // ParseIntPipe: 将字符串 "123" 转为数字 123，非数字则抛 400
  public findOne(@Param('id', ParseIntPipe) id: number): void {
    console.log(`id 类型: ${typeof id}`); // number，不是 string
  }

  @Get('uuid/:uuid')
  // ParseUUIDPipe: 验证参数是否为合法的 UUID，如果非法抛400
  public findByUuid(@Param('uuid', ParseUUIDPipe) uuid: string): void {
    console.log(`UUID: ${uuid}`);
  }

  @Get()
  // DefaultValuePipe: 如果查询参数未传，使用默认值
  public findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): void {
    console.log(`分页查询: page=${page}, limit=${limit}`);
  }

  // 管道组合：DefaultValuePipe → ParseIntPipe（管道按从左到右顺序执行）
  @Get('list')
  public list(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number): void {
    // 如果没有传 page 参数：
    // 1. DefaultValuePipe 注入默认值 "1"
    // 2. ParseIntPipe 将 "1" 转换为 1
    console.log(`page: ${page} (type: ${typeof page})`);
  }
}

// ============================================================
// 示例 5：全局 ValidationPipe 配置
// ============================================================

/**
 * 【场景】在 main.ts 中全局配置 ValidationPipe
 * 【语法点】ValidationPipe 的核心配置选项
 * 【NestJS 设计意图】统一验证行为，避免在每个 Controller 上重复配置
 */
const globalValidationPipeConfig = {
  // whitelist: true —— 自动剥离 DTO 中未定义的属性（安全关键选项）
  whitelist: true,

  // forbidNonWhitelisted: true —— 禁止非白名单里的属性，如果请求体包含 DTO 中未定义的属性，直接抛 400
  // 更严格的安全策略：防止客户端传入恶意字段
  forbidNonWhitelisted: true,

  // transform: true —— 自动类型转换（如字符串 "123" → 数字 123）
  // 必须开启！否则 @Param('id', ParseIntPipe) 在某些场景可能不工作
  transform: true,

  // transformOptions.enableImplicitConversion —— class-transformer 的隐式类型转换
  // 如：DTO 中 age: number，前端传 "25" 会自动转为 25
  transformOptions: {
    enableImplicitConversion: true,
  },
  /* Implicit 隐式  Conversion 转换 */

  disableErrorMessages: false,
  // disableErrorMessages: true —— 生产环境可关闭详细错误信息（防止信息泄露）

  validationError: {
    target: false,
    value: true,
  },
  // validationError.target: false —— 不在错误中暴露原始输入数据
} as const;

/**
 * 在 main.ts 中应用：
 * app.useGlobalPipes(new ValidationPipe(globalValidationPipeConfig));
 *
 * 更好的方式（让 Pipe 也能注入依赖）：
 * @Module({
 *   providers: [{ provide: APP_PIPE, useClass: ValidationPipe }],
 * })
 */

// ============================================================
// 示例 6：自定义管道 —— 实现 PipeTransform 接口
// ============================================================

/**
 * 【场景】实现一个自定义验证/转换管道
 * 【语法点】实现 PipeTransform<T, R> 接口，transform() 方法做转换或抛异常
 * 【NestJS 设计意图】管道是可组合的：内置管道处理通用逻辑，自定义管道处理业务特定逻辑
 */

// 自定义管道：将字符串转为 Trim 后的字符串，并限制长度
@Injectable()
class TrimAndLengthPipe implements PipeTransform<string, string> {
  constructor(
    private readonly minLength: number,
    private readonly maxLength: number,
  ) {}

  public transform(value: string, metadata: ArgumentMetadata): string {
    // metadata.type 告诉我们这个参数类别，是来自 body/param/query/custom
    console.log(`[TrimAndLengthPipe] 处理 ${metadata.type} 参数 "${metadata.data}"`);

    if (typeof value !== 'string') {
      throw new BadRequestException('参数必须是字符串');
    }

    const trimmed: string = value.trim();

    if (trimmed.length < this.minLength) {
      throw new BadRequestException(`参数 "${metadata.data}" 长度不能少于 ${this.minLength} 个字符`);
    }

    if (trimmed.length > this.maxLength) {
      throw new BadRequestException(`参数 "${metadata.data}" 长度不能超过 ${this.maxLength} 个字符`);
    }

    return trimmed;
  }
}

// 自定义管道：将逗号分隔的字符串转为数组
@Injectable()
class ParseCommaSeparatedPipe implements PipeTransform<string, string[]> {
  public transform(value: string, _metadata: ArgumentMetadata): string[] {
    if (!value) return [];
    return value
      .split(',') // 1. 按逗号切开
      .map((s: string) => s.trim()) // 2. 每项去前后空格
      .filter(Boolean); // 3. 过滤空字符串 等价于 .filter(s => Boolean(s) === true)  // 因为空字符串 "" 转布尔是 false，所以被过滤掉
  }
}

// 使用自定义管道
class CustomPipeDemoController {
  @Get()
  public search(@Query('keyword', new TrimAndLengthPipe(1, 100)) keyword: string): object {
    return { keyword };
  }

  @Get()
  public byIds(@Query('ids', new ParseCommaSeparatedPipe()) ids: string[]): object {
    // GET /api?ids=1,2,3 → ids = ['1', '2', '3']
    return { ids };
  }
}

// ============================================================
// 示例 7：DTO 与 TS interface 的关键区别
// ============================================================

/**
 * 【场景】解释为什么 NestJS 的 DTO 必须是 class 而不能是 interface
 * 【核心区别】
 *   - interface：编译后完全擦除，运行时不存在 → 无法获取元数据 → 无法验证
 *   - class：编译后保留，运行时存在 → 装饰器元数据可反射 → 可以做验证
 */

// ❌ interface 在编译后消失，class-validator 装饰器无法应用
// interface CreateUserInterface {  // 编译后什么都不留下
//   @IsString() name: string;      // 编译错误：装饰器不能用于 interface
// }

// ✅ class 编译后保留，验证框架可以读取其装饰器元数据
// class CreateUserClass {           // 编译后：function CreateUserClass() {}
//   @IsString() name: string;       // 运行时：Reflect.metadata('validation', ...)
// }

// 演示：运行时验证 DTO
const demonstrateDtoValidation = async (): Promise<void> => {
  const invalidDto: CreateUserDto = plainToInstance(CreateUserDto, {
    name: 'A', // 太短（少于 2 字符）
    email: 'invalid', // 不是合法邮箱
    password: '123', // 不符合密码强度
  });

  const errors = await validate(invalidDto);
  console.log(`验证到 ${errors.length} 个错误：`);
  for (const error of errors) {
    console.log(`  - ${error.property}: ${JSON.stringify(error.constraints)}`);
  }
};

// ============================================================
// ❌ 常见错误 1：DTO 属性未加装饰器导致验证失效
// ============================================================

/**
 * 【错误现象】DTO 中某个字段没有加验证装饰器，恶意数据可以随意传入
 * 【错误原因】class-validator 只检查有装饰器的属性
 * 【正确写法】所有需要验证的字段都要加对应的装饰器，
 *            同时开启 forbidNonWhitelisted: true 阻止未定义字段
 */

// ❌ 错误写法：
// class BadDto {
//   name: string;   // 没有验证装饰器！任何值都能通过
//   email: string;
// }

// ✅ 正确写法：
// class GoodDto {
//   @IsString()
//   @MinLength(2)
//   name: string;     // 有验证装饰器
//
//   @IsEmail()
//   email: string;
// }

// ============================================================
// ❌ 常见错误 2：ValidationPipe 未全局注册
// ============================================================

/**
 * 【错误现象】DTO 定义了验证规则，但不生效，任何数据都能通过
 * 【错误原因】ValidationPipe 没有注册（全局或局部），DTO 只是普通类
 * 【正确写法】在 main.ts 中 app.useGlobalPipes(new ValidationPipe(...))
 *            或使用 APP_PIPE Token 在模块中注册
 */

// ❌ 错误：
// // main.ts 中忘记了：
// // app.useGlobalPipes(new ValidationPipe());
// @Post()
// create(@Body() dto: CreateUserDto) {
//   // dto 的类型虽然有装饰器，但没有管道执行验证
// }

// ✅ 正确：
// // main.ts 中：
// app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
// // Controller 中正常使用即可

// ============================================================
// ❌ 常见错误 3：@IsInt() 验证前端传来的数字字符串失败
// ============================================================

/**
 * 【错误现象】前端传 { age: "25" }（字符串），但 DTO 用 @IsInt() 验证失败
 * 【错误原因】HTTP 请求中的值默认都是字符串，@IsInt() 检查值是整数类型
 * 【正确写法】
 *   方案 1：开启 transform: true + enableImplicitConversion（自动转换）
 *   方案 2：使用 @Type(() => Number) + @IsInt()（年龄是整数）
 */

// ❌ 错误写法：
// class BadNumberDto {
//   @IsInt()                 // 前端传 "25" 字符串 → 没转换直接验证失败
//   age: number;
// }

// ✅ 正确写法方案 1（全局配置）：
// app.useGlobalPipes(new ValidationPipe({
//   transform: true,
//   transformOptions: { enableImplicitConversion: true },
// }));

// ✅ 正确写法方案 2（DTO 层面）：
class NumberDto {
  @Type(() => Number) // 先用 class-transformer 转换
  @IsInt()
  @Min(0)
  @Max(150)
  public age!: number;
}

console.log('=== 第 06 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - DTO 必须是 class（运行时存在），不能用 interface（编译时擦除）
 *   - class-validator 装饰器声明验证规则，class-transformer 做数据转换
 *   - ValidationPipe 的 whitelist 和 forbidNonWhitelisted 是安全关键配置
 *   - 内置管道：ParseIntPipe、ParseUUIDPipe、DefaultValuePipe 简化常见转换
 *   - 自定义管道实现 PipeTransform 接口，可组合使用
 *   - transform: true 是必要的，否则管道转换可能不生效
 *
 * 【与前后章的关联】
 *   - 第 03 章：@Body() 接收的 DTO 就是本章定义的类型
 *   - 第 05 章：Service 的输入参数类型由 DTO 保证
 *   - 第 07 章：验证失败的异常会被 ExceptionFilter 统一格式化
 *
 * 【常见面试题】
 *   Q: 为什么 NestJS 的 DTO 要用 class 而不是 interface？
 *   A: TS interface 在编译后擦除，运行时不存在，无法通过反射读取装饰器元数据。
 *      class 保留到运行时，class-validator 可以读取装饰器进行验证。
 *
 *   Q: whitelist 和 forbidNonWhitelisted 的区别？
 *   A: whitelist: true 自动剥离未定义属性（不报错）；
 *      forbidNonWhitelisted: true 存在未定义属性时抛 400（更严格）。
 *      两者可同时开启，forbidNonWhitelisted 优先级更高。
 */

// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能写出包含 5 种以上验证装饰器的完整 DTO
 * [ ] 能使用 @ValidateNested 验证嵌套对象
 * [ ] 能编写自定义管道（实现 PipeTransform）
 * [ ] 能解释 DTO class 与 TS interface 的核心区别
 * [ ] 能指出 1 个常见错误及修复方法
 */
