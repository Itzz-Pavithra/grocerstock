<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { theme } from '$lib/theme.svelte.js';
  import { api } from '$lib/api.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import SupplierMap from '$lib/components/SupplierMap.svelte';
  import DeliveryTrackingModal from '$lib/components/DeliveryTrackingModal.svelte';
  import SupplierScorecardModal from '$lib/components/SupplierScorecardModal.svelte';
  import PriceHistoryModal from '$lib/components/PriceHistoryModal.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import RetailerInventorySection from '$lib/components/RetailerInventorySection.svelte';
  import GroupBuyingSection from '$lib/components/GroupBuyingSection.svelte';
  import ProcurementOptimizerModal from '$lib/components/ProcurementOptimizerModal.svelte';
  import {
    Plus,
    Trash2,
    Truck,
    MapPin,
    TrendingDown,
    ShieldCheck,
    Coins,
    Sparkles,
    AlertTriangle,
    Layers,
    CheckCircle2,
    RefreshCw,
    BarChart3,
    TrendingUp,
    Calendar,
    Package,
    Sun,
    Moon
  } from 'lucide-svelte';

  // Active Tab — matches Sidebar IDs
  let activeTab = $state('overview');

  // Core Data States
  let requests = $state([]);
  let orders = $state([]);
  let categories = $state([]);
  let products = $state([]);
  let retailerRecommendations = $state([]);
  let stockoutPredictions = $state([]);
  let profitabilityData = $state(null);
  let recommendationsLoading = $state(false);
  let stockoutLoading = $state(false);
  let profitabilityLoading = $state(false);
  let dashboardLoading = $state(true);
  let ordersLoading = $state(false);
  let retailerProfile = $state(null);
  let lowStockInventory = $state([]);

  // Pagination & Filters State
  let currentPage = $state(1);
  let totalPages = $state(1);
  let totalRequestsCount = $state(0);
  let searchQuery = $state('');
  let categoryFilter = $state('');
  let statusFilter = $state('');
  let urgencyFilter = $state('');
  let sortQuery = $state('date_desc');

  // Form Mode: Single Product vs Multi-Product Procurement
  let isMultiProduct = $state(false);
  let selectedProductId = $state('');
  let reqProductName = $state('');
  let reqCategoryName = $state('');
  let reqBrand = $state('');
  let reqQuantity = $state(1);
  let reqUnit = $state('kg');
  let reqUrgency = $state('medium');
  let reqDeliveryDate = $state('');
  let reqRemarks = $state('');
  let multiItems = $state([
    { productName: '', category: '', brand: '', quantity: 10, unit: 'kg', remarks: '' },
    { productName: '', category: '', brand: '', quantity: 5, unit: 'kg', remarks: '' },
  ]);
  let formError = $state('');
  let formSuccess = $state('');
  let formLoading = $state(false);

  // Modals State
  let selectedRequest = $state(null);
  let requestBids = $state([]);
  let showDetailModal = $state(false);
  let bidsLoading = $state(false);

  // Feature Modal States
  let trackingOrderId = $state(null);
  let scorecardWholesalerId = $state(null);
  let priceHistoryProduct = $state(null);
  let priceHistoryReqId = $state(null);
  let showOptimizerModal = $state(false);
  let optimizerRequest = $state(null);

  // Confirmation Modal State
  let showConfirmModal = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state(null);

  // Sidebar badge counts (derived from live data)
  let sidebarBadges = $derived({
    lowStock: lowStockInventory.length,
    pendingBids: requests.filter(r => r.status === 'responded' || (r.status === 'pending' && r.responsesCount > 0)).length,
    activeOrders: orders.filter(o => ['shipped', 'out_for_delivery', 'processing', 'packed'].includes(o.status)).length,
  });

  // Derived KPI Calculations from real database models
  let quotesAwaitingReviewCount = $derived(
    requests.filter(r => r.status === 'responded' || (r.status === 'pending' && r.responsesCount > 0)).length
  );

  let ordersInTransitCount = $derived(
    orders.filter(o => ['shipped', 'out_for_delivery', 'processing', 'packed'].includes(o.status)).length
  );

  let monthlyProcurementSpend = $derived(
    (() => {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      return orders
        .filter(o => {
          const d = new Date(o.createdAt);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear && o.status !== 'cancelled';
        })
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    })()
  );

  // Low stock products warning
  let lowStockProducts = $derived(
    products.filter(p => p.stockQuantity !== undefined && p.stockQuantity <= 10)
  );

  let optimizableRequests = $derived(
    requests.filter(r => r.status === 'responded' || r.responsesCount > 0)
  );

  function triggerConfirm(message, callback) {
    confirmMessage = message;
    confirmCallback = () => {
      callback();
      showConfirmModal = false;
    };
    showConfirmModal = true;
  }

  function addMultiItemRow() {
    multiItems = [
      ...multiItems,
      { productName: '', category: '', brand: '', quantity: 10, unit: 'kg', remarks: '' }
    ];
  }

  function removeMultiItemRow(index) {
    if (multiItems.length <= 1) return;
    multiItems = multiItems.filter((_, i) => i !== index);
  }

  // Prepopulate form for Quick Reorder
  function quickReorder(item) {
    isMultiProduct = false;
    reqProductName = item.productName || '';
    reqCategoryName = item.category || 'Pantry Staples';
    reqBrand = item.brand || '';
    reqQuantity = item.quantity || item.recommendedReorderQuantity || 1;
    reqUnit = item.unit || 'kg';
    reqUrgency = item.urgency || 'medium';

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    reqDeliveryDate = targetDate.toISOString().split('T')[0];

    activeTab = 'requests';
    toasts.info(`Procurement form pre-filled for "${reqProductName}".`);
  }

  // Load Main Requests
  async function loadDashboardData(quiet = false) {
    if (!auth.token) return;
    if (!quiet) dashboardLoading = true;
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 8,
        search: searchQuery,
        category: categoryFilter,
        status: statusFilter,
        urgency: urgencyFilter,
        sort: sortQuery
      });
      const data = await api.get(`/requests?${params.toString()}`);
      requests = data.requests || [];
      totalPages = data.pages || 1;
      totalRequestsCount = data.total || 0;
    } catch (err) {
      console.error('Failed to load dashboard requests:', err);
      toasts.error('Error loading requests');
    } finally {
      dashboardLoading = false;
    }
  }

  // Load Orders
  async function loadOrders() {
    ordersLoading = true;
    try {
      const res = await api.get('/orders');
      orders = res.orders || [];
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      ordersLoading = false;
    }
  }

  // Load Catalogs
  async function loadCatalogs() {
    try {
      const catRes = await api.get('/common/categories');
      categories = Array.isArray(catRes) ? catRes : (catRes?.categories || []);
      const prodRes = await api.get('/common/products');
      products = Array.isArray(prodRes) ? prodRes : (prodRes?.products || []);
    } catch (err) {
      console.error('Failed to load catalogs:', err);
    }
  }

  // FEATURE 1: Load Stockout Predictions
  async function loadStockoutPredictions() {
    stockoutLoading = true;
    try {
      const res = await api.get('/analytics/stockout-predictions');
      stockoutPredictions = res.predictions || [];
    } catch (err) {
      console.error('Failed to load stockout predictions:', err);
    } finally {
      stockoutLoading = false;
    }
  }

  // Load Reorder Recommendations
  async function loadRecommendations() {
    recommendationsLoading = true;
    try {
      const res = await api.get('/inventory/retailer-recommendations');
      retailerRecommendations = res.recommendations || [];
    } catch (err) {
      console.error('Failed to load reorder recommendations:', err);
    } finally {
      recommendationsLoading = false;
    }
  }

  // Load Retailer Profitability (P&L)
  async function loadProfitability() {
    profitabilityLoading = true;
    try {
      const res = await api.get('/analytics/retailer-profitability');
      if (res && res.metrics) {
        profitabilityData = {
          ...res,
          totalProcurementSpend: res.metrics.totalProcurementSpend ?? 0,
          totalOrders: res.metrics.totalOrdersCount ?? res.metrics.deliveredOrdersCount ?? 0,
          totalSalesRevenue: res.metrics.salesRevenue ?? 0,
          grossProfit: res.metrics.grossProfit ?? 0,
          grossMarginPercent: res.metrics.grossProfitMargin ?? 0,
          spendByCategory: res.categoryBreakdown?.map(c => ({ category: c.category, spend: c.cost })) || []
        };
      } else {
        profitabilityData = res;
      }
    } catch (err) {
      console.error('Failed to load profitability data:', err);
    } finally {
      profitabilityLoading = false;
    }
  }

  // Tab change handler — lazily loads data for that tab
  function handleTabChange(tab) {
    activeTab = tab;
    if (tab === 'orders') loadOrders();
    if (tab === 'stockout') { loadStockoutPredictions(); loadRecommendations(); }
    if (tab === 'profitability') loadProfitability();
    if (tab === 'requests' || tab === 'quotations') loadDashboardData(true);
  }

  function handleProductSelect(e) {
    const pId = e.target.value;
    selectedProductId = pId;
    if (!pId) return;
    const p = products.find(prod => prod._id === pId);
    if (p) {
      reqProductName = p.name;
      reqBrand = p.brand || '';
      reqUnit = p.defaultUnit || 'kg';
      if (p.category && p.category.name) {
        reqCategoryName = p.category.name;
      }
    }
  }

  async function handleCreateRequest(e) {
    e.preventDefault();
    formError = '';
    formSuccess = '';
    formLoading = true;

    try {
      if (isMultiProduct) {
        const validItems = multiItems.filter(it => it.productName.trim() && it.quantity > 0);
        if (validItems.length === 0) {
          throw new Error('Please add at least one item with a valid product name and quantity.');
        }

        await api.post('/requests', {
          items: validItems,
          urgency: reqUrgency,
          preferredDeliveryDate: reqDeliveryDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          remarks: reqRemarks,
        });

        toasts.success(`Multi-product procurement request published (${validItems.length} items)!`);
      } else {
        if (!reqProductName || !reqCategoryName || !reqDeliveryDate || reqQuantity <= 0) {
          throw new Error('Please fill in all mandatory fields with valid values.');
        }

        await api.post('/requests', {
          productName: reqProductName,
          category: reqCategoryName,
          brand: reqBrand,
          quantity: Number(reqQuantity),
          unit: reqUnit,
          urgency: reqUrgency,
          preferredDeliveryDate: reqDeliveryDate,
          remarks: reqRemarks,
        });

        toasts.success('Stock request published successfully!');
      }

      formSuccess = 'Procurement request broadcasted to wholesalers!';
      selectedProductId = '';
      reqProductName = '';
      reqCategoryName = '';
      reqBrand = '';
      reqQuantity = 1;
      reqUnit = 'kg';
      reqUrgency = 'medium';
      reqDeliveryDate = '';
      reqRemarks = '';

      loadDashboardData(true);
    } catch (err) {
      formError = err.message || 'Failed to submit stock request';
      toasts.error(formError);
    } finally {
      formLoading = false;
    }
  }

  async function openBidsModal(reqItem) {
    selectedRequest = reqItem;
    showDetailModal = true;
    bidsLoading = true;
    requestBids = [];
    try {
      const res = await api.get(`/responses/request/${reqItem._id}`);
      requestBids = res.responses || [];
    } catch (err) {
      toasts.error('Failed to load wholesaler bids');
    } finally {
      bidsLoading = false;
    }
  }

  async function handleAcceptBid(responseId, isPartial = false, offeredQty = 0) {
    const promptMsg = isPartial 
      ? `Accept partial supply of ${offeredQty} ${selectedRequest?.unit}? The remaining quantity will remain open for other wholesalers.`
      : 'Are you sure you want to accept this quotation? This will create an official order.';

    triggerConfirm(promptMsg, async () => {
      try {
        const res = await api.post(`/responses/${responseId}/accept`);
        toasts.success(res.message || 'Quotation accepted!');
        showDetailModal = false;
        loadDashboardData(true);
        loadOrders();
      } catch (err) {
        toasts.error(err.message || 'Failed to accept quotation');
      }
    });
  }

  async function handleCancelRequest(requestId) {
    triggerConfirm('Are you sure you want to cancel this stock request?', async () => {
      try {
        await api.delete(`/requests/${requestId}`);
        toasts.success('Stock request cancelled');
        loadDashboardData(true);
      } catch (err) {
        toasts.error(err.message || 'Failed to cancel request');
      }
    });
  }

  onMount(() => {
    if (!auth.token) {
      goto('/auth');
      return;
    }
    if (auth.user && auth.user.role !== 'retailer') {
      if (auth.user.role === 'wholesaler') {
        toasts.warning('Wholesaler accounts cannot access Retailer operations. Redirecting to your dashboard.');
        goto('/wholesaler');
      } else {
        goto('/unauthorized');
      }
      return;
    }

    loadDashboardData();
    loadOrders();
    loadCatalogs();
    loadRecommendations();

    api.get('/auth/me').then((res) => {
      if (res && res.profile) {
        retailerProfile = res.profile;
      }
    }).catch((err) => {
      console.warn('Could not load profile location:', err);
    });

    // Load low stock count for sidebar badge
    api.get('/retailer-inventory').then(res => {
      const items = res.inventory || [];
      lowStockInventory = items.filter(i => i.quantity <= (i.minStockThreshold || 10));
    }).catch(() => {});
  });
</script>

<!-- Dashboard Layout: Sidebar + Main Scrollable Content -->
<div class="flex h-screen bg-[#F7F5EF] dark:bg-[#1a1a1d] overflow-hidden">
  <!-- LEFT SIDEBAR -->
  <Sidebar
    role="retailer"
    activeTab={activeTab}
    onSelectTab={handleTabChange}
    badges={sidebarBadges}
  />

  <!-- MAIN SCROLLABLE AREA -->
  <div class="flex-1 overflow-y-auto min-w-0 transition-colors duration-200">
    <div class="p-5 lg:p-7 space-y-6 max-w-7xl">

      <!-- Retailer Top Bar / Theme Toggle Header -->
      <div class="flex items-center justify-between pb-4 border-b border-app-border">
        <div class="flex items-center space-x-2 text-xs text-app-textMuted">
          <span class="inline-block w-2 h-2 rounded-full bg-[#D4A72C]"></span>
          <span class="font-bold text-app-text font-heading">Retailer Hub</span>
          <span class="opacity-40">/</span>
          <span class="capitalize font-medium">{activeTab.replace(/_/g, ' ')}</span>
        </div>

        <button
          onclick={() => theme.toggle()}
          type="button"
          class="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border border-app-border bg-app-card hover:bg-app-cardSubtle text-app-text text-xs font-bold transition shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/50"
          title={theme.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {#if theme.isDark}
            <Sun class="w-4 h-4 text-[#D4A72C]" />
            <span>Light Mode</span>
          {:else}
            <Moon class="w-4 h-4 text-[#202124]" />
            <span>Dark Mode</span>
          {/if}
        </button>
      </div>

      <!-- ===== OVERVIEW ===== -->
      {#if activeTab === 'overview'}
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Retailer Dashboard</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Welcome back, {auth.user?.email?.split('@')[0] || 'Retailer'}! 👋</h1>
            <p class="text-xs text-app-textMuted mt-1">Manage your grocery procurement, inventory, and profitability from one place.</p>
          </div>
          <button
            onclick={() => { loadDashboardData(true); loadOrders(); }}
            class="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-app-border hover:bg-app-cardSubtle text-app-textMuted transition"
          >
            <RefreshCw class="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button onclick={() => handleTabChange('quotations')} class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift text-left transition-all group">
            <span class="text-xs font-bold text-amber-500 uppercase tracking-wider">Quotes to Review</span>
            <div class="text-3xl font-extrabold font-heading text-amber-500 mt-2">{quotesAwaitingReviewCount}</div>
            <span class="text-[10px] text-app-textMuted mt-1 block group-hover:text-[#D4A72C] transition">Active supplier quotations →</span>
          </button>

          <button onclick={() => handleTabChange('orders')} class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift text-left transition-all group">
            <span class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Orders in Transit</span>
            <div class="text-3xl font-extrabold font-heading text-[#D4A72C] mt-2">{ordersInTransitCount}</div>
            <span class="text-[10px] text-app-textMuted mt-1 block group-hover:text-[#D4A72C] transition">Packed, shipped, or en route →</span>
          </button>

          <button onclick={() => handleTabChange('inventory')} class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift text-left transition-all group">
            <span class="text-xs font-bold text-rose-500 uppercase tracking-wider">Low Stock Items</span>
            <div class="text-3xl font-extrabold font-heading text-rose-500 mt-2">{sidebarBadges.lowStock}</div>
            <span class="text-[10px] text-app-textMuted mt-1 block group-hover:text-rose-500 transition">Need restocking →</span>
          </button>

          <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
            <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider">Monthly Spend</span>
            <div class="text-2xl font-extrabold font-heading text-app-text mt-2">₹{monthlyProcurementSpend.toLocaleString('en-IN')}</div>
            <span class="text-[10px] text-app-textMuted mt-1 block">Completed & active orders</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onclick={() => handleTabChange('stockout')} class="bg-gradient-to-br from-amber-500/10 to-[#D4A72C]/5 border border-amber-500/20 p-5 rounded-2xl hover-lift text-left group transition-all">
            <div class="flex items-center space-x-3 mb-3">
              <div class="p-2 rounded-xl bg-amber-500/15 text-amber-600"><Calendar class="w-5 h-5" /></div>
              <span class="font-bold text-app-text text-sm">Stockout Predictions</span>
            </div>
            <p class="text-xs text-app-textMuted">AI-powered reorder alerts from real purchase history.</p>
            <span class="text-xs text-amber-600 font-bold mt-2 block group-hover:underline">View predictions →</span>
          </button>

          <button onclick={() => handleTabChange('optimizer')} class="bg-gradient-to-br from-[#D4A72C]/10 to-amber-500/5 border border-[#D4A72C]/20 p-5 rounded-2xl hover-lift text-left group transition-all">
            <div class="flex items-center space-x-3 mb-3">
              <div class="p-2 rounded-xl bg-[#D4A72C]/15 text-[#D4A72C]"><Sparkles class="w-5 h-5" /></div>
              <span class="font-bold text-app-text text-sm">Procurement Optimizer</span>
            </div>
            <p class="text-xs text-app-textMuted">Smart supplier combinations that minimize cost & delivery time.</p>
            <span class="text-xs text-[#D4A72C] font-bold mt-2 block group-hover:underline">Optimize now →</span>
          </button>

          <button onclick={() => handleTabChange('profitability')} class="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 p-5 rounded-2xl hover-lift text-left group transition-all">
            <div class="flex items-center space-x-3 mb-3">
              <div class="p-2 rounded-xl bg-emerald-500/15 text-emerald-600"><BarChart3 class="w-5 h-5" /></div>
              <span class="font-bold text-app-text text-sm">Store Profitability</span>
            </div>
            <p class="text-xs text-app-textMuted">Procurement costs, inventory valuation, and margin analytics.</p>
            <span class="text-xs text-emerald-600 font-bold mt-2 block group-hover:underline">View analytics →</span>
          </button>
        </div>

        <!-- Recent Requests Preview -->
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
          <div class="flex items-center justify-between border-b border-app-border pb-3">
            <h2 class="text-base font-bold font-heading text-app-text">Recent Stock Requests</h2>
            <button onclick={() => handleTabChange('requests')} class="text-xs font-bold text-[#D4A72C] hover:underline">View all →</button>
          </div>
          {#if dashboardLoading}
            <div class="space-y-2">{#each [1,2,3] as _}<div class="h-12 bg-app-cardSubtle rounded-xl animate-shimmer"></div>{/each}</div>
          {:else if requests.length === 0}
            <div class="text-center py-8 text-app-textMuted">
              <Package class="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p class="text-xs">No requests yet. Use "Stock Requests" to get started.</p>
            </div>
          {:else}
            <div class="space-y-2">
              {#each requests.slice(0, 4) as reqItem (reqItem._id)}
                <div class="flex items-center justify-between p-3 rounded-xl bg-app-cardSubtle hover:bg-app-border/20 transition">
                  <div>
                    <span class="text-xs font-bold text-app-text">{reqItem.productName}</span>
                    <span class="ml-2 text-[10px] text-app-textMuted">{reqItem.quantity} {reqItem.unit}</span>
                  </div>
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase {reqItem.status === 'responded' ? 'bg-[#D4A72C]/10 text-[#D4A72C]' : reqItem.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-500'}">
                    {reqItem.status.replace(/_/g, ' ')}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ===== MY STORE INVENTORY ===== -->
      {:else if activeTab === 'inventory'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Store Management</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">My Store Inventory</h1>
            <p class="text-xs text-app-textMuted mt-1">Track actual stock levels, record adjustments, and log retail sales for profitability.</p>
          </div>
          <RetailerInventorySection onQuickReorder={quickReorder} />
        </div>

      <!-- ===== STOCK REQUESTS ===== -->
      {:else if activeTab === 'requests'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Procurement</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Stock Requests</h1>
            <p class="text-xs text-app-textMuted mt-1">Create single or multi-item requests broadcast to nearby verified wholesalers.</p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Creation Form -->
            <div class="lg:col-span-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm h-fit space-y-4">
              <div class="flex items-center justify-between border-b border-app-border pb-3">
                <div>
                  <h2 class="text-base font-bold font-heading text-app-text">{isMultiProduct ? 'Multi-Product Procurement' : 'Create Stock Request'}</h2>
                  <p class="text-[11px] text-app-textMuted">Broadcast directly to local wholesalers</p>
                </div>
                <button
                  type="button"
                  onclick={() => isMultiProduct = !isMultiProduct}
                  class="px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors flex items-center gap-1 {isMultiProduct ? 'bg-[#D4A72C] text-[#202124] border-[#D4A72C]' : 'bg-app-cardSubtle border-app-border text-app-text hover:border-[#D4A72C]'}"
                >
                  <Layers class="h-3 w-3" />
                  <span>{isMultiProduct ? 'Multi' : 'Single'}</span>
                </button>
              </div>

              <form onsubmit={handleCreateRequest} class="space-y-4">
                {#if formError}
                  <div class="p-3 text-xs bg-rose-500/10 text-rose-600 rounded-xl font-semibold border border-rose-500/20">{formError}</div>
                {/if}
                {#if formSuccess}
                  <div class="p-3 text-xs bg-emerald-500/10 text-emerald-600 rounded-xl font-semibold border border-emerald-500/20">{formSuccess}</div>
                {/if}

                {#if !isMultiProduct}
                  <div>
                    <label for="prod-select" class="block text-xs font-bold text-app-textMuted uppercase tracking-wider mb-1">Pick From Catalog (Optional)</label>
                    <select id="prod-select" value={selectedProductId} onchange={handleProductSelect} class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none">
                      <option value="">-- Choose from standard catalog --</option>
                      {#each products as p}<option value={p._id}>{p.name} ({p.brand})</option>{/each}
                    </select>
                  </div>

                  <div>
                    <label for="req-name" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Product Name *</label>
                    <input id="req-name" type="text" bind:value={reqProductName} placeholder="e.g. Sona Masoori Raw Rice" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none" required />
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="req-cat" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Category *</label>
                      <input id="req-cat" type="text" bind:value={reqCategoryName} placeholder="e.g. Pantry Staples" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none" required />
                    </div>
                    <div>
                      <label for="req-brand" class="block text-xs font-bold text-app-textMuted uppercase tracking-wider mb-1">Brand</label>
                      <input id="req-brand" type="text" bind:value={reqBrand} placeholder="Brand (optional)" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none" />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="req-qty" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Quantity *</label>
                      <input id="req-qty" type="number" min="1" bind:value={reqQuantity} placeholder="Required qty" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none" required />
                    </div>
                    <div>
                      <label for="req-unit" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Unit *</label>
                      <input id="req-unit" type="text" bind:value={reqUnit} placeholder="kg, litre, box" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none" required />
                    </div>
                  </div>
                {:else}
                  <!-- Multi-Product Items Builder -->
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-app-text uppercase tracking-wider">Items ({multiItems.length})</span>
                      <button type="button" onclick={addMultiItemRow} class="text-xs font-bold text-[#D4A72C] hover:underline flex items-center gap-1">
                        <Plus class="h-3.5 w-3.5" /><span>Add Item</span>
                      </button>
                    </div>
                    <div class="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                      {#each multiItems as item, idx}
                        <div class="p-3 bg-app-cardSubtle border border-app-border rounded-xl space-y-2">
                          <div class="flex items-center justify-between">
                            <span class="text-[11px] font-bold text-[#D4A72C]">Item #{idx + 1}</span>
                            {#if multiItems.length > 1}
                              <button type="button" onclick={() => removeMultiItemRow(idx)} class="text-rose-500 hover:text-rose-600 p-0.5" title="Remove">
                                <Trash2 class="h-3.5 w-3.5" />
                              </button>
                            {/if}
                          </div>
                          <input type="text" bind:value={item.productName} placeholder="Product name" class="w-full px-2.5 py-1.5 text-xs bg-app-card border border-app-border rounded-lg text-app-text focus:outline-none focus:border-[#D4A72C]" required />
                          <div class="grid grid-cols-3 gap-2">
                            <input type="text" bind:value={item.category} placeholder="Category" class="px-2 py-1 text-xs bg-app-card border border-app-border rounded-lg text-app-text focus:outline-none" required />
                            <input type="number" min="1" bind:value={item.quantity} placeholder="Qty" class="px-2 py-1 text-xs bg-app-card border border-app-border rounded-lg text-app-text focus:outline-none" required />
                            <input type="text" bind:value={item.unit} placeholder="Unit" class="px-2 py-1 text-xs bg-app-card border border-app-border rounded-lg text-app-text focus:outline-none" required />
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="req-urgency" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Urgency</label>
                    <select id="req-urgency" bind:value={reqUrgency} class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High Urgency</option>
                    </select>
                  </div>
                  <div>
                    <label for="req-date" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Needed By *</label>
                    <input id="req-date" type="date" bind:value={reqDeliveryDate} class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none" required />
                  </div>
                </div>

                <div>
                  <label for="req-remarks" class="block text-xs font-bold text-app-textMuted uppercase tracking-wider mb-1">Delivery Notes</label>
                  <textarea id="req-remarks" bind:value={reqRemarks} rows="2" placeholder="e.g. Prefer morning delivery to store back entrance..." class="w-full px-3.5 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none"></textarea>
                </div>

                <button type="submit" disabled={formLoading} id="submit-stock-request" class="w-full py-3 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl transition-all shadow-md hover-lift flex justify-center items-center disabled:opacity-60">
                  {formLoading ? 'Publishing Request...' : 'Publish Procurement Request'}
                </button>
              </form>
            </div>

            <!-- Requests Feed -->
            <div class="lg:col-span-8 space-y-4">
              <div class="bg-app-card p-4 rounded-2xl border border-app-border shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div class="relative flex-1 min-w-[200px]">
                  <input type="text" bind:value={searchQuery} oninput={() => loadDashboardData()} placeholder="Search requests by product name..." class="w-full pl-9 pr-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none" />
                  <span class="absolute left-3 top-2.5 text-app-textMuted text-xs">🔍</span>
                </div>
                <div class="flex items-center space-x-2">
                  <select bind:value={statusFilter} onchange={() => loadDashboardData()} class="px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none" aria-label="Filter by status">
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="responded">Responded</option>
                    <option value="partially_fulfilled">Partially Fulfilled</option>
                    <option value="accepted">Accepted</option>
                  </select>
                  <select bind:value={urgencyFilter} onchange={() => loadDashboardData()} class="px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none" aria-label="Filter by urgency">
                    <option value="">All Urgencies</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {#if dashboardLoading}
                <div class="space-y-3">{#each [1, 2, 3] as _}<div class="h-28 bg-app-card rounded-2xl border border-app-border animate-shimmer"></div>{/each}</div>
              {:else if requests.length === 0}
                <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-3">
                  <div class="text-4xl">🛒</div>
                  <h3 class="text-base font-bold text-app-text">No Stock Requests Found</h3>
                  <p class="text-xs text-app-textMuted max-w-sm mx-auto">Use the procurement form on the left to create a new stock request.</p>
                </div>
              {:else}
                <div class="space-y-3">
                  {#each requests as reqItem (reqItem._id)}
                    <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
                      <div class="space-y-1.5 flex-1">
                        <div class="flex items-center space-x-2 flex-wrap gap-1">
                          <span class="text-base font-bold text-app-text">{reqItem.productName}</span>
                          {#if reqItem.brand}<span class="text-[10px] px-2 py-0.5 rounded-md bg-app-cardSubtle text-app-textMuted font-bold">{reqItem.brand}</span>{/if}
                          <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase {reqItem.status === 'partially_fulfilled' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' : reqItem.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' : reqItem.status === 'responded' ? 'bg-[#D4A72C]/10 text-[#D4A72C]' : 'bg-amber-500/10 text-amber-500'}">
                            {reqItem.status.replace(/_/g, ' ')}
                          </span>
                          {#if reqItem.items && reqItem.items.length > 1}
                            <span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 font-bold">{reqItem.items.length} Products</span>
                          {/if}
                        </div>
                        <div class="text-xs text-app-textMuted flex flex-wrap items-center gap-3">
                          <span>Category: <strong>{reqItem.category}</strong></span>
                          <span>Quantity: <strong class="text-[#D4A72C]">{reqItem.quantity} {reqItem.unit}</strong></span>
                          <span>Needed: <strong>{new Date(reqItem.preferredDeliveryDate).toLocaleDateString()}</strong></span>
                        </div>
                        {#if reqItem.status === 'partially_fulfilled' || (reqItem.fulfilledQuantity && reqItem.fulfilledQuantity > 0)}
                          <div class="pt-1.5 space-y-1">
                            <div class="flex items-center justify-between text-[11px]">
                              <span class="text-blue-600 font-semibold">Fulfilled: {reqItem.fulfilledQuantity} / {reqItem.requestedQuantity || reqItem.quantity} {reqItem.unit}</span>
                              <span class="text-app-textMuted font-semibold">Remaining: {reqItem.remainingQuantity || 0} {reqItem.unit}</span>
                            </div>
                            <div class="w-full bg-app-border/40 h-2 rounded-full overflow-hidden">
                              <div class="bg-blue-500 h-full rounded-full transition-all duration-300" style="width: {Math.min(100, Math.round(((reqItem.fulfilledQuantity || 0) / (reqItem.requestedQuantity || reqItem.quantity || 1)) * 100))}%"></div>
                            </div>
                          </div>
                        {/if}
                      </div>

                      <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
                        <button onclick={() => openBidsModal(reqItem)} class="px-3.5 py-1.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs transition">
                          Compare Quotations
                        </button>
                        {#if reqItem.status === 'responded' || reqItem.responsesCount > 0}
                          <button onclick={() => { showOptimizerModal = true; optimizerRequest = reqItem; }} class="px-3 py-1.5 text-xs font-bold bg-app-cardSubtle hover:bg-app-border/40 text-app-text rounded-xl border border-app-border transition flex items-center gap-1" title="Procurement Optimizer">
                            <Sparkles class="h-3.5 w-3.5 text-[#D4A72C]" />
                            Optimize
                          </button>
                        {/if}
                        <button onclick={() => quickReorder(reqItem)} class="px-3 py-1.5 text-xs font-bold bg-app-cardSubtle hover:bg-app-border/40 text-app-text rounded-xl border border-app-border transition" title="Duplicate & Reorder">⚡ Reorder</button>
                        {#if reqItem.status === 'pending'}
                          <button onclick={() => handleCancelRequest(reqItem._id)} class="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition" title="Cancel Request"><Trash2 class="h-4 w-4" /></button>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>

                {#if totalPages > 1}
                  <div class="flex justify-between items-center bg-app-card p-4 rounded-2xl border border-app-border text-xs font-semibold">
                    <button onclick={() => { currentPage = Math.max(1, currentPage - 1); loadDashboardData(); }} disabled={currentPage === 1} class="px-3 py-1.5 rounded-lg border border-app-border hover:bg-app-cardSubtle disabled:opacity-40">← Previous</button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button onclick={() => { currentPage = Math.min(totalPages, currentPage + 1); loadDashboardData(); }} disabled={currentPage === totalPages} class="px-3 py-1.5 rounded-lg border border-app-border hover:bg-app-cardSubtle disabled:opacity-40">Next →</button>
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        </div>

      <!-- ===== QUOTATIONS ===== -->
      {:else if activeTab === 'quotations'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Supplier Bids</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Quotations & Bids</h1>
            <p class="text-xs text-app-textMuted mt-1">Review and accept bids from wholesalers on your stock requests.</p>
          </div>
          <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
            {#if dashboardLoading}
              <div class="space-y-3">{#each [1,2,3] as _}<div class="h-20 bg-app-cardSubtle rounded-xl animate-shimmer"></div>{/each}</div>
            {:else}
              {@const respondedRequests = requests.filter(r => r.status === 'responded' || r.responsesCount > 0)}
              {#if respondedRequests.length === 0}
                <div class="text-center py-12 text-app-textMuted">
                  <div class="text-4xl mb-2">📋</div>
                  <h3 class="text-sm font-bold text-app-text">No pending quotations</h3>
                  <p class="text-xs mt-1">When wholesalers respond to your requests, their bids appear here.</p>
                </div>
              {:else}
                <div class="space-y-3">
                  {#each respondedRequests as reqItem (reqItem._id)}
                    <div class="p-5 rounded-2xl border border-[#D4A72C]/30 bg-[#D4A72C]/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover-lift transition-all">
                      <div>
                        <div class="flex items-center space-x-2">
                          <span class="text-sm font-bold text-app-text">{reqItem.productName}</span>
                          <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#D4A72C]/15 text-[#D4A72C] font-bold uppercase">{reqItem.responsesCount || 0} bid(s)</span>
                        </div>
                        <p class="text-xs text-app-textMuted mt-0.5">{reqItem.quantity} {reqItem.unit} • Needed by {new Date(reqItem.preferredDeliveryDate).toLocaleDateString()}</p>
                      </div>
                      <div class="flex items-center gap-2">
                        <button onclick={() => { showOptimizerModal = true; optimizerRequest = reqItem; }} class="px-3 py-1.5 text-xs font-bold bg-app-card border border-app-border hover:border-[#D4A72C] text-app-text rounded-xl transition flex items-center gap-1">
                          <Sparkles class="h-3.5 w-3.5 text-[#D4A72C]" /> Optimize
                        </button>
                        <button onclick={() => openBidsModal(reqItem)} class="px-4 py-1.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-sm transition">Compare & Accept →</button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            {/if}
          </div>
        </div>

      <!-- ===== PROCUREMENT OPTIMIZER ===== -->
      {:else if activeTab === 'optimizer'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Decision Support</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Procurement Optimizer</h1>
            <p class="text-xs text-app-textMuted mt-1">Select a request with active bids to get optimal supplier combination recommendations.</p>
          </div>
          <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
            {#if optimizableRequests.length === 0}
              <div class="text-center py-12 text-app-textMuted">
                <Sparkles class="w-10 h-10 mx-auto mb-3 opacity-40" />
                <h3 class="text-sm font-bold text-app-text">No requests available to optimize</h3>
                <p class="text-xs mt-1 max-w-sm mx-auto">Create a stock request and wait for wholesalers to respond before running the optimizer.</p>
              </div>
            {:else}
              <div class="space-y-3">
                {#each optimizableRequests as reqItem (reqItem._id)}
                  <div class="p-5 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 class="font-bold text-app-text">{reqItem.productName}</h3>
                      <p class="text-xs text-app-textMuted">{reqItem.quantity} {reqItem.unit} • {reqItem.responsesCount || 0} quotations received</p>
                    </div>
                    <button onclick={() => { showOptimizerModal = true; optimizerRequest = reqItem; }} class="px-5 py-2 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-sm transition flex items-center gap-2">
                      <Sparkles class="w-4 h-4" /> Run Optimizer
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

      <!-- ===== GROUP BUYING ===== -->
      {:else if activeTab === 'groupbuy'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Collective Procurement</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Hyperlocal Group Buying</h1>
            <p class="text-xs text-app-textMuted mt-1">Join or create bulk purchase pools with neighboring retailers to unlock quantity discounts.</p>
          </div>
          <GroupBuyingSection role="retailer" />
        </div>

      <!-- ===== ORDERS & TRACKING ===== -->
      {:else if activeTab === 'orders'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Order Management</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Orders & Tracking</h1>
            <p class="text-xs text-app-textMuted mt-1">Track fulfillment milestones from warehouse to delivery.</p>
          </div>
          <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
            <div class="flex items-center justify-between border-b border-app-border pb-3">
              <h2 class="text-base font-bold font-heading text-app-text">Active Orders ({orders.length})</h2>
              <button onclick={loadOrders} class="px-3 py-1.5 text-xs font-bold rounded-lg border border-app-border hover:bg-app-cardSubtle flex items-center gap-1.5">
                <RefreshCw class="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {#if ordersLoading}
              <div class="space-y-4">{#each [1, 2, 3] as _}<div class="h-24 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>{/each}</div>
            {:else if orders.length === 0}
              <div class="text-center py-12 text-app-textMuted space-y-2">
                <div class="text-4xl">📦</div>
                <h3 class="text-sm font-bold text-app-text">No Orders Placed Yet</h3>
                <p class="text-xs max-w-sm mx-auto">When you accept a quotation, your order appears here with live tracking.</p>
              </div>
            {:else}
              <div class="space-y-3">
                {#each orders as ord (ord._id)}
                  <div class="p-5 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="space-y-1.5">
                      <div class="flex items-center space-x-3">
                        <span class="text-xs font-mono font-bold text-app-textMuted">#{ord._id.slice(-6)}</span>
                        <span class="text-base font-bold text-app-text">{ord.productName}</span>
                        <span class="text-xs font-bold text-[#D4A72C]">₹{ord.totalAmount?.toLocaleString('en-IN')}</span>
                      </div>
                      <div class="text-xs text-app-textMuted space-x-4">
                        <span>Qty: <strong>{ord.quantity} {ord.unit}</strong> (@ ₹{ord.unitPrice}/{ord.unit})</span>
                        <span>From: <strong>{ord.wholesalerProfile?.companyName || 'Wholesaler'}</strong></span>
                      </div>
                      <div class="text-[11px] text-app-textMuted">Placed: {new Date(ord.createdAt).toLocaleDateString()}</div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider {ord.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30' : ord.status === 'shipped' || ord.status === 'out_for_delivery' ? 'bg-[#D4A72C]/20 text-[#D4A72C] border border-[#D4A72C]/30' : ord.status === 'packed' || ord.status === 'processing' ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30' : 'bg-amber-500/20 text-amber-600 border border-amber-500/30'}">
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                      <button onclick={() => trackingOrderId = ord._id} class="px-3 py-1.5 text-xs font-bold bg-app-card border border-app-border hover:border-[#D4A72C] text-app-text rounded-xl transition flex items-center gap-1.5">
                        <Truck class="h-3.5 w-3.5 text-[#D4A72C]" /><span>Track</span>
                      </button>
                      <button onclick={() => quickReorder(ord)} class="px-3 py-1.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs transition">Reorder</button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

      <!-- ===== SUPPLIER MAP ===== -->
      {:else if activeTab === 'map'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Hyperlocal Discovery</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Supplier Map</h1>
            <p class="text-xs text-app-textMuted mt-1">Find verified wholesalers near your store location.</p>
          </div>
          <SupplierMap
            userLocation={retailerProfile}
            {categories}
            onSelectSupplier={(w) => {
              reqRemarks = `Preferred Supplier: ${w.companyName}`;
              activeTab = 'requests';
              toasts.info(`Supplier "${w.companyName}" targeted for request.`);
            }}
          />
        </div>

      <!-- ===== PRICE INTELLIGENCE ===== -->
      {:else if activeTab === 'priceintelligence'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Market Analytics</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Price Intelligence</h1>
            <p class="text-xs text-app-textMuted mt-1">Historical agreed prices, volatility analysis, and anomaly detection per product.</p>
          </div>
          <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
            {#if requests.length === 0}
              <div class="text-center py-12 text-app-textMuted">
                <TrendingUp class="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p class="text-xs">No active requests found. Create a stock request first.</p>
              </div>
            {:else}
              <p class="text-sm text-app-textMuted">Select a product to view its price history, trend, and anomaly flags:</p>
              <div class="space-y-2">
                {#each requests as reqItem (reqItem._id)}
                  <div class="flex items-center justify-between p-4 rounded-xl border border-app-border bg-app-cardSubtle hover:bg-app-border/20 transition">
                    <div>
                      <span class="font-bold text-app-text text-sm">{reqItem.productName}</span>
                      <span class="text-xs text-app-textMuted ml-2">{reqItem.category}</span>
                    </div>
                    <button onclick={() => { priceHistoryProduct = reqItem.productName; priceHistoryReqId = reqItem._id; }} class="px-3 py-1.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl transition flex items-center gap-1.5">
                      <TrendingUp class="w-3.5 h-3.5" /> View Price History
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

      <!-- ===== STOCKOUT PREDICTIONS ===== -->
      {:else if activeTab === 'stockout'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Intelligent Replenishment</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Stockout Predictions</h1>
            <p class="text-xs text-app-textMuted mt-1">Lead-time-aware alerts based on real purchase history. No fabricated data.</p>
          </div>

          <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
            <div class="flex items-center justify-between border-b border-app-border pb-3">
              <div class="flex items-center space-x-3">
                <div class="p-2.5 rounded-xl bg-[#D4A72C]/10 text-[#D4A72C]"><Sparkles class="h-5 w-5" /></div>
                <div>
                  <h2 class="text-base font-bold font-heading text-app-text">Smart Reorder Recommendations</h2>
                  <p class="text-xs text-app-textMuted">Calculated from real purchase order intervals</p>
                </div>
              </div>
              <button onclick={() => { loadStockoutPredictions(); loadRecommendations(); }} class="px-3 py-1.5 text-xs font-bold rounded-lg border border-app-border hover:bg-app-cardSubtle flex items-center gap-1.5">
                <RefreshCw class="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {#if stockoutLoading || recommendationsLoading}
              <div class="space-y-4">{#each [1, 2] as _}<div class="h-28 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>{/each}</div>
            {:else if stockoutPredictions.length === 0 && retailerRecommendations.length === 0}
              <div class="text-center py-12 text-app-textMuted space-y-2">
                <Sparkles class="h-8 w-8 text-[#D4A72C] mx-auto opacity-50 mb-2" />
                <h3 class="text-sm font-bold text-app-text">Insufficient purchase history for prediction</h3>
                <p class="text-xs max-w-sm mx-auto">Complete more procurement orders to establish regular purchase intervals. At least 2–3 orders per product are needed.</p>
              </div>
            {:else}
              {#if stockoutPredictions.length > 0}
                <div>
                  <h3 class="text-xs font-bold text-rose-500 uppercase tracking-wider mb-3">⚠️ At Risk of Stockout</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each stockoutPredictions as pred}
                      <div class="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-3">
                        <div class="flex items-start justify-between">
                          <div>
                            <h4 class="font-bold text-app-text">{pred.productName}</h4>
                            <p class="text-xs text-app-textMuted">{pred.category}</p>
                          </div>
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            {pred.daysUntilStockout !== null ? `${pred.daysUntilStockout} days left` : 'Uncertain'}
                          </span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-xs bg-app-card p-3 rounded-xl border border-app-border/60">
                          <div><span class="text-[11px] text-app-textMuted block">Current Stock</span><span class="font-bold">{pred.currentStock} {pred.unit}</span></div>
                          <div><span class="text-[11px] text-app-textMuted block">Daily Usage</span><span class="font-bold">{pred.dailyConsumption?.toFixed(2) || pred.avgDailyConsumption?.toFixed(2) || 'N/A'} {pred.unit}/day</span></div>
                          <div><span class="text-[11px] text-app-textMuted block">Reorder Point</span><span class="font-bold text-[#D4A72C]">{pred.reorderPoint} {pred.unit}</span></div>
                          <div><span class="text-[11px] text-app-textMuted block">Lead Time</span><span class="font-bold">{pred.leadTimeDays ?? pred.supplierLeadTimeDays ?? 3} days</span></div>
                        </div>
                        <p class="text-[11px] text-rose-600 font-semibold">{pred.riskReason || pred.reason || 'Stock below reorder point'}</p>
                        <button onclick={() => quickReorder(pred)} class="w-full py-2 text-xs font-bold rounded-xl bg-[#D4A72C] hover:bg-amber-600 text-[#202124] transition">⚡ Create Restock Request</button>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if retailerRecommendations.length > 0}
                <div>
                  <h3 class="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3">🔄 Reorder Recommendations</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each retailerRecommendations as rec}
                      <div class="p-5 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col justify-between space-y-4">
                        <div class="space-y-2">
                          <div class="flex items-start justify-between">
                            <div>
                              <h4 class="font-heading font-bold text-app-text text-base">{rec.productName}</h4>
                              <p class="text-xs text-app-textMuted">Ordered {rec.ordersCount} time(s) • Total: {rec.totalQuantityOrdered} {rec.unit}</p>
                            </div>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase {rec.urgency === 'high' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}">{rec.urgency} Priority</span>
                          </div>
                          <div class="grid grid-cols-2 gap-2 text-xs bg-app-card p-3 rounded-xl border border-app-border/60">
                            <div><span class="text-[11px] text-app-textMuted block">Last Ordered</span><span class="font-bold">{rec.daysSinceLastOrder} days ago</span></div>
                            <div><span class="text-[11px] text-app-textMuted block">Typical Cycle</span><span class="font-bold">{rec.averageIntervalDays ? `Every ${rec.averageIntervalDays} days` : 'Variable'}</span></div>
                          </div>
                        </div>
                        <div class="flex items-center justify-between pt-2 border-t border-app-border/60">
                          <div>
                            <span class="text-[11px] text-app-textMuted block">Recommended Reorder</span>
                            <span class="text-sm font-extrabold text-[#D4A72C]">{rec.recommendedReorderQuantity} {rec.unit}</span>
                          </div>
                          <button onclick={() => quickReorder(rec)} class="px-4 py-2 text-xs font-bold rounded-xl bg-[#D4A72C] text-[#202124] hover:bg-amber-600 shadow-sm transition">⚡ Reorder Now</button>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        </div>

      <!-- ===== PROFITABILITY ===== -->
      {:else if activeTab === 'profitability'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Financial Analytics</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Store Profitability</h1>
            <p class="text-xs text-app-textMuted mt-1">Procurement spend, inventory valuation, and margin metrics from real order data.</p>
          </div>

          {#if profitabilityLoading}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">{#each [1,2,3,4] as _}<div class="h-28 bg-app-card rounded-2xl animate-shimmer border border-app-border"></div>{/each}</div>
          {:else if !profitabilityData}
            <div class="bg-app-card p-6 rounded-3xl border border-app-border text-center space-y-3">
              <BarChart3 class="w-10 h-10 mx-auto text-app-textMuted opacity-40" />
              <h3 class="text-sm font-bold text-app-text">No financial data available yet</h3>
              <p class="text-xs text-app-textMuted max-w-sm mx-auto">Complete procurement orders to generate analytics. Profitability requires at least one delivered order.</p>
              <button onclick={loadProfitability} class="px-4 py-2 text-xs font-bold bg-[#D4A72C] text-[#202124] rounded-xl">Load Analytics</button>
            </div>
          {:else}
            <div class="space-y-6">
              {#if !profitabilityData.hasSalesData}
                <div class="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
                  <span class="text-blue-500 text-lg">ℹ️</span>
                  <div>
                    <p class="text-xs font-bold text-blue-700 dark:text-blue-300">Sales data not yet recorded</p>
                    <p class="text-xs text-app-textMuted mt-0.5">True gross profit requires retail selling prices. Record retail sales in "My Store Inventory" to unlock full P&L calculations.</p>
                  </div>
                </div>
              {/if}

              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm">
                  <span class="text-xs font-bold text-app-textMuted uppercase tracking-wider">Total Procurement Spend</span>
                  <div class="text-2xl font-extrabold text-[#D4A72C] mt-2">₹{profitabilityData.totalProcurementSpend?.toLocaleString('en-IN') || 0}</div>
                  <span class="text-[10px] text-app-textMuted mt-1 block">Completed delivered orders</span>
                </div>
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm">
                  <span class="text-xs font-bold text-app-textMuted uppercase tracking-wider">Orders Delivered</span>
                  <div class="text-2xl font-extrabold text-app-text mt-2">{profitabilityData.totalOrders || 0}</div>
                  <span class="text-[10px] text-app-textMuted mt-1 block">Delivered orders only</span>
                </div>
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm {profitabilityData.hasSalesData ? '' : 'opacity-50'}">
                  <span class="text-xs font-bold text-app-textMuted uppercase tracking-wider">Sales Revenue</span>
                  <div class="text-2xl font-extrabold {profitabilityData.hasSalesData ? 'text-emerald-600' : 'text-app-textMuted'} mt-2">
                    {profitabilityData.hasSalesData ? `₹${profitabilityData.totalSalesRevenue?.toLocaleString('en-IN') || 0}` : '— Record sales'}
                  </div>
                  <span class="text-[10px] text-app-textMuted mt-1 block">From recorded retail sales</span>
                </div>
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm {profitabilityData.hasSalesData ? '' : 'opacity-50'}">
                  <span class="text-xs font-bold text-app-textMuted uppercase tracking-wider">Gross Profit</span>
                  <div class="text-2xl font-extrabold {profitabilityData.hasSalesData ? (profitabilityData.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-app-textMuted'} mt-2">
                    {profitabilityData.hasSalesData ? `₹${profitabilityData.grossProfit?.toLocaleString('en-IN') || 0}` : '— Needs sales data'}
                  </div>
                  <span class="text-[10px] text-app-textMuted mt-1 block">{profitabilityData.hasSalesData ? `${profitabilityData.grossMarginPercent?.toFixed(1) || 0}% gross margin` : 'Unlock by recording sales'}</span>
                </div>
              </div>

              {#if profitabilityData.spendByCategory && profitabilityData.spendByCategory.length > 0}
                <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm">
                  <h3 class="text-sm font-bold font-heading text-app-text mb-4">Spend by Category</h3>
                  <div class="space-y-3">
                    {#each profitabilityData.spendByCategory as cat}
                      {@const pct = profitabilityData.totalProcurementSpend > 0 ? (cat.spend / profitabilityData.totalProcurementSpend * 100) : 0}
                      <div class="space-y-1">
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-bold text-app-text">{cat.category}</span>
                          <span class="text-app-textMuted">₹{cat.spend?.toLocaleString('en-IN')} ({pct.toFixed(1)}%)</span>
                        </div>
                        <div class="w-full bg-app-border/40 h-2 rounded-full overflow-hidden">
                          <div class="bg-[#D4A72C] h-full rounded-full transition-all duration-500" style="width: {pct}%"></div>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}

    </div>
  </div>
</div>

<!-- Quotation Matrix Modal -->
{#if showDetailModal && selectedRequest}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-3xl rounded-3xl border border-app-border shadow-2xl overflow-hidden p-6 space-y-5 animate-toast max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-start border-b border-app-border pb-4">
        <div>
          <span class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Wholesaler Quotation Matrix</span>
          <h3 class="text-xl font-bold font-heading text-app-text mt-0.5">{selectedRequest.productName}</h3>
          <p class="text-xs text-app-textMuted">
            Requested: {selectedRequest.requestedQuantity || selectedRequest.quantity} {selectedRequest.unit}
            {#if selectedRequest.fulfilledQuantity > 0}
              <span class="ml-2 text-blue-600 font-semibold">• Fulfilled so far: {selectedRequest.fulfilledQuantity} {selectedRequest.unit}</span>
            {/if}
          </p>
        </div>
        <button onclick={() => showDetailModal = false} class="p-2 text-app-textMuted hover:text-app-text rounded-lg text-lg" aria-label="Close modal">✕</button>
      </div>

      <div class="flex items-center justify-between p-3.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs">
        <div class="flex items-center space-x-2">
          <Coins class="h-4 w-4 text-[#D4A72C]" />
          <span class="font-bold text-app-text">Price Benchmark & Market History</span>
        </div>
        <button type="button" onclick={() => { priceHistoryProduct = selectedRequest.productName; priceHistoryReqId = selectedRequest._id; }} class="px-3 py-1 font-bold text-xs bg-[#D4A72C] text-[#202124] rounded-lg hover:bg-amber-600 transition">
          View Price History & Trend
        </button>
      </div>

      {#if bidsLoading}
        <div class="py-12 text-center text-app-textMuted text-xs">Loading available bids...</div>
      {:else if requestBids.length === 0}
        <div class="py-12 text-center text-app-textMuted text-xs">No wholesaler bids submitted yet. Local wholesalers have been notified.</div>
      {:else}
        <div class="space-y-3 overflow-y-auto pr-1 flex-1">
          {#each requestBids as bid (bid._id)}
            {@const isPartialOffer = (bid.quantity < (selectedRequest.remainingQuantity || selectedRequest.quantity))}
            <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle space-y-3">
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="text-sm font-bold text-app-text">{bid.wholesalerProfile?.companyName || 'Wholesaler Supplier'}</span>
                    <button type="button" onclick={() => scorecardWholesalerId = bid.wholesaler} class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold hover:bg-emerald-500/20 transition flex items-center gap-1" title="Inspect supplier scorecard">
                      <ShieldCheck class="h-3 w-3" /><span>Scorecard</span>
                    </button>
                  </div>
                  <p class="text-xs text-app-textMuted mt-0.5">ETA: <strong>{bid.deliveryTime}</strong> • Offered: <strong>{bid.quantity} {selectedRequest.unit}</strong></p>
                </div>
                <div class="text-right">
                  <div class="text-base font-extrabold text-[#D4A72C]">₹{bid.price} / {selectedRequest.unit}</div>
                  <div class="text-[11px] text-app-textMuted">Total: ₹{(bid.price * bid.quantity).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {#if bid.items && bid.items.length > 0}
                <div class="border-t border-app-border/60 pt-2 space-y-1.5">
                  <span class="text-[10px] font-bold text-app-textMuted uppercase tracking-wider block">Item Breakdown</span>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {#each bid.items as itm}
                      <div class="p-2 bg-app-card rounded-lg border border-app-border flex items-center justify-between">
                        <div><span class="font-bold text-app-text block">{itm.productName}</span><span class="text-[11px] text-app-textMuted">Offered: {itm.offeredQuantity} / Req: {itm.requestedQuantity}</span></div>
                        <span class="font-bold text-[#D4A72C]">₹{itm.price}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if bid.remarks}
                <p class="text-[11px] text-app-textMuted italic">"{bid.remarks}"</p>
              {/if}

              <div class="flex justify-end pt-2 border-t border-app-border/40">
                {#if selectedRequest.status !== 'accepted' && bid.status !== 'accepted'}
                  <button onclick={() => handleAcceptBid(bid._id, isPartialOffer, bid.quantity)} class="px-4 py-2 text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 {isPartialOffer ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-[#D4A72C] hover:bg-amber-600 text-[#202124]'}">
                    {#if isPartialOffer}<span>Accept Partial ({bid.quantity} {selectedRequest.unit})</span>{:else}<span>Accept Complete Quote</span>{/if}
                  </button>
                {:else if bid.status === 'accepted'}
                  <span class="text-xs font-bold text-emerald-600 px-3 py-1 bg-emerald-500/10 rounded-full flex items-center gap-1">
                    <CheckCircle2 class="h-3.5 w-3.5" /><span>Accepted Quote</span>
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Feature Modals -->
{#if trackingOrderId}
  <DeliveryTrackingModal orderId={trackingOrderId} onClose={() => trackingOrderId = null} />
{/if}

{#if scorecardWholesalerId}
  <SupplierScorecardModal wholesalerId={scorecardWholesalerId} onClose={() => scorecardWholesalerId = null} />
{/if}

{#if priceHistoryProduct}
  <PriceHistoryModal
    productName={priceHistoryProduct}
    requestId={priceHistoryReqId}
    onClose={() => { priceHistoryProduct = null; priceHistoryReqId = null; }}
  />
{/if}

{#if showOptimizerModal && optimizerRequest}
  <ProcurementOptimizerModal
    requestId={optimizerRequest._id}
    requestName={optimizerRequest.productName}
    onClose={() => { showOptimizerModal = false; optimizerRequest = null; }}
    onAccept={(bidId) => handleAcceptBid(bidId)}
  />
{/if}

<!-- Confirmation Dialog -->
{#if showConfirmModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-sm rounded-3xl border border-app-border shadow-2xl p-6 text-center space-y-4 animate-toast">
      <div class="text-3xl">⚠️</div>
      <h3 class="text-base font-bold text-app-text">Confirm Action</h3>
      <p class="text-xs text-app-textMuted leading-relaxed">{confirmMessage}</p>
      <div class="flex space-x-3 pt-2">
        <button onclick={() => showConfirmModal = false} class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-textMuted hover:text-app-text">Cancel</button>
        <button onclick={confirmCallback} class="flex-1 py-2.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs">Confirm</button>
      </div>
    </div>
  </div>
{/if}
