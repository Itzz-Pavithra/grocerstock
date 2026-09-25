<script>
  import { i18n } from '$lib/i18n.svelte.js';
</script>

<div class="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 bg-app-bg text-app-text text-center transition-colors duration-200">
  <div class="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm">
    🚫
  </div>

  <h1 class="text-3xl font-extrabold font-heading text-app-text tracking-tight">Access Denied</h1>

  <p class="text-sm text-app-muted mt-2 max-w-sm leading-relaxed">
    You do not have the required permissions to view this dashboard page. If you believe this is an error, please verify your credentials and role.
  </p>

  <a 
    href="/" 
    class="mt-6 px-6 py-3 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold text-sm rounded-xl transition-all shadow-md hover-lift"
  >
    Back to Home
  </a>
</div>
