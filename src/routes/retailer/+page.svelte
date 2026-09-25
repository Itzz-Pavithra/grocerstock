<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { api } from '$lib/api.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { toasts } from '$lib/toasts.svelte.js';

  // Active Tab: 'requests' | 'orders' | 'history'
  let activeTab = $state('requests');

  // Core Data States
  let requests = $state([]);
  let orders = $state([]);
  let categories = $state([]);
  let products = $state([]);
  let dashboardLoading = $state(true);
  let ordersLoading = $state(false);

  // Pagination & Filters State
  let currentPage = $state(1);
  let totalPages = $state(1);
  let totalRequestsCount = $state(0);
  let searchQuery = $state('');
  let categoryFilter = $state('');
  let statusFilter = $state('');
  let urgencyFilter = $state('');
  let sortQuery = $state('date_desc');

  // Form State
  let selectedProductId = $state('');
  let reqProductName = $state('');
  let reqCategoryName = $state('');
  let reqBrand = $state('');
  let reqQuantity = $state(1);
  let reqUnit = $state('kg');
  let reqUrgency = $state('medium');
  let reqDeliveryDate = $state('');
  let reqRemarks = $state('');
  let formError = $state('');
  let formSuccess = $state('');
  let formLoading = $state(false);

  // Selected Request Modal State
  let selectedRequest = $state(null);
  let requestBids = $state([]);
  let showDetailModal = $state(false);
  let bidsLoading = $state(false);

  // Confirmation Modal State
  let showConfirmModal = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state(null);

  // Derived KPI Calculations from real database models
  let quotesAwaitingReviewCount = $derived(
    requests.filter(r => r.status === 'responded' || (r.status === 'pending' && r.responsesCount > 0)).length
  );

  let ordersInTransitCount = $derived(
    orders.filter(o => o.status === 'shipped' || o.status === 'processing').length
  );

  let monthlyProcurementSpend = $derived(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return orders
      .filter(o => {
        const d = new Date(o.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && o.status !== 'cancelled';
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  });

  // Low stock products warning
  let lowStockProducts = $derived(
    products.filter(p => p.stockQuantity !== undefined && p.stockQuantity <= 10)
  );

  function triggerConfirm(message, callback) {
    confirmMessage = message;
    confirmCallback = () => {
      callback();
      showConfirmModal = false;
    };
    showConfirmModal = true;
  }

  // Prepopulate form for Quick Reorder
  function quickReorder(item) {
    reqProductName = item.productName || '';
    reqCategoryName = item.category || 'General';
    reqBrand = item.brand || '';
    reqQuantity = item.quantity || 1;
    reqUnit = item.unit || 'kg';
    reqUrgency = 'medium';

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    reqDeliveryDate = targetDate.toISOString().split('T')[0];

    activeTab = 'requests';
    toasts.info(`Stock request form pre-filled for "${reqProductName}".`);
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
      categories = catRes.categories || [];
      const prodRes = await api.get('/common/products');
      products = prodRes.products || [];
    } catch (err) {
      console.error('Failed to load catalogs:', err);
    }
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

    if (!reqProductName || !reqCategoryName || !reqDeliveryDate || reqQuantity <= 0) {
      formError = 'Please fill in all mandatory fields with valid values.';
      formLoading = false;
      return;
    }

    try {
      await api.post('/requests', {
        productName: reqProductName,
        category: reqCategoryName,
        brand: reqBrand,
        quantity: Number(reqQuantity),
        unit: reqUnit,
        urgency: reqUrgency,
        preferredDeliveryDate: reqDeliveryDate,
        remarks: reqRemarks
      });

      toasts.success('Stock request published successfully!');
      formSuccess = 'Stock request posted to local wholesalers!';

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

  async function handleAcceptBid(responseId) {
    triggerConfirm('Are you sure you want to accept this quotation? This will create an official order.', async () => {
      try {
        await api.put(`/responses/${responseId}/accept`);
        toasts.success('Quotation accepted! Order created.');
        showDetailModal = false;
        loadDashboardData(true);
        loadOrders();
      } catch (err) {
        toasts.error(err.message || 'Failed to accept quotation');
      }
    });
  }

  async function handleCancelRequest(requestId) {
    triggerConfirm('Are you sure you want to delete this stock request?', async () => {
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
      goto('/unauthorized');
      return;
    }

    loadDashboardData();
    loadOrders();
    loadCatalogs();
  });
</script>

<div class="min-h-screen bg-app-bg text-app-text p-4 sm:p-6 lg:p-8 transition-colors duration-200 animate-page-fade">
  <div class="max-w-7xl mx-auto space-y-6">
    
    <!-- 1. Header Bar -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm">
      <div>
        <div class="flex items-center space-x-2 text-xs font-bold text-brand-orange uppercase tracking-wider">
          <span>Retailer Procurement Center</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-1">
          Retailer Dashboard
        </h1>
        <p class="text-xs text-app-muted mt-1">
          Create stock requests, evaluate wholesaler quotes, and manage incoming deliveries.
        </p>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex bg-app-cardSubtle p-1.5 rounded-2xl border border-app-border">
        <button 
          onclick={() => activeTab = 'requests'}
          class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all {activeTab === 'requests' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          📝 Stock Requests ({requests.length})
        </button>
        <button 
          onclick={() => { activeTab = 'orders'; loadOrders(); }}
          class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all {activeTab === 'orders' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          📦 Active Orders ({orders.length})
        </button>
      </div>
    </div>

    <!-- 2. Critical Stock Alert Banner -->
    {#if lowStockProducts.length > 0}
      <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div class="flex items-center space-x-3">
          <span class="text-xl">⚠️</span>
          <div>
            <h4 class="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">Critical Low Stock Warning</h4>
            <p class="text-xs text-amber-800 dark:text-amber-400">
              {lowStockProducts.length} product(s) are reaching reorder thresholds. Restock soon to prevent store stockouts.
            </p>
          </div>
        </div>
        <button 
          onclick={() => quickReorder(lowStockProducts[0])}
          class="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition whitespace-nowrap"
        >
          Quick Restock Notice
        </button>
      </div>
    {/if}

    <!-- 3. Real 4 KPI Cards Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- KPI 1: Quotes Awaiting Review -->
      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-amber-500 uppercase tracking-wider">Quotes to Review</span>
        <div class="text-3xl font-extrabold font-heading text-amber-500 mt-2">{quotesAwaitingReviewCount}</div>
        <span class="text-[10px] text-app-muted mt-1 block">Active wholesaler offers</span>
      </div>

      <!-- KPI 2: Orders in Transit -->
      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-brand-orange uppercase tracking-wider">Orders in Transit</span>
        <div class="text-3xl font-extrabold font-heading text-brand-orange mt-2">{ordersInTransitCount}</div>
        <span class="text-[10px] text-app-muted mt-1 block">Shipped & processing</span>
      </div>

      <!-- KPI 3: Critical Low Stock -->
      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-rose-500 uppercase tracking-wider">Low Stock SKUs</span>
        <div class="text-3xl font-extrabold font-heading text-rose-500 mt-2">{lowStockProducts.length}</div>
        <span class="text-[10px] text-app-muted mt-1 block">Reorder buffer limit</span>
      </div>

      <!-- KPI 4: Monthly Procurement Spend (Real calculated sum) -->
      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-app-muted uppercase tracking-wider">Monthly Spend</span>
        <div class="text-3xl font-extrabold font-heading text-app-text mt-2">
          ₹{monthlyProcurementSpend().toLocaleString()}
        </div>
        <span class="text-[10px] text-app-muted mt-1 block">Current month orders</span>
      </div>
    </div>

    <!-- 4. Quick Actions Strip -->
    <div class="flex flex-wrap items-center gap-3 bg-app-card p-4 rounded-2xl border border-app-border shadow-sm">
      <span class="text-xs font-bold text-app-muted uppercase tracking-wider mr-2">Quick Actions:</span>
      <button 
        onclick={() => activeTab = 'requests'}
        class="px-4 py-2 text-xs font-bold bg-brand-orange text-white rounded-xl shadow-xs hover:bg-brand-orange/90 transition hover-lift"
      >
        + New Stock Request
      </button>
      {#if orders.length > 0}
        <button 
          onclick={() => quickReorder(orders[0])}
          class="px-4 py-2 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text rounded-xl hover:bg-app-border/40 transition hover-lift"
        >
          ⚡ Reorder Last Purchase
        </button>
      {/if}
      <button 
        onclick={() => { activeTab = 'orders'; loadOrders(); }}
        class="px-4 py-2 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text rounded-xl hover:bg-app-border/40 transition hover-lift"
      >
        🚚 View Active Shipments
      </button>
    </div>

    {#if activeTab === 'requests'}
      <!-- Main Content Grid: Create Request Form + Requests & Quotation Feed -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- Create Request Form -->
        <div class="lg:col-span-1 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm h-fit space-y-4">
          <h2 class="text-lg font-bold font-heading text-app-text border-b border-app-border pb-3 flex items-center justify-between">
            <span>Publish Stock Request</span>
            <span class="text-xs text-brand-orange font-bold">Step 1</span>
          </h2>

          <form onsubmit={handleCreateRequest} class="space-y-4">
            {#if formError}
              <div class="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-xl font-semibold border border-rose-200">
                {formError}
              </div>
            {/if}
            {#if formSuccess}
              <div class="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 rounded-xl font-semibold border border-emerald-200">
                {formSuccess}
              </div>
            {/if}

            <div>
              <label for="prod-select" class="block text-xs font-bold text-app-muted uppercase tracking-wider mb-1">Pick Catalog Item (Optional)</label>
              <select 
                id="prod-select"
                value={selectedProductId}
                onchange={handleProductSelect}
                class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
              >
                <option value="">-- Choose from standard catalog --</option>
                {#each products as p}
                  <option value={p._id}>{p.name} ({p.brand})</option>
                {/each}
              </select>
            </div>

            <div>
              <label for="req-name" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Product Name *</label>
              <input 
                id="req-name"
                type="text" 
                bind:value={reqProductName}
                placeholder="e.g. Sona Masoori Rice"
                class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                required
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="req-cat" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Category *</label>
                <input 
                  id="req-cat"
                  type="text" 
                  bind:value={reqCategoryName}
                  placeholder="Grains & Rice"
                  class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                  required
                />
              </div>
              <div>
                <label for="req-brand" class="block text-xs font-bold text-app-muted uppercase tracking-wider mb-1">Brand</label>
                <input 
                  id="req-brand"
                  type="text" 
                  bind:value={reqBrand}
                  placeholder="Fortune"
                  class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="req-qty" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Quantity *</label>
                <input 
                  id="req-qty"
                  type="number" 
                  min="1"
                  bind:value={reqQuantity}
                  class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                  required
                />
              </div>
              <div>
                <label for="req-unit" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Unit *</label>
                <input 
                  id="req-unit"
                  type="text" 
                  bind:value={reqUnit}
                  placeholder="kg, box, bag"
                  class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                  required
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="req-urgency" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Urgency</label>
                <select 
                  id="req-urgency"
                  bind:value={reqUrgency}
                  class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High Urgency</option>
                </select>
              </div>
              <div>
                <label for="req-date" class="block text-xs font-bold text-app-text uppercase tracking-wider mb-1">Needed By *</label>
                <input 
                  id="req-date"
                  type="date" 
                  bind:value={reqDeliveryDate}
                  class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label for="req-remarks" class="block text-xs font-bold text-app-muted uppercase tracking-wider mb-1">Remarks / Notes</label>
              <textarea 
                id="req-remarks"
                bind:value={reqRemarks}
                rows="2"
                placeholder="Prefer morning doorstep delivery..."
                class="w-full px-3.5 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
              ></textarea>
            </div>

            <button 
              type="submit" 
              disabled={formLoading}
              class="w-full py-3 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl transition-all shadow-md hover-lift flex justify-center items-center"
            >
              {formLoading ? 'Publishing...' : 'Publish Stock Request'}
            </button>
          </form>
        </div>

        <!-- 5. Quotation Decision Hub & Active Requests Panel -->
        <div class="lg:col-span-2 space-y-4">
          <!-- Search & Filter Bar -->
          <div class="bg-app-card p-4 rounded-2xl border border-app-border shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div class="relative flex-1 min-w-[200px]">
              <input 
                type="text" 
                bind:value={searchQuery}
                oninput={() => loadDashboardData()}
                placeholder="Search products or brands..."
                class="w-full pl-9 pr-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
              />
              <span class="absolute left-3 top-2.5 text-app-muted text-xs">🔍</span>
            </div>

            <div class="flex items-center space-x-2">
              <select 
                bind:value={statusFilter}
                onchange={() => loadDashboardData()}
                class="px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="responded">Responded</option>
                <option value="accepted">Accepted</option>
              </select>

              <select 
                bind:value={urgencyFilter}
                onchange={() => loadDashboardData()}
                class="px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none"
              >
                <option value="">All Urgencies</option>
                <option value="high">High Urgency</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <!-- Request Items List -->
          {#if dashboardLoading}
            <div class="space-y-4">
              {#each Array(4) as _}
                <div class="h-28 bg-app-card rounded-2xl border border-app-border animate-shimmer"></div>
              {/each}
            </div>
          {:else if requests.length === 0}
            <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-3">
              <div class="text-4xl">🛒</div>
              <h3 class="text-base font-bold text-app-text">No Stock Requests Found</h3>
              <p class="text-xs text-app-muted max-w-sm mx-auto">
                No active stock requests match your filters. Use the form to publish your inventory requirements.
              </p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each requests as reqItem (reqItem._id)}
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
                  <div class="space-y-1">
                    <div class="flex items-center space-x-2">
                      <span class="text-base font-bold text-app-text">{reqItem.productName}</span>
                      {#if reqItem.brand}
                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-app-cardSubtle text-app-muted font-bold">{reqItem.brand}</span>
                      {/if}
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase
                        {reqItem.urgency === 'high' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}"
                      >
                        {reqItem.urgency}
                      </span>
                    </div>

                    <div class="text-xs text-app-muted flex items-center space-x-4">
                      <span>Category: <strong>{reqItem.category}</strong></span>
                      <span>Qty: <strong class="text-brand-orange">{reqItem.quantity} {reqItem.unit}</strong></span>
                      <span>Needed: <strong>{new Date(reqItem.preferredDeliveryDate).toLocaleDateString()}</strong></span>
                    </div>
                  </div>

                  <div class="flex items-center space-x-3 w-full sm:w-auto justify-end">
                    <button 
                      onclick={() => openBidsModal(reqItem)}
                      class="px-3.5 py-1.5 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs transition"
                    >
                      Compare Bids
                    </button>

                    <button 
                      onclick={() => quickReorder(reqItem)}
                      class="px-3 py-1.5 text-xs font-bold bg-app-cardSubtle hover:bg-app-border/40 text-app-text rounded-xl border border-app-border transition"
                      title="Duplicate & Reorder"
                    >
                      ⚡ Reorder
                    </button>

                    {#if reqItem.status === 'pending'}
                      <button 
                        onclick={() => handleCancelRequest(reqItem._id)}
                        class="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                        title="Delete Request"
                      >
                        🗑️
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>

            <!-- Pagination -->
            {#if totalPages > 1}
              <div class="flex justify-between items-center bg-app-card p-4 rounded-2xl border border-app-border text-xs font-semibold">
                <button 
                  onclick={() => { currentPage = Math.max(1, currentPage - 1); loadDashboardData(); }}
                  disabled={currentPage === 1}
                  class="px-3 py-1.5 rounded-lg border border-app-border hover:bg-app-cardSubtle disabled:opacity-40"
                >
                  ← Previous
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button 
                  onclick={() => { currentPage = Math.min(totalPages, currentPage + 1); loadDashboardData(); }}
                  disabled={currentPage === totalPages}
                  class="px-3 py-1.5 rounded-lg border border-app-border hover:bg-app-cardSubtle disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {:else}
      <!-- 6. Active Orders & Delivery Lifecycle Tracking Panel -->
      <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
        <h2 class="text-xl font-bold font-heading text-app-text border-b border-app-border pb-3">
          Active Orders & Delivery Tracking ({orders.length})
        </h2>

        {#if ordersLoading}
          <div class="space-y-4">
            {#each Array(3) as _}
              <div class="h-24 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
            {/each}
          </div>
        {:else if orders.length === 0}
          <div class="text-center py-12 text-app-muted space-y-2">
            <div class="text-4xl">📦</div>
            <h3 class="text-sm font-bold text-app-text">No data available yet</h3>
            <p class="text-xs max-w-sm mx-auto">When you accept a wholesaler's quotation, your order will appear here with live tracking updates.</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each orders as ord (ord._id)}
              <div class="p-5 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
                <div class="space-y-1.5">
                  <div class="flex items-center space-x-3">
                    <span class="text-xs font-mono font-bold text-app-muted">#{ord._id.slice(-6)}</span>
                    <span class="text-base font-bold text-app-text">{ord.productName}</span>
                    <span class="text-xs font-bold text-brand-orange">₹{ord.totalAmount}</span>
                  </div>
                  <div class="text-xs text-app-muted space-x-4">
                    <span>Qty: <strong>{ord.quantity} {ord.unit}</strong> (@ ₹{ord.unitPrice}/{ord.unit})</span>
                    <span>Supplier: <strong>{ord.wholesalerProfile?.companyName || 'Wholesaler'}</strong></span>
                  </div>
                  <div class="text-[11px] text-app-muted">
                    Placed: {new Date(ord.createdAt).toLocaleDateString()} {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <!-- Actual Supported Order Status Lifecycle -->
                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div class="flex items-center space-x-1.5 text-[11px] font-bold">
                    <span class="px-2.5 py-1 rounded-full uppercase tracking-wider
                      {ord.status === 'accepted' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                       ord.status === 'processing' ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30' :
                       ord.status === 'shipped' ? 'bg-purple-500/20 text-purple-500 border border-purple-500/30' :
                       ord.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-slate-500/20 text-app-muted'}"
                    >
                      {ord.status}
                    </span>
                  </div>

                  <button 
                    onclick={() => quickReorder(ord)}
                    class="px-3.5 py-1.5 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs transition"
                  >
                    ⚡ Reorder This Item
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

  </div>
</div>

<!-- Quotation Comparison Modal -->
{#if showDetailModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-2xl rounded-3xl border border-app-border shadow-2xl overflow-hidden p-6 space-y-5 animate-toast">
      <div class="flex justify-between items-start border-b border-app-border pb-4">
        <div>
          <span class="text-xs font-bold text-brand-orange uppercase tracking-wider">Wholesaler Quotation Matrix</span>
          <h3 class="text-xl font-bold font-heading text-app-text mt-0.5">{selectedRequest?.productName}</h3>
          <p class="text-xs text-app-muted">Quantity requested: {selectedRequest?.quantity} {selectedRequest?.unit}</p>
        </div>
        <button 
          onclick={() => showDetailModal = false}
          class="p-2 text-app-muted hover:text-app-text rounded-lg text-lg"
        >
          ✕
        </button>
      </div>

      {#if bidsLoading}
        <div class="py-12 text-center text-app-muted text-xs">Loading available bids...</div>
      {:else if requestBids.length === 0}
        <div class="py-12 text-center text-app-muted text-xs">No data available yet. Wholesalers have been notified.</div>
      {:else}
        <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
          {#each requestBids as bid (bid._id)}
            <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="text-sm font-bold text-app-text">{bid.wholesalerProfile?.companyName || 'Wholesaler Supplier'}</span>
                  <span class="text-xs font-extrabold text-brand-orange">₹{bid.price} / {selectedRequest?.unit}</span>
                  <span class="text-xs font-bold text-app-muted">(Total: ₹{(bid.price * (bid.quantity || selectedRequest?.quantity)).toLocaleString()})</span>
                </div>
                <div class="text-xs text-app-muted space-x-3">
                  <span>Available Qty: <strong>{bid.quantity} {selectedRequest?.unit}</strong></span>
                  <span>ETA: <strong>{bid.deliveryTime}</strong></span>
                </div>
                {#if bid.remarks}
                  <p class="text-[11px] text-app-muted italic">"{bid.remarks}"</p>
                {/if}
              </div>

              {#if selectedRequest.status !== 'accepted'}
                <button 
                  onclick={() => handleAcceptBid(bid._id)}
                  class="px-4 py-2 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs transition"
                >
                  Accept Quote
                </button>
              {:else if bid.status === 'accepted'}
                <span class="text-xs font-bold text-emerald-500 px-3 py-1 bg-emerald-500/10 rounded-full">✓ Accepted Quote</span>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Custom Confirmation Modal -->
{#if showConfirmModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-sm rounded-3xl border border-app-border shadow-2xl p-6 text-center space-y-4 animate-toast">
      <div class="text-3xl">⚠️</div>
      <h3 class="text-base font-bold text-app-text">Confirm Action</h3>
      <p class="text-xs text-app-muted leading-relaxed">{confirmMessage}</p>
      <div class="flex space-x-3 pt-2">
        <button 
          onclick={() => showConfirmModal = false}
          class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-muted hover:text-app-text"
        >
          Cancel
        </button>
        <button 
          onclick={confirmCallback}
          class="flex-1 py-2.5 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}
