/**
 * ============================================================
 * 第 16 章：WebSocket 实时通信
 * ============================================================
 *
 * 【学习目标】
 *   1. 掌握 @WebSocketGateway() 配置：端口、命名空间、CORS
 *   2. 掌握 @SubscribeMessage() 处理客户端消息
 *   3. 掌握 WebSocketServer 服务端实例和广播消息
 *   4. 理解生命周期钩子：handleConnection、handleDisconnect
 *   5. 了解 Gateway 与 HTTP 模块的共存方式
 *
 * 【与 Express/FastAPI/Spring/Django 的对比提示】
 *   - Express：需要额外的 ws 或 socket.io 库，手动绑定到 HTTP 服务器
 *   - FastAPI：WebSocket 端点（@app.websocket）
 *   - Spring：Spring WebSocket + STOMP 协议
 *   - Django：Django Channels + ASGI
 *
 * 【与 Vue3 前端的协作关系】
 *   - 后端 Gateway = 前端 socket.io-client 连接的服务器
 *   - 命名空间 = 前端连接时的路径（io('http://host/chat')）
 *   - 事件名称必须前后端完全一致
 *   - 实时通知替代前端轮询（setInterval）
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

// ============================================================
// 示例 1：@WebSocketGateway() 基础配置
// ============================================================

/**
 * 【场景】配置 WebSocket 网关的端口、命名空间和 CORS
 * 【语法点】@WebSocketGateway(port, options)
 * 【NestJS 设计意图】Gateway 是 WebSocket 版本的 Controller，
 *                   用类似的装饰器风格处理实时通信
 */

// 命名空间 '/chat' 的网关
@WebSocketGateway(3001, {
  namespace: '/chat', // 客户端连接路径：http://host:3001/chat
  cors: {
    origin: ['http://localhost:5173'], // 允许前端跨域连接
    credentials: true,
  },
  // transports: ['websocket', 'polling'],  // 传输方式（默认两者都支持）
})
class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  // @WebSocketServer() 注入 Socket.io Server 实例
  @WebSocketServer()
  private server!: Server;

  // 记录在线用户（生产环境用 Redis）
  private readonly onlineUsers: Map<
    string,
    { socketId: string; username: string }
  > = new Map();

  /**
   * 网关初始化后调用
   */
  public afterInit(server: Server): void {
    console.log(`[ChatGateway] WebSocket 网关已初始化: ${server.path()}`);
  }

  /**
   * 客户端连接时调用
   */
  public handleConnection(client: Socket): void {
    const clientId: string = client.id;
    console.log(`[ChatGateway] 客户端已连接: ${clientId}`);
  }

  /**
   * 客户端断开时调用
   */
  public handleDisconnect(client: Socket): void {
    const clientId: string = client.id;
    console.log(`[ChatGateway] 客户端已断开: ${clientId}`);

    // 移除在线用户记录
    for (const [userId, info] of this.onlineUsers.entries()) {
      if (info.socketId === clientId) {
        this.onlineUsers.delete(userId);
        console.log(`[ChatGateway] 用户已离线: ${info.username}`);
        break;
      }
    }
  }
}

// ============================================================
// 示例 2：@SubscribeMessage() 处理客户端事件
// ============================================================

/**
 * 【场景】处理客户端发送的消息和加入/离开房间
 * 【语法点】@SubscribeMessage('eventName') 定义事件处理器
 *          @MessageBody() 提取消息体，@ConnectedSocket() 获取 Socket 实例
 * 【NestJS 设计意图】与 HTTP Controller 类似，
 *                   用装饰器声明式定义事件处理，保持代码风格一致
 */
@WebSocketGateway(3001, { namespace: '/chat' })
class ChatMessageGateway {
  @WebSocketServer()
  private server!: Server;

  /**
   * 处理"发送消息"事件
   * 前端发送：socket.emit('sendMessage', { room: 'general', content: 'Hello!' })
   */
  @SubscribeMessage('sendMessage')
  public handleMessage(
    @MessageBody() data: { room: string; content: string },
    @ConnectedSocket() client: Socket,
  ): {
    event: string;
    data: { user: string; content: string; timestamp: string };
  } {
    console.log(`[Chat] 收到消息: ${data.content} (房间: ${data.room})`);

    const response = {
      event: 'newMessage',
      data: {
        user: client.id,
        content: data.content,
        timestamp: new Date().toISOString(),
      },
    };

    // 向房间内所有人广播（包括发送者）
    this.server.to(data.room).emit('newMessage', response.data);

    return response;
  }

  /**
   * 加入房间
   */
  @SubscribeMessage('joinRoom')
  public handleJoinRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ): { event: string; data: { message: string } } {
    client.join(data.room);
    console.log(`[Chat] 客户端 ${client.id} 加入了房间: ${data.room}`);

    // 通知房间内其他人
    this.server.to(data.room).emit('userJoined', {
      user: client.id,
      room: data.room,
      timestamp: new Date().toISOString(),
    });

    return {
      event: 'joined',
      data: { message: `已加入房间 ${data.room}` },
    };
  }

  /**
   * 离开房间
   */
  @SubscribeMessage('leaveRoom')
  public handleLeaveRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ): void {
    client.leave(data.room);
    console.log(`[Chat] 客户端 ${client.id} 离开了房间: ${data.room}`);
  }
}

// ============================================================
// 示例 3：实时通知 Gateway
// ============================================================

/**
 * 【场景】系统通知推送到特定用户（如新评论、点赞、系统消息）
 * 【语法点】向特定 Socket ID 发送消息（点对点通知）
 * 【NestJS 设计意图】Gateway 不仅可以广播，还能精确推送到特定用户
 */

interface NotificationData {
  type: 'COMMENT' | 'LIKE' | 'SYSTEM' | 'MENTION';
  title: string;
  message: string;
  link?: string;
  timestamp: string;
}

@WebSocketGateway(3001, { namespace: '/notifications' })
class NotificationGateway {
  @WebSocketServer()
  private server!: Server;

  // 用户 ID → Socket ID 的映射
  private readonly userSockets: Map<number, string> = new Map();

  /**
   * 用户连接时注册映射关系
   */
  @SubscribeMessage('register')
  public handleRegister(
    @MessageBody() data: { userId: number; token: string },
    @ConnectedSocket() client: Socket,
  ): void {
    // 实际应验证 Token
    this.userSockets.set(data.userId, client.id);
    client.join(`user:${data.userId}`); // 加入用户专属房间
    console.log(`[Notification] 用户 ${data.userId} 已注册通知通道`);
  }

  /**
   * 发送点对点通知（从 HTTP Service 调用）
   */
  public sendToUser(userId: number, notification: NotificationData): boolean {
    const socketId: string | undefined = this.userSockets.get(userId);

    if (socketId) {
      // 向特定 Socket 发送
      this.server.to(socketId).emit('notification', notification);
      return true;
    }

    // 用户不在线，可以存储到数据库等下次上线推送
    return false;
  }

  /**
   * 广播通知给所有在线用户
   */
  public broadcast(notification: NotificationData): void {
    this.server.emit('notification', notification);
  }

  /**
   * 用户断开时清理映射
   */
  @SubscribeMessage('disconnect')
  public handleCustomDisconnect(@ConnectedSocket() client: Socket): void {
    for (const [userId, socketId] of this.userSockets.entries()) {
      if (socketId === client.id) {
        this.userSockets.delete(userId);
        console.log(`[Notification] 用户 ${userId} 断开了通知通道`);
        break;
      }
    }
  }
}

// ============================================================
// 示例 4：Gateway 在 Module 中注册
// ============================================================

/**
 * 【场景】Gateway 必须在模块中注册才能生效
 * 【语法点】providers: [ChatGateway, NotificationGateway]
 * 【NestJS 设计意图】Gateway 也是一个 Provider，遵循同样的 DI 规则
 */

import { Module } from '@nestjs/common';

@Module({
  providers: [ChatGateway, ChatMessageGateway, NotificationGateway],
})
class GatewayModule_16 {}

// 注意：Gateway 默认不依赖任何 HTTP 模块，
// 它使用独立的 WebSocket 端口（如 3001），与 HTTP 服务（3000）共存

// ============================================================
// 示例 5：鉴权 WebSocket 连接
// ============================================================

/**
 * 【场景】验证 WebSocket 连接的合法性（检查 Token）
 * 【语法点】在 handleConnection 中验证 Token
 * 【NestJS 设计意图】WebSocket 也需要鉴权，与 HTTP 的 Guard 概念一致
 */

@WebSocketGateway(3001, { namespace: '/protected' })
class ProtectedGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  // 注入认证服务
  // constructor(private readonly authService: AuthService) {}

  public handleConnection(client: Socket): void {
    try {
      // 从连接参数中获取 Token
      const token: string | undefined =
        (client.handshake.auth['token'] as string | undefined) ||
        (client.handshake.query['token'] as string | undefined);

      if (!token) {
        console.log(`[Protected] 未提供 Token，断开连接: ${client.id}`);
        client.disconnect(true);
        return;
      }

      // 验证 Token
      // const payload = this.authService.verifyToken(token);
      // client.data.user = payload;  // 附加用户信息到 Socket 对象
      console.log(`[Protected] Token 验证通过: ${client.id}`);
    } catch (error) {
      console.log(`[Protected] Token 验证失败，断开连接: ${client.id}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('protectedEvent')
  public handleProtectedEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ): { message: string } {
    console.log(`[Protected] 收到来自 ${client.id} 的敏感操作`);
    return { message: '操作已授权' };
  }
}

// ============================================================
// 示例 6：与前端协作 —— Vue3 socket.io-client
// ============================================================

/**
 * 【场景】Vue3 前端连接后端 WebSocket Gateway
 * 【前端代码示例（注释形式）】
 *
 * // composables/useSocket.ts
 * import { io, Socket } from 'socket.io-client';
 *
 * export function useChatSocket() {
 *   const socket: Socket = io('http://localhost:3001/chat', {
 *     auth: { token: localStorage.getItem('access_token') },
 *     transports: ['websocket'],
 *     reconnection: true,
 *     reconnectionDelay: 1000,
 *     reconnectionAttempts: 5,
 *   });
 *
 *   socket.on('connect', () => {
 *     console.log('已连接到聊天服务器');
 *   });
 *
 *   socket.on('newMessage', (msg) => {
 *     console.log('收到新消息:', msg);
 *     // 更新聊天消息列表
 *   });
 *
 *   socket.on('disconnect', (reason) => {
 *     console.log('断开连接:', reason);
 *   });
 *
 *   const sendMessage = (room: string, content: string) => {
 *     socket.emit('sendMessage', { room, content });
 *   };
 *
 *   const joinRoom = (room: string) => {
 *     socket.emit('joinRoom', { room });
 *   };
 *
 *   return { socket, sendMessage, joinRoom };
 * }
 */

// ============================================================
// ❌ 常见错误 1：Gateway 未导入到模块导致未注册
// ============================================================

/**
 * 【错误现象】Gateway 定义好了但不工作，客户端连接失败
 * 【错误原因】Gateway 类没有在模块的 providers 中注册
 * 【正确写法】Gateway 类必须加到所在模块的 providers 数组中
 */

// ❌ 错误写法：
// @Module({})  // 空的 Module
// class EmptyModule {}

// ✅ 正确写法：
// @Module({
//   providers: [ChatGateway],  // 注册 Gateway
// })

// ============================================================
// ❌ 常见错误 2：前后端 Socket.io 版本不匹配
// ============================================================

/**
 * 【错误现象】客户端连接报错或功能异常
 * 【错误原因】后端的 @nestjs/websockets 依赖的 socket.io 版本
 *            与前端 socket.io-client 版本不兼容
 * 【正确写法】保持前后端版本一致
 */

// 后端 package.json:
// "@nestjs/websockets": "^11.x"
// "socket.io": "^4.x"

// 前端 package.json:
// "socket.io-client": "^4.x"  // 主版本号必须匹配

// ============================================================
// ❌ 常见错误 3：未处理客户端异常断开
// ============================================================

/**
 * 【错误现象】客户端断线后服务器的在线用户列表残留「鬼用户」
 * 【错误原因】只处理了主动断开的 disconnect 事件，
 *            但网络断开、浏览器关闭等情况下服务器不知道客户端已离线
 * 【正确写法】使用 Socket.io 的心跳机制 + handleDisconnect 兜底
 */

// Socket.io 默认有心跳检测（pingInterval / pingTimeout）
// 确保 module 的 handleDisconnect 中清理在线状态
// 生产环境使用 Redis 管理在线状态（多实例共享）

console.log('=== 第 16 章示例代码结束 ===');

// ============================================================
// 本章小结
// ============================================================
/*
 * 【核心要点】
 *   - @WebSocketGateway(port, options) 配置端口、命名空间和 CORS
 *   - @SubscribeMessage('event') 处理客户端事件
 *   - WebSocketServer 获取服务端实例用于广播
 *   - 生命周期：afterInit → handleConnection → 事件处理 → handleDisconnect
 *   - Gateway 必须在模块 providers 中注册
 *   - 鉴权：在 handleConnection 中验证 Token
 *
 * 【与前后章的关联】
 *   - 第 03 章：Gateway 与 Controller 使用类似的装饰器风格
 *   - 第 09 章：WebSocket 鉴权与 HTTP Guard 共享相同的 Token 验证逻辑
 *   - 第 17 章：定时任务 + WebSocket = 定时推送通知
 *
 * 【常见面试题】
 *   Q: WebSocket 和 HTTP 长轮询的区别？
 *   A: WebSocket 是全双工协议，服务器可主动推送，连接建立后开销小。
 *      长轮询是客户端发起 → 服务器保持连接 → 有数据就响应 → 客户端再发起。
 *      WebSocket 适合高频实时场景（聊天、协同编辑），
 *      长轮询适合低频更新（新闻推送）。
 *
 *   Q: 如何扩展 WebSocket 服务（多实例）？
 *   A: 使用 Redis Adapter（socket.io-redis）在多实例间共享连接状态，
 *      或使用专门的消息队列（如 RabbitMQ/Redis pub-sub）广播消息。
 */
// ============================================================
// 🎯 通关检查清单
// ============================================================
/*
 * [ ] 能配置一个基本的 WebSocket Gateway
 * [ ] 能处理客户端事件和广播消息
 * [ ] 能实现用户连接/断开时的状态管理
 * [ ] 能说出 Gateway 与 Controller 的相似之处
 * [ ] 能指出 1 个常见错误及修复方法
 */
