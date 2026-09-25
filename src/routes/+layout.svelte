<script>
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import Navbar from '$lib/components/Navbar.svelte';
	import { toasts } from '$lib/toasts.svelte.js';
	import { i18n } from '$lib/i18n.svelte.js';
	import { theme } from '$lib/theme.svelte.js';

	let { children } = $props();

	let hideNavbar = $state(false);
	let lastScrollY = $state(0);

	function handleScroll() {
		const currentScrollY = window.scrollY;
		if (currentScrollY > lastScrollY && currentScrollY > 80) {
			hideNavbar = true;
		} else {
			hideNavbar = false;
		}
		lastScrollY = currentScrollY;
	}
</script>

<svelte:window onscroll={handleScroll} />

<svelte:head>
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="icon" type="image/png" href="/favicon.png" />
	<link rel="shortcut icon" href="/favicon.ico" />
	<title>{i18n.t('brandName')} - Local Grocery Stock Request System</title>
	<script>
		(function() {
			try {
				const saved = localStorage.getItem('theme');
				const isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
				if (isDark) {
					document.documentElement.classList.add('dark');
				} else {
					document.documentElement.classList.remove('dark');
				}
			} catch (e) {}
		})();
	</script>
</svelte:head>

<div class="min-h-screen bg-app-bg text-app-text flex flex-col transition-colors duration-200">
	<Navbar hide={hideNavbar} />
	<main class="flex-grow">
		{@render children()}
	</main>
</div>

<!-- Global Toast Notifications -->
<div class="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
	{#each toasts.list as toast (toast.id)}
		<div 
			class="p-4 rounded-xl shadow-xl border text-xs font-medium flex justify-between items-center pointer-events-auto animate-toast transition-all
				{toast.type === 'success' ? 'bg-app-card border-brand-sage text-brand-olive dark:text-brand-cream' : 
				 toast.type === 'warning' ? 'bg-app-card border-amber-300 text-amber-800 dark:text-amber-300' :
				 toast.type === 'info' ? 'bg-app-card border-blue-300 text-blue-800 dark:text-blue-300' :
				 'bg-app-card border-rose-300 text-rose-800 dark:text-rose-300'}"
		>
			<div class="flex items-center space-x-2.5">
				<span class="text-sm font-bold">
					{#if toast.type === 'success'}✓
					{:else if toast.type === 'warning'}⚠️
					{:else if toast.type === 'info'}ℹ️
					{:else}✕
					{/if}
				</span>
				<span>{toast.message}</span>
			</div>
			<button 
				onclick={() => toasts.remove(toast.id)}
				class="ml-4 opacity-60 hover:opacity-100 transition"
				aria-label="Dismiss toast"
			>
				✕
			</button>
		</div>
	{/each}
</div>
