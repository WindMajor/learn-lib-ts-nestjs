<template>
  <div class="app-layout">
    <!-- Toast -->
    <div v-for="t in toasts" :key="t.id" :class="['toast', `toast-${t.type}`]">
      {{ t.message }}
    </div>

    <!-- Header -->
    <header class="app-header">
      <h1>NestJS + Vue3 全栈</h1>
      <nav>
        <router-link to="/users">用户管理</router-link>
        <router-link to="/posts">文章管理</router-link>
        <button class="btn btn-sm btn-default" @click="handleLogout">退出</button>
      </nav>
    </header>

    <!-- Main -->
    <main class="app-main">
      <div class="card">
        <div class="card-header">
          <h3>👥 用户列表</h3>
          <button class="btn btn-primary btn-sm" @click="openCreate">+ 新建用户</button>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.id }}</td>
                <td>{{ user.name || '-' }}</td>
                <td>{{ user.email }}</td>
                <td>
                  <span :class="['tag', roleTag(user.role)]">{{ user.role }}</span>
                </td>
                <td>
                  <span :class="['tag', user.isActive ? 'tag-success' : 'tag-danger']">
                    {{ user.isActive ? '激活' : '禁用' }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn btn-default btn-sm" @click="openEdit(user)">编辑</button>
                  <button class="btn btn-danger btn-sm" @click="handleDelete(user.id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="users.length === 0" class="empty">暂无用户数据</div>
        </div>

        <div class="pagination">
          <button class="btn btn-default btn-sm" :disabled="page <= 1" @click="page--">上一页</button>
          <span>第 {{ page }} 页 / 共 {{ totalPages }} 页</span>
          <button class="btn btn-default btn-sm" :disabled="page >= totalPages" @click="page++">下一页</button>
        </div>
      </div>
    </main>

    <!-- Modal -->
    <div v-if="modalVisible" class="modal-overlay" @click.self="modalVisible = false">
      <div class="modal">
        <h3>{{ editing ? '编辑用户' : '新建用户' }}</h3>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>用户名</label>
            <input v-model="form.name" type="text" placeholder="请输入用户名" />
          </div>
          <div class="form-group">
            <label>邮箱</label>
            <input v-model="form.email" type="email" placeholder="请输入邮箱" />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" type="submit" :disabled="saving">
              {{ saving ? '保存中...' : '保存' }}
            </button>
            <button class="btn btn-default btn-sm" type="button" @click="modalVisible = false">取消</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../composables/useToast';
import api from '../utils/api';

interface User {
  id: number;
  email: string;
  name: string | null;
  role: 'USER' | 'EDITOR' | 'ADMIN';
  isActive: boolean;
}

const router = useRouter();
const auth = useAuthStore();
const { toasts, show } = useToast();

const users = ref<User[]>([]);
const page = ref(1);
const limit = 10;
const total = ref(0);

const modalVisible = ref(false);
const editing = ref<User | null>(null);
const saving = ref(false);
const form = ref({ name: '', email: '' });

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));

async function fetchUsers() {
  try {
    const res = await api.get<{ items: User[]; total: number }>('/users', {
      params: { page: page.value, limit },
    });
    users.value = res.data.items;
    total.value = res.data.total;
  } catch {
    show('获取用户列表失败', 'error');
  }
}

function openCreate() {
  editing.value = null;
  form.value = { name: '', email: '' };
  modalVisible.value = true;
}

function openEdit(user: User) {
  editing.value = user;
  form.value = { name: user.name || '', email: user.email };
  modalVisible.value = true;
}

async function handleSubmit() {
  saving.value = true;
  try {
    if (editing.value) {
      await api.patch(`/users/${editing.value.id}`, form.value);
      show('更新成功');
    } else {
      show('请使用注册功能创建用户，此处仅作更新演示');
    }
    modalVisible.value = false;
    await fetchUsers();
  } catch {
    show('操作失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(id: number) {
  if (!confirm('确定删除该用户？')) return;
  try {
    await api.delete(`/users/${id}`);
    show('删除成功');
    await fetchUsers();
  } catch {
    show('删除失败', 'error');
  }
}

function handleLogout() {
  auth.logout();
  router.push('/login');
}

function roleTag(role: string) {
  const map: Record<string, string> = { ADMIN: 'tag-danger', EDITOR: 'tag-warning', USER: 'tag-primary' };
  return map[role] || 'tag-primary';
}

onMounted(fetchUsers);
</script>
