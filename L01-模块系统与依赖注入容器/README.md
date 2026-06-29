# Level 01：模块系统与依赖注入容器

> **通关标准**：能手写出一个包含 2 个 Module、互相依赖的 NestJS 应用，并解释 IoC 容器如何自动完成依赖解析。

---

## 核心概念速查

| 概念 | 一句话解释 | 你熟悉的对照物 |
|------|-----------|---------------|
| `@Module({})` | 声明一个"功能边界"，告诉 IoC 容器这个域有哪些 Controller/Provider/导入 | Spring 的 `@Configuration` + `@ComponentScan` |
| `@Injectable()` | 标记一个类可以被 IoC 容器管理（可被注入到其他地方） | Spring 的 `@Service`/`@Component`，Go 的接口实现 |
| `@Controller()` | 特殊 Provider，处理 HTTP 请求 | Spring 的 `@RestController`，Express 的 `app.get()` |
| Provider | 任何被 IoC 容器管理的对象（Service/Repository/Factory/Value） | Spring Bean |
| `forwardRef()` | 打破循环依赖的"占位符"——先声明再解析 | Spring 的 `@Lazy`，Go 中不存在（手动管理） |
| Scope | Provider 的生命周期：单例/请求级/瞬态 | Spring 的 singleton/request/prototype |

---

## 与 Express/Spring/Go/Rust 的核心差异

### 【对比 Express】
Express 没有 IoC 容器。你手动 `const app = express()`，手动挂载中间件，手动 `new Service()`。
NestJS 把所有对象的创建和依赖关系交给 IoC 容器，你只负责声明——这就是"控制反转"。

```typescript
// Express: 你控制一切
const userService = new UserService(new DbConnection()); // 手动创建 + 手动注入
app.get('/users', (req, res) => userService.findAll().then(users => res.json(users)));

// NestJS: 容器控制一切
@Injectable() class UserService { constructor(private db: DbConnection) {} }
@Controller('users') class UserController { constructor(private userService: UserService) {} }
// IoC 容器自动: new DbConnection() → new UserService(db) → new UserController(us)
```

### 【对比 Spring Boot】
最接近的对照物。两者的核心差异：

| 特性 | Spring Boot | NestJS |
|------|-------------|--------|
| IoC 实现 | Java 反射 (编译期字节码) | TypeScript 装饰器 + reflect-metadata (运行期) |
| Module 扫描 | `@ComponentScan` 自动扫描 | `@Module` 显式声明——**更严格、更显式** |
| 注入方式 | Field/Setter/Constructor（推荐 Constructor） | 仅 Constructor（TS 的 `emitDecoratorMetadata` 只能保留构造函数参数类型） |
| 循环依赖 | `@Lazy` 延迟注入 | `forwardRef(() => SomeModule)` 函数引用 |

**关键差异**：NestJS 的 Module 必须**显式声明** Provider，不会像 Spring 那样自动扫描。这更啰嗦，但在大型项目中避免了"隐式 Bean 找不到"的问题。

### 【对比 Go (Gin)】
Go 没有运行期反射 IoC。你手动写工厂函数或使用 `wire` 编译期生成。
```go
// Go: 必须手动组装依赖
db := NewDB()
userRepo := NewUserRepo(db)
userService := NewUserService(userRepo)
userHandler := NewUserHandler(userService)
// wire 只是把这些手写代码自动生成了，不是运行期容器
```
NestJS 的优点是你可以"声明"依赖，容器自动完成组装；缺点是有运行时开销。

### 【对比 Rust (Axum)】
Rust 的依赖注入全是编译期行为——trait bounds + generic。
```rust
// Rust: 依赖通过泛型 + trait bound 在编译期确定
async fn get_users<S: UserStore>(State(store): State<S>) -> impl IntoResponse { ... }
```
NestJS 做不到 Rust 的零成本抽象——每个装饰器都有运行时开销。但在快速迭代和服务化场景下，NestJS 的开发效率远超 Rust。

---

## 运行命令

```bash
cd L01-模块系统与依赖注入容器
npm install
npm run start:dev      # 开发模式热重载
npm run build          # 编译检查
npm run start          # 生产模式
```

访问 `http://localhost:3000/cats` 查看 API 响应。

---

## 文件说明

| 文件 | 作用 |
|------|------|
| `src/main.ts` | 应用入口，`NestFactory.create(AppModule)` |
| `src/app.module.ts` | 根模块，组装所有子模块 |
| `src/cats/` | Cats 示例模块——最经典的 NestJS 学习入口 |
| `src/database/` | 自定义 Provider 示例（`useClass`/`useFactory`） |
| `playground.ts` | 沙盒文件，可随意修改实验 |
| `bugs/` | 3 个故意写错的案例，理解 IoC 陷阱 |

---

## 自检清单

- [ ] 能手写 `@Module()` 和 `@Injectable()` 装饰器的完整模块，不借助 CLI
- [ ] 能解释 `forwardRef()` 的原理——NestJS 用函数引用延迟解析
- [ ] 能说明 DEFAULT/REQUEST/TRANSIENT 三种 Scope 对内存和并发的影响
- [ ] 能独立修复 `bugs/` 目录下的 3 个错误
- [ ] 能向只用 Express 的开发者解释清楚"为什么 NestJS 要引入 IoC 容器"
