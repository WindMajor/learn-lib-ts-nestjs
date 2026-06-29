<template>
  <div class="auth-page">
    <div class="auth-card">
      <h2>📝 注册</h2>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="form.name" type="text" placeholder="请输入用户名" required />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="form.email" type="email" placeholder="请输入邮箱" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input
            v-model="form.password"
            type="password"
            placeholder="至少 6 位，包含大小写字母和数字"
            required
          />
        </div>
        <div v-if="error" class="form-group" style="color: #ff4d4f; font-size: 14px">
          {{ error }}
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" :disabled="loading" style="flex: 1">
            {{ loading ? '注册中...' : '注册' }}
          </button>
        </div>
        <p style="text-align: center; margin-top: 16px; font-size: 14px; color: #999">
          已有账号？
          <router-link to="/login" style="color: #1677ff">去登录</router-link>
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const form = reactive({ name: '', email: '', password: '' });
const loading = ref(false);
const error = ref('');

async function handleRegister() {
  error.value = '';
  loading.value = true;
  try {
    await auth.register(form.email, form.password, form.name);
    router.push('/users');
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message || '注册失败';
    error.value = msg;
  } finally {
    loading.value = false;
  }
}
</script>
