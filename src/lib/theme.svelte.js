import { browser } from '$app/environment';

class ThemeStore {
  current = $state('system'); // 'light' | 'dark' | 'system'
  isDark = $state(false);

  constructor() {
    if (browser) {
      const saved = localStorage.getItem('theme') || 'system';
      this.setTheme(saved);

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (this.current === 'system') {
          this.applyTheme('system');
        }
      });
    }
  }

  setTheme(mode) {
    this.current = mode;
    if (browser) {
      localStorage.setItem('theme', mode);
      this.applyTheme(mode);
    }
  }

  applyTheme(mode) {
    if (!browser) return;
    let dark = false;
    if (mode === 'dark') {
      dark = true;
    } else if (mode === 'light') {
      dark = false;
    } else {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    this.isDark = dark;
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  toggle() {
    if (this.isDark) {
      this.setTheme('light');
    } else {
      this.setTheme('dark');
    }
  }
}

export const theme = new ThemeStore();
