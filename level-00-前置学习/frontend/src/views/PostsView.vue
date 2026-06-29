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
          <h3>📝 文章列表</h3>
          <button class="btn btn-primary btn-sm" @click="openCreate">+ 新建文章</button>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>标题</th>
                <th>作者</th>
                <th>状态</th>
                <th>浏览量</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="post in posts" :key="(post as PostWithAuthor).id">
                <td>{{ (post as PostWithAuthor).id }}</td>
                <td>{{ (post as PostWithAuthor).title }}</td>
                <td>
                  {{ (post as PostWithAuthor).author?.name || '未知' }}
                </td>
                <td>
                  <span :class="['tag', (post as PostWithAuthor).published ? 'tag-success' : 'tag-warning']">
                    {{ (post as PostWithAuthor).published ? '已发布' : '草稿' }}
                  </span>
                </td>
                <td>{{ (post as PostWithAuthor).viewCount }}</td>
                <td class="actions">
                  <button class="btn btn-default btn-sm" @click="openEdit(post as PostWithAuthor)">编辑</button>
                  <button class="btn btn-danger btn-sm" @click="handleDelete((post as PostWithAuthor).id)">
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="posts.length === 0" class="empty">暂无文章数据</div>
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
        <h3>{{ editing ? '编辑文章' : '新建文章' }}</h3>
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>标题</label>
            <input v-model="form.title" type="text" placeholder="请输入文章标题" required />
          </div>
          <div class="form-group">
            <label>内容</label>
            <input v-model="form.content" type="text" placeholder="请输入文章内容" />
          </div>
          <div class="form-group">
            <label>
              <input v-model="form.published" type="checkbox" style="width: auto; margin-right: 8px" />
              立即发布
            </label>
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

interface PostWithAuthor {
  id: number;
  title: string;
  content: string | null;
  published: boolean;
  viewCount: number;
  author: { id: number; name: string | null } | null;
}

const router = useRouter();
const auth = useAuthStore();
const { toasts, show } = useToast();

const posts = ref<(PostWithAuthor | Record<string, unknown>)[]>([]);
const page = ref(1);
const limit = 10;
const total = ref(0);

const modalVisible = ref(false);
const editing = ref<PostWithAuthor | null>(null);
const saving = ref(false);
const form = ref({ title: '', content: '', published: false });

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));

async function fetchPosts() {
  try {
    const res = await api.get<{ items: PostWithAuthor[]; total: number }>('/posts', {
      params: { page: page.value, limit },
    });
    posts.value = res.data.items as unknown as (PostWithAuthor | Record<string, unknown>)[];
    total.value = res.data.total;
  } catch {
    show('获取文章列表失败', 'error');
  }
}

function openCreate() {
  editing.value = null;
  form.value = { title: '', content: '', published: false };
  modalVisible.value = true;
}

function openEdit(post: PostWithAuthor) {
  editing.value = post;
  form.value = {
    title: post.title,
    content: post.content || '',
    published: post.published,
  };
  modalVisible.value = true;
}

async function handleSubmit() {
  saving.value = true;
  try {
    if (editing.value) {
      await api.patch(`/posts/${editing.value.id}`, form.value);
      show('更新成功');
    } else {
      await api.post('/posts', form.value);
      show('创建成功');
    }
    modalVisible.value = false;
    await fetchPosts();
  } catch {
    show('操作失败', 'error');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(id: number) {
  if (!confirm('确定删除该文章？')) return;
  try {
    await api.delete(`/posts/${id}`);
    show('删除成功');
    await fetchPosts();
  } catch {
    show('删除失败', 'error');
  }
}

function handleLogout() {
  auth.logout();
  router.push('/login');
}

onMounted(fetchPosts);
</script>
