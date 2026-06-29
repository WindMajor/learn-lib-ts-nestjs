import { ref } from 'vue';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const toasts = ref<ToastItem[]>([]);
let nextId = 1;

export function useToast() {
  function show(message: string, type: 'success' | 'error' = 'success') {
    const id = nextId++;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3000);
  }

  return { toasts, show };
}
