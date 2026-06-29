import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../utils/api';

interface User {
  id: number;
  email: string;
  name: string | null;
  role: 'USER' | 'EDITOR' | 'ADMIN';
  isActive: boolean;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const accessToken = ref(localStorage.getItem('access_token') || '');
  const refreshToken = ref(localStorage.getItem('refresh_token') || '');

  const isAuthenticated = computed(() => !!accessToken.value);

  async function login(email: string, password: string): Promise<void> {
    const res = await api.post<{ user: User; tokens: Tokens }>('/auth/login', {
      email,
      password,
    });
    setAuth(res.data.user, res.data.tokens);
  }

  async function register(
    email: string,
    password: string,
    name: string,
  ): Promise<void> {
    const res = await api.post<{ user: User; tokens: Tokens }>(
      '/auth/register',
      { email, password, name },
    );
    setAuth(res.data.user, res.data.tokens);
  }

  function setAuth(newUser: User, tokens: Tokens): void {
    user.value = newUser;
    accessToken.value = tokens.accessToken;
    refreshToken.value = tokens.refreshToken;
    localStorage.setItem('access_token', tokens.accessToken);
    localStorage.setItem('refresh_token', tokens.refreshToken);
  }

  function logout(): void {
    user.value = null;
    accessToken.value = '';
    refreshToken.value = '';
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  return { user, accessToken, refreshToken, isAuthenticated, login, register, logout };
});
