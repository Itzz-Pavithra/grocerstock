import { browser } from '$app/environment';

class AuthStore {
  user = $state(null);
  token = $state(null);
  initialized = $state(false);

  constructor() {
    if (browser) {
      try {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        if (savedToken && savedUser) {
          this.token = savedToken;
          this.user = JSON.parse(savedUser);
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      }
      this.initialized = true;
    }
  }

  setSession(user, token) {
    this.user = user;
    this.token = token;
    if (browser) {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  clearSession() {
    this.user = null;
    this.token = null;
    if (browser) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
}

export const auth = new AuthStore();
