<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { api } from '$lib/api.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { theme } from '$lib/theme.svelte.js';

  let { hide = false } = $props();

  let showNotifications = $state(false);
  let notifications = $state([]);
  let pollInterval = null;

  let unreadCount = $derived(notifications.filter(n => !n.read).length);

  async function fetchNotifications() {
    if (!auth.token) return;
    try {
      notifications = await api.get('/notifications');
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  }

  async function markAsRead(id) {
    try {
      await api.put(`/notifications/${id}/read`);
      notifications = notifications.map(n => n._id === id ? { ...n, read: true } : n);
    } catch (err) {
      console.error(err);
    }
  }

  async function markAllRead() {
    try {
      await api.put('/notifications/read-all');
      notifications = notifications.map(n => ({ ...n, read: true }));
    } catch (err) {
      console.error(err);
    }
  }

  function handleLogout() {
    auth.clearSession();
    showNotifications = false;
    goto('/');
  }

  onMount(() => {
    if (auth.token) {
      fetchNotifications();
      pollInterval = setInterval(fetchNotifications, 7000);
    }
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });

  $effect(() => {
    if (auth.token) {
      fetchNotifications();
      if (!pollInterval) {
        pollInterval = setInterval(fetchNotifications, 7000);
      }
    } else {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      notifications = [];
    }
  });
</script>

<nav 
  class="sticky top-0 z-40 bg-app-card border-b border-app-border shadow-sm backdrop-blur-md bg-opacity-95 navbar-scroll-transition transform transition-colors duration-200
    {hide ? '-translate-y-full' : 'translate-y-0'}"
>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between h-16">
      <!-- Left side -->
      <div class="flex items-center space-x-8">
        <a href="/" class="flex items-center space-x-2.5 group">
          <div class="h-9 w-9 rounded-xl bg-brand-orange flex items-center justify-center text-white font-heading font-extrabold text-lg shadow-sm group-hover:scale-105 transition-transform">
            G
          </div>
          <span class="text-app-text font-heading text-lg font-bold tracking-tight">{i18n.t('brandName')}</span>
        </a>

        {#if auth.user}
          <div class="hidden md:flex space-x-1">
            {#if auth.user.role === 'retailer'}
              <a href="/retailer" class="px-3.5 py-2 text-sm font-semibold rounded-lg text-app-text hover:text-brand-orange hover:bg-app-cardSubtle transition-colors">
                {i18n.t('retailerDashboard')}
              </a>
            {:else if auth.user.role === 'wholesaler'}
              <a href="/wholesaler" class="px-3.5 py-2 text-sm font-semibold rounded-lg text-app-text hover:text-brand-orange hover:bg-app-cardSubtle transition-colors">
                {i18n.t('wholesalerDashboard')}
              </a>
            {:else if auth.user.role === 'admin'}
              <a href="/admin" class="px-3.5 py-2 text-sm font-semibold rounded-lg text-app-text hover:text-brand-orange hover:bg-app-cardSubtle transition-colors">
                {i18n.t('adminPanel')}
              </a>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Right side -->
      <div class="flex items-center space-x-3">
        <!-- Theme Toggle Button -->
        <button 
          onclick={() => theme.toggle()}
          class="p-2 rounded-lg text-app-muted hover:text-app-text hover:bg-app-cardSubtle transition-colors focus:outline-none"
          title="Toggle Light / Dark Mode"
          aria-label="Toggle Light or Dark Theme"
        >
          {#if theme.isDark}
            <!-- Sun Icon for Light Mode -->
            <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          {:else}
            <!-- Moon Icon for Dark Mode -->
            <svg class="w-5 h-5 text-brand-olive" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          {/if}
        </button>

        {#if auth.user}
          <!-- Notifications -->
          <div class="relative">
            <button 
              onclick={() => showNotifications = !showNotifications}
              class="relative p-2 rounded-lg text-app-muted hover:text-app-text hover:bg-app-cardSubtle focus:outline-none transition-colors"
              aria-label="View notifications"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {#if unreadCount > 0}
                <span class="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-brand-orange ring-2 ring-app-card"></span>
              {/if}
            </button>

            {#if showNotifications}
              <button 
                onclick={() => showNotifications = false}
                class="fixed inset-0 h-full w-full cursor-default z-10 bg-transparent focus:outline-none"
                tabindex="-1"
                aria-label="Close notification menu"
              ></button>
              
              <div class="absolute right-0 mt-2 w-80 sm:w-96 bg-app-card rounded-2xl shadow-2xl border border-app-border py-1 z-20 overflow-hidden transform origin-top-right transition-all">
                <div class="px-4 py-2.5 border-b border-app-border flex justify-between items-center bg-app-cardSubtle">
                  <span class="font-heading text-sm font-semibold text-app-text">Notifications</span>
                  {#if unreadCount > 0}
                    <button 
                      onclick={markAllRead}
                      class="text-xs font-semibold text-brand-orange hover:underline transition"
                    >
                      Mark all as read
                    </button>
                  {/if}
                </div>
                
                <div class="max-h-72 overflow-y-auto divide-y divide-app-border">
                  {#if notifications.length === 0}
                    <div class="py-8 text-center text-app-muted text-sm">
                      No notifications yet
                    </div>
                  {:else}
                    {#each notifications as notif}
                      <div class="p-3.5 hover:bg-app-cardSubtle transition flex items-start space-x-3 {notif.read ? '' : 'bg-brand-sage/20'}">
                        <div class="flex-shrink-0 mt-1">
                          {#if notif.type === 'request_received'}
                            <span class="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
                          {:else if notif.type === 'request_accepted' || notif.type === 'response_received'}
                            <span class="h-2 w-2 rounded-full bg-brand-orange inline-block"></span>
                          {:else}
                            <span class="h-2 w-2 rounded-full bg-app-muted inline-block"></span>
                          {/if}
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-xs text-app-text font-medium leading-relaxed">{notif.message}</p>
                          <span class="text-[10px] text-app-muted mt-1 block">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {#if !notif.read}
                          <button 
                            onclick={() => markAsRead(notif._id)}
                            class="flex-shrink-0 text-app-muted hover:text-app-text text-xs py-0.5 px-1.5 hover:bg-app-border rounded"
                            title="Mark as read"
                          >
                            ✓
                          </button>
                        {/if}
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>

          <!-- User Details / Logout -->
          <div class="flex items-center space-x-3 pl-2 border-l border-app-border">
            <div class="hidden lg:block text-right">
              <span class="block text-xs font-semibold text-app-text">
                {auth.user.email}
              </span>
              <span class="block text-[10px] text-brand-orange font-bold uppercase tracking-wider">
                {auth.user.role}
              </span>
            </div>
            <button 
              onclick={handleLogout}
              class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm text-rose-500 hover:bg-rose-500/10 font-medium transition-colors"
            >
              <span>{i18n.t('logout')}</span>
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        {:else}
          <a href="/auth" class="px-4 py-2 text-sm font-semibold text-app-text hover:text-brand-orange transition-colors">
            {i18n.t('signIn')}
          </a>
          <a href="/auth?register=true" class="px-4 py-2 text-sm font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl transition-all shadow-sm hover-lift">
            {i18n.t('getStarted')}
          </a>
        {/if}
      </div>
    </div>
  </div>
</nav>
