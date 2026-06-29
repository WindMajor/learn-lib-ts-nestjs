<template>
  <div class="auth-page">
    <div class="auth-card">
      <h2>🔐 登录</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="form.email" type="email" placeholder="请输入邮箱" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="form.password" type="password" placeholder="请输入密码" required />
        </div>
        <div v-if="error" class="form-group" style="color: #ff4d4f; font-size: 14px">
          {{ error }}
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" :disabled="loading" style="flex: 1">
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </div>
        <p style="text-align: center; margin-top: 16px; font-size: 14px; color: #999">
          还没有账号？
          <router-link to="/register" style="color: #1677ff">立即注册</router-link>
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

const form = reactive({ email: '', password: '' });
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(form.email, form.password);
    router.push('/users');
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message || '登录失败';
    error.value = msg;
  } finally {
    loading.value = false;
  }
}
</script>
