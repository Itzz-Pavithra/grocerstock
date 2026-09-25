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
        } else {
          // Fallback check cookie
          const cookieMatch = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
          if (cookieMatch) {
            this.token = decodeURIComponent(cookieMatch[1]);
          }
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
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        document.cookie = `token=${encodeURIComponent(token)}; path=/; max-age=${30 * 24 * 3600}; SameSite=Lax`;
      } catch (e) {
        console.warn('Could not persist auth to storage:', e);
      }
    }
  }

  clearSession() {
    this.user = null;
    this.token = null;
    if (browser) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
      } catch (e) {
        console.warn('Could not clear auth from storage:', e);
      }
    }
  }

  get isAuthenticated() {
    return Boolean(this.token && this.user);
  }

  get role() {
    return this.user?.role || null;
  }
}

export const auth = new AuthStore();
