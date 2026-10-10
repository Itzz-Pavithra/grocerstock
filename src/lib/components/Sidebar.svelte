<script>
  import { auth } from '$lib/auth.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    FileText,
    Truck,
    MapPin,
    TrendingUp,
    BarChart3,
    ShieldCheck,
    Users,
    Settings,
    LogOut,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Coins,
    Layers,
    Warehouse,
    Store,
    SlidersHorizontal,
    Bell,
    CheckCircle2,
    Calendar,
    Award,
    Sun,
    Moon
  } from 'lucide-svelte';

  let {
    role = 'retailer',
    activeTab = 'overview',
    onSelectTab = () => {},
    badges = {}
  } = $props();

  let isCollapsed = $state(false);
  let isMobileOpen = $state(false);

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
  }

  function toggleMobile() {
    isMobileOpen = !isMobileOpen;
  }

  function handleTabClick(tabId) {
    onSelectTab(tabId);
    isMobileOpen = false;
  }

  const retailerItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'My Store Inventory', icon: Store, badgeKey: 'lowStock' },
    { id: 'requests', label: 'Stock Requests', icon: ShoppingCart },
    { id: 'quotations', label: 'Quotations & Bids', icon: FileText, badgeKey: 'pendingBids' },
    { id: 'optimizer', label: 'Procurement Optimizer', icon: Sparkles, highlight: true },
    { id: 'groupbuy', label: 'Group Buying', icon: Layers },
    { id: 'orders', label: 'Orders & Tracking', icon: Truck, badgeKey: 'activeOrders' },
    { id: 'map', label: 'Supplier Map', icon: MapPin },
    { id: 'priceintelligence', label: 'Price Intelligence', icon: TrendingUp },
    { id: 'stockout', label: 'Stockout Predictions', icon: Calendar },
    { id: 'profitability', label: 'Store Profitability', icon: Coins }
  ];

  const wholesalerItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'incoming', label: 'Incoming Requests', icon: ShoppingCart, badgeKey: 'incomingRequests', highlight: true },
    { id: 'quotations', label: 'My Submitted Bids', icon: FileText },
    { id: 'inventory', label: 'Stock & Catalog', icon: Warehouse, badgeKey: 'lowStock' },
    { id: 'orders', label: 'Fulfillment & Orders', icon: Truck, badgeKey: 'activeOrders' },
    { id: 'groupbuy', label: 'Bulk Group Offers', icon: Layers },
    { id: 'profitability', label: 'Wholesale Profitability', icon: Coins },
    { id: 'performance', label: 'Supplier Performance', icon: Award },
    { id: 'location', label: 'Delivery Area & Map', icon: MapPin },
    { id: 'profile', label: 'Company Profile', icon: Settings }
  ];

  const adminItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'verification', label: 'Business Verification', icon: ShieldCheck, badgeKey: 'pendingVerifications', highlight: true },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'categories', label: 'Categories Master', icon: Layers },
    { id: 'settings', label: 'System Settings', icon: Settings },
    { id: 'orders', label: 'Orders & Disputes', icon: Truck, badgeKey: 'activeDisputes' },
    { id: 'audit', label: 'Audit Logs', icon: FileText }
  ];

  let navItems = $derived(
    role === 'wholesaler' ? wholesalerItems : role === 'admin' ? adminItems : retailerItems
  );

  let roleLabel = $derived(
    role === 'wholesaler' ? 'Wholesale Supplier' : role === 'admin' ? 'System Administrator' : 'Grocery Retailer'
  );

  let roleBadgeColor = $derived(
    role === 'wholesaler' ? 'bg-[#D4A72C]/20 text-[#D4A72C]' : role === 'admin' ? 'bg-[#B9DDE5]/30 text-[#B9DDE5]' : 'bg-[#D4A72C]/20 text-[#D4A72C]'
  );
</script>

<!-- Mobile Hamburger Toggle Bar -->
<div class="lg:hidden flex items-center justify-between px-4 py-3 bg-[#202124] text-[#F7F5EF] border-b border-white/10 sticky top-0 z-40">
  <div class="flex items-center space-x-2.5">
    <div class="w-8 h-8 rounded-xl bg-[#D4A72C] flex items-center justify-center font-black text-[#202124] text-sm shadow">
      GS
    </div>
    <div>
      <span class="font-extrabold font-heading text-sm text-[#F7F5EF] tracking-tight">GrocerStock</span>
      <span class="block text-[10px] text-[#B9DDE5] font-medium leading-none">{roleLabel}</span>
    </div>
  </div>

  <div class="flex items-center space-x-2">
    <button
      onclick={() => theme.toggle()}
      type="button"
      class="p-2 rounded-xl bg-white/10 text-[#F7F5EF] hover:bg-white/20 transition-colors"
      title={theme.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={theme.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {#if theme.isDark}
        <Sun class="w-5 h-5 text-[#D4A72C]" />
      {:else}
        <Moon class="w-5 h-5 text-[#B9DDE5]" />
      {/if}
    </button>

    <button
      onclick={toggleMobile}
      type="button"
      class="p-2 rounded-xl bg-white/10 text-[#F7F5EF] hover:bg-white/20 transition-colors"
      aria-label="Toggle navigation menu"
    >
      {#if isMobileOpen}
        <X class="w-5 h-5" />
      {:else}
        <Menu class="w-5 h-5" />
      {/if}
    </button>
  </div>
</div>

<!-- Mobile Backdrop -->
{#if isMobileOpen}
  <button
    onclick={() => isMobileOpen = false}
    class="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
    aria-label="Close navigation overlay"
  ></button>
{/if}

<!-- Sidebar Container -->
<aside
  class="
    fixed lg:sticky top-0 left-0 h-screen z-50 flex flex-col justify-between
    bg-[#202124] text-[#F7F5EF] border-r border-white/10 transition-all duration-300 ease-in-out
    {isCollapsed ? 'w-20' : 'w-72'}
    {isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
  "
>
  <!-- Top: Brand Header -->
  <div class="p-5 border-b border-white/10 flex items-center justify-between">
    <div class="flex items-center space-x-3 overflow-hidden">
      <div class="w-10 h-10 shrink-0 rounded-2xl bg-[#D4A72C] flex items-center justify-center font-extrabold text-[#202124] text-lg shadow-md glow-mustard">
        GS
      </div>
      {#if !isCollapsed}
        <div class="truncate">
          <div class="font-extrabold font-heading text-base tracking-tight text-white flex items-center gap-1.5">
            GrocerStock
            <span class="w-2 h-2 rounded-full bg-[#D4A72C] animate-pulse"></span>
          </div>
          <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 {roleBadgeColor} uppercase tracking-wider">
            {roleLabel}
          </span>
        </div>
      {/if}
    </div>

    <!-- Desktop Collapse Button -->
    <button
      onclick={toggleCollapse}
      type="button"
      class="hidden lg:flex p-1.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors"
      title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
      aria-label="Collapse or expand sidebar"
    >
      {#if isCollapsed}
        <ChevronRight class="w-4 h-4" />
      {:else}
        <ChevronLeft class="w-4 h-4" />
      {/if}
    </button>
  </div>

  <!-- Middle: Navigation Links -->
  <div class="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
    {#each navItems as item (item.id)}
      {@const isActive = activeTab === item.id}
      {@const badgeVal = item.badgeKey ? badges[item.badgeKey] : null}

      <button
        onclick={() => handleTabClick(item.id)}
        type="button"
        title={isCollapsed ? item.label : undefined}
        class="
          w-full flex items-center rounded-2xl text-left transition-all duration-150 group relative
          {isCollapsed ? 'justify-center p-3' : 'px-4 py-3 justify-between'}
          {isActive
            ? 'bg-[#D4A72C] text-[#202124] font-bold shadow-md shadow-[#D4A72C]/20 font-heading'
            : 'text-[#F7F5EF]/80 hover:bg-white/5 hover:text-white font-medium'}
          {item.highlight && !isActive ? 'border border-[#D4A72C]/30' : ''}
        "
      >
        <div class="flex items-center space-x-3 truncate">
          <item.icon class="w-5 h-5 shrink-0 {isActive ? 'text-[#202124]' : item.highlight ? 'text-[#D4A72C]' : 'text-[#B9DDE5]'}" />
          {#if !isCollapsed}
            <span class="text-sm truncate tracking-tight">{item.label}</span>
          {/if}
        </div>

        {#if !isCollapsed}
          <div class="flex items-center space-x-1.5 shrink-0 ml-2">
            {#if badgeVal !== undefined && badgeVal !== null && badgeVal > 0}
              <span class="text-[10px] font-black px-2 py-0.5 rounded-full {isActive ? 'bg-[#202124] text-[#D4A72C]' : 'bg-[#D4A72C] text-[#202124]'}">
                {badgeVal}
              </span>
            {/if}
            {#if item.highlight && !isActive}
              <span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-[#D4A72C]/20 text-[#D4A72C] uppercase tracking-wider">
                New
              </span>
            {/if}
          </div>
        {:else if badgeVal !== undefined && badgeVal !== null && badgeVal > 0}
          <!-- Collapsed badge dot -->
          <span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#D4A72C]"></span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Bottom: User Card & Theme Toggle & Logout -->
  <div class="p-3 border-t border-white/10 bg-black/20">
    <div class="flex items-center {isCollapsed ? 'flex-col gap-2' : 'justify-between'} p-2 rounded-2xl">
      {#if !isCollapsed}
        <div class="truncate max-w-[150px]">
          <div class="text-xs font-bold text-white truncate">{auth.user?.email || 'Logged In User'}</div>
          <div class="text-[10px] text-[#B9DDE5] capitalize truncate">{auth.user?.role || 'User'}</div>
        </div>
      {/if}

      <div class="flex items-center space-x-1">
        <button
          onclick={() => theme.toggle()}
          type="button"
          title={theme.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          class="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          aria-label={theme.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {#if theme.isDark}
            <Sun class="w-4 h-4 text-[#D4A72C]" />
          {:else}
            <Moon class="w-4 h-4 text-[#B9DDE5]" />
          {/if}
        </button>

        <button
          onclick={() => auth.logout('/auth')}
          type="button"
          title="Sign Out"
          class="p-2 rounded-xl hover:bg-rose-500/20 text-white/60 hover:text-rose-400 transition-colors"
          aria-label="Sign Out"
        >
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</aside>
