class ToastStore {
  list = $state([]);

  add(message, type = 'success') {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { id, message, type };
    this.list = [...this.list, newToast];

    setTimeout(() => {
      this.remove(id);
    }, 4000);
  }

  success(message) {
    this.add(message, 'success');
  }

  error(message) {
    this.add(message, 'error');
  }

  warning(message) {
    this.add(message, 'warning');
  }

  info(message) {
    this.add(message, 'info');
  }

  remove(id) {
    this.list = this.list.filter(t => t.id !== id);
  }
}

export const toasts = new ToastStore();
