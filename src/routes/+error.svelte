<script>
  import { page } from '$app/stores';
  import { i18n } from '$lib/i18n.svelte.js';
</script>

<div class="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 bg-app-bg text-app-text text-center transition-colors duration-200">
  <div class="w-16 h-16 bg-brand-orange/10 text-brand-orange rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm">
    🔍
  </div>

  <h1 class="text-3xl font-extrabold font-heading text-app-text tracking-tight">
    {$page.status === 404 ? 'Page Not Found' : 'Something Went Wrong'}
  </h1>

  <p class="text-sm text-app-muted mt-2 max-w-sm leading-relaxed">
    {$page.status === 404 
      ? "We couldn't find the page you were looking for. It might have been moved or doesn't exist." 
      : ($page.error?.message || "An unexpected error occurred. Please try again later.")}
  </p>

  <a 
    href="/" 
    class="mt-6 px-6 py-3 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold text-sm rounded-xl transition-all shadow-md hover-lift"
  >
    Back to Home
  </a>
</div>
