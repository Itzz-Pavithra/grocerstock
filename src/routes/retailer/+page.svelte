<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { api } from '$lib/api.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import SupplierMap from '$lib/components/SupplierMap.svelte';
  import DeliveryTrackingModal from '$lib/components/DeliveryTrackingModal.svelte';
  import SupplierScorecardModal from '$lib/components/SupplierScorecardModal.svelte';
  import PriceHistoryModal from '$lib/components/PriceHistoryModal.svelte';
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
    CheckCircle2
  } from 'lucide-svelte';

  // Active Tab: 'requests' | 'orders' | 'reorder' | 'map'
  let activeTab = $state('requests');

  // Core Data States
  let requests = $state([]);
  let orders = $state([]);
  let categories = $state([]);
  let products = $state([]);
  let retailerRecommendations = $state([]);
  let recommendationsLoading = $state(false);
  let dashboardLoading = $state(true);
  let ordersLoading = $state(false);
  let retailerProfile = $state(null);

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

  // Confirmation Modal State
  let showConfirmModal = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state(null);

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
      categories = catRes || [];
      const prodRes = await api.get('/common/products');
      products = prodRes || [];
    } catch (err) {
      console.error('Failed to load catalogs:', err);
    }
  }

  // FEATURE 1: Load Smart Reorder Recommendations
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
      goto('/unauthorized');
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
  });
</script>

<div class="min-h-screen bg-app-bg text-app-text p-4 sm:p-6 lg:p-8 transition-colors duration-200 animate-page-fade">
  <div class="max-w-7xl mx-auto space-y-6">
    
    <!-- Header Bar -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm">
      <div>
        <div class="flex items-center space-x-2 text-xs font-bold text-brand-orange uppercase tracking-wider">
          <span>Retailer Procurement Center</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-1">
          Retailer Dashboard
        </h1>
        <p class="text-xs text-app-textMuted mt-1">
          Create single or multi-item stock requests, compare quotation prices against historical data, and track real-time deliveries.
        </p>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex flex-wrap bg-app-cardSubtle p-1.5 rounded-2xl border border-app-border gap-1">
        <button 
          onclick={() => activeTab = 'requests'}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'requests' ? 'bg-brand-orange text-white shadow-md' : 'text-app-textMuted hover:text-app-text'}"
        >
          📝 Requests ({requests.length})
        </button>
        <button 
          onclick={() => { activeTab = 'orders'; loadOrders(); }}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'orders' ? 'bg-brand-orange text-white shadow-md' : 'text-app-textMuted hover:text-app-text'}"
        >
          📦 Orders ({orders.length})
        </button>
        <button 
          onclick={() => { activeTab = 'reorder'; loadRecommendations(); }}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'reorder' ? 'bg-brand-orange text-white shadow-md' : 'text-app-textMuted hover:text-app-text'}"
        >
          ⚡ Smart Reorder
        </button>
        <button 
          onclick={() => activeTab = 'map'}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'map' ? 'bg-brand-orange text-white shadow-md' : 'text-app-textMuted hover:text-app-text'}"
        >
          🗺️ Find Wholesalers
        </button>
      </div>
    </div>

    <!-- Critical Low Stock Warning -->
    {#if lowStockProducts.length > 0}
      <div class="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-center space-x-3">
          <span class="text-xl">⚠️</span>
          <div>
            <h4 class="text-xs font-bold text-amber-600 uppercase tracking-wider">Low Stock Notice</h4>
            <p class="text-xs text-app-textMuted">
              {lowStockProducts.length} product(s) are reaching minimum inventory thresholds. Restock now to prevent stockouts.
            </p>
          </div>
        </div>
        <button 
          onclick={() => quickReorder(lowStockProducts[0])}
          class="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition whitespace-nowrap"
        >
          Restock {lowStockProducts[0].name}
        </button>
      </div>
    {/if}

    <!-- KPI Cards Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-amber-500 uppercase tracking-wider">Quotes to Review</span>
        <div class="text-3xl font-extrabold font-heading text-amber-500 mt-2">{quotesAwaitingReviewCount}</div>
        <span class="text-[10px] text-app-textMuted mt-1 block">Active supplier quotations</span>
      </div>

      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-brand-orange uppercase tracking-wider">Orders in Transit</span>
        <div class="text-3xl font-extrabold font-heading text-brand-orange mt-2">{ordersInTransitCount}</div>
        <span class="text-[10px] text-app-textMuted mt-1 block">Packed, shipped, or out for delivery</span>
      </div>

      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-rose-500 uppercase tracking-wider">Low Stock SKUs</span>
        <div class="text-3xl font-extrabold font-heading text-rose-500 mt-2">{lowStockProducts.length}</div>
        <span class="text-[10px] text-app-textMuted mt-1 block">Catalog low stock buffer</span>
      </div>

      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider">Monthly Spend</span>
        <div class="text-3xl font-extrabold font-heading text-app-text mt-2">
          ₹{monthlyProcurementSpend().toLocaleString('en-IN')}
        </div>
        <span class="text-[10px] text-app-textMuted mt-1 block">Completed & active orders</span>
      </div>
    </div>

    <!-- TAB 1: Stock Requests & Multi-Product Procurement -->
    {#if activeTab === 'requests'}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Request Creation Form (4 cols) -->
        <div class="lg:col-span-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm h-fit space-y-4">
          <div class="flex items-center justify-between border-b border-app-border pb-3">
            <div>
              <h2 class="text-base font-bold font-heading text-app-text">
                {isMultiProduct ? 'Multi-Product Procurement' : 'Create Stock Request'}
              </h2>
              <p class="text-[11px] text-app-textMuted">Broadcast directly to local wholesalers</p>
            </div>
            
            <!-- Multi-Product Toggle Button (Feature 6) -->
            <button
              type="button"
              onclick={() => isMultiProduct = !isMultiProduct}
              class="px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors flex items-center gap-1
                {isMultiProduct ? 'bg-brand-orange text-white border-brand-orange' : 'bg-app-cardSubtle border-app-border text-app-text hover:border-brand-orange'}"
            >
              <Layers class="h-3 w-3" />
              <span>{isMultiProduct ? 'Multi' : 'Single'}</span>
            </button>
          </div>

          <form onsubmit={handleCreateRequest} class="space-y-4">
            {#if formError}
              <div class="p-3 text-xs bg-rose-500/10 text-rose-600 rounded-xl font-semibold border border-rose-500/20">
                {formError}
              </div>
            {/if}
            {#if formSuccess}
              <div class="p-3 text-xs bg-emerald-500/10 text-emerald-600 rounded-xl font-semibold border border-emerald-500/20">
                {formSuccess}
              </div>
            {/if}

            {#if !isMultiProduct}
              <!-- Single Item Fields -->
              <div>
                <label for="prod-select" class="block text-xs font-bold text-app-textMuted uppercase tracking-wider mb-1">Pick From Catalog (Optional)</label>
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
                  placeholder="e.g. Sona Masoori Raw Rice"
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
                    placeholder="Pantry Staples"
                    class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label for="req-brand" class="block text-xs font-bold text-app-textMuted uppercase tracking-wider mb-1">Brand</label>
                  <input 
                    id="req-brand"
                    type="text" 
                    bind:value={reqBrand}
                    placeholder="Brand name"
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
                    placeholder="kg, liter, box"
                    class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                    required
                  />
                </div>
              </div>
            {:else}
              <!-- FEATURE 6: Multi-Product Items Array Dynamic Builder -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-app-text uppercase tracking-wider">Procurement Items ({multiItems.length})</span>
                  <button
                    type="button"
                    onclick={addMultiItemRow}
                    class="text-xs font-bold text-brand-orange hover:underline flex items-center gap-1"
                  >
                    <Plus class="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div class="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {#each multiItems as item, idx}
                    <div class="p-3 bg-app-cardSubtle border border-app-border rounded-xl space-y-2 relative group">
                      <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold text-brand-orange">Item #{idx + 1}</span>
                        {#if multiItems.length > 1}
                          <button
                            type="button"
                            onclick={() => removeMultiItemRow(idx)}
                            class="text-rose-500 hover:text-rose-600 p-0.5"
                            title="Remove item"
                          >
                            <Trash2 class="h-3.5 w-3.5" />
                          </button>
                        {/if}
                      </div>

                      <input
                        type="text"
                        bind:value={item.productName}
                        placeholder="Product Name (e.g. Rice 25kg)"
                        class="w-full px-2.5 py-1.5 text-xs bg-app-card border border-app-border rounded-lg text-app-text focus:outline-none focus:border-brand-orange"
                        required
                      />

                      <div class="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          bind:value={item.category}
                          placeholder="Category"
                          class="px-2 py-1 text-xs bg-app-card border border-app-border rounded-lg text-app-text focus:outline-none"
                          required
                        />
                        <input
                          type="number"
                          min="1"
                          bind:value={item.quantity}
                          placeholder="Qty"
                          class="px-2 py-1 text-xs bg-app-card border border-app-border rounded-lg text-app-text focus:outline-none"
                          required
                        />
                        <input
                          type="text"
                          bind:value={item.unit}
                          placeholder="Unit (kg/L)"
                          class="px-2 py-1 text-xs bg-app-card border border-app-border rounded-lg text-app-text focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

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
              <label for="req-remarks" class="block text-xs font-bold text-app-textMuted uppercase tracking-wider mb-1">Delivery Notes</label>
              <textarea 
                id="req-remarks"
                bind:value={reqRemarks}
                rows="2"
                placeholder="Prefer morning delivery to store back door..."
                class="w-full px-3.5 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
              ></textarea>
            </div>

            <button 
              type="submit" 
              disabled={formLoading}
              class="w-full py-3 text-xs font-bold bg-brand-orange hover:bg-brand-orangeHover text-white rounded-xl transition-all shadow-md hover-lift flex justify-center items-center"
            >
              {formLoading ? 'Publishing Request...' : 'Publish Procurement Request'}
            </button>
          </form>
        </div>

        <!-- Requests Feed (8 cols) -->
        <div class="lg:col-span-8 space-y-4">
          <!-- Search & Filter Bar -->
          <div class="bg-app-card p-4 rounded-2xl border border-app-border shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div class="relative flex-1 min-w-[200px]">
              <input 
                type="text" 
                bind:value={searchQuery}
                oninput={() => loadDashboardData()}
                placeholder="Search requests by product..."
                class="w-full pl-9 pr-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
              />
              <span class="absolute left-3 top-2.5 text-app-textMuted text-xs">🔍</span>
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
                <option value="partially_fulfilled">Partially Fulfilled</option>
                <option value="accepted">Accepted</option>
              </select>

              <select 
                bind:value={urgencyFilter}
                onchange={() => loadDashboardData()}
                class="px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none"
              >
                <option value="">All Urgencies</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <!-- Requests List -->
          {#if dashboardLoading}
            <div class="space-y-3">
              {#each [1, 2, 3] as _}
                <div class="h-28 bg-app-card rounded-2xl border border-app-border animate-shimmer"></div>
              {/each}
            </div>
          {:else if requests.length === 0}
            <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-3">
              <div class="text-4xl">🛒</div>
              <h3 class="text-base font-bold text-app-text">No Stock Requests Found</h3>
              <p class="text-xs text-app-textMuted max-w-sm mx-auto">
                No active stock requests match your filters. Use the procurement form to request stock from wholesalers.
              </p>
            </div>
          {:else}
            <div class="space-y-3">
              {#each requests as reqItem (reqItem._id)}
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
                  <div class="space-y-1.5 flex-1">
                    <div class="flex items-center space-x-2">
                      <span class="text-base font-bold text-app-text">{reqItem.productName}</span>
                      {#if reqItem.brand}
                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-app-cardSubtle text-app-textMuted font-bold">{reqItem.brand}</span>
                      {/if}
                      
                      <!-- Status Badge -->
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase
                        {reqItem.status === 'partially_fulfilled' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                         reqItem.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' :
                         reqItem.status === 'responded' ? 'bg-brand-orange/10 text-brand-orange' : 'bg-amber-500/10 text-amber-500'}"
                      >
                        {reqItem.status.replace(/_/g, ' ')}
                      </span>

                      {#if reqItem.items && reqItem.items.length > 1}
                        <span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 font-bold">
                          {reqItem.items.length} Products
                        </span>
                      {/if}
                    </div>

                    <div class="text-xs text-app-textMuted flex flex-wrap items-center gap-3">
                      <span>Category: <strong>{reqItem.category}</strong></span>
                      <span>Quantity: <strong class="text-brand-orange">{reqItem.quantity} {reqItem.unit}</strong></span>
                      <span>Needed: <strong>{new Date(reqItem.preferredDeliveryDate).toLocaleDateString()}</strong></span>
                    </div>

                    <!-- Partial Fulfillment Bar (Feature 5) -->
                    {#if reqItem.status === 'partially_fulfilled' || (reqItem.fulfilledQuantity && reqItem.fulfilledQuantity > 0)}
                      <div class="pt-1.5 space-y-1">
                        <div class="flex items-center justify-between text-[11px]">
                          <span class="text-blue-600 font-semibold">
                            Fulfilled: {reqItem.fulfilledQuantity} / {reqItem.requestedQuantity || reqItem.quantity} {reqItem.unit}
                          </span>
                          <span class="text-app-textMuted font-semibold">
                            Remaining: {reqItem.remainingQuantity || 0} {reqItem.unit}
                          </span>
                        </div>
                        <div class="w-full bg-app-border/40 h-2 rounded-full overflow-hidden">
                          <div 
                            class="bg-blue-500 h-full rounded-full transition-all duration-300"
                            style="width: {Math.min(100, Math.round(((reqItem.fulfilledQuantity || 0) / (reqItem.requestedQuantity || reqItem.quantity || 1)) * 100))}%"
                          ></div>
                        </div>
                      </div>
                    {/if}
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
                    <button 
                      onclick={() => openBidsModal(reqItem)}
                      class="px-3.5 py-1.5 text-xs font-bold bg-brand-orange hover:bg-brand-orangeHover text-white rounded-xl shadow-xs transition"
                    >
                      Compare Quotations
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
                        class="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                        title="Delete Request"
                      >
                        <Trash2 class="h-4 w-4" />
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

    <!-- TAB 2: Active Orders & Delivery Tracking -->
    {:else if activeTab === 'orders'}
      <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
        <div class="flex items-center justify-between border-b border-app-border pb-3">
          <div>
            <h2 class="text-xl font-bold font-heading text-app-text">
              Active Orders & Delivery Tracking ({orders.length})
            </h2>
            <p class="text-xs text-app-textMuted">Track order fulfillment milestones from warehouse to delivery</p>
          </div>
          <button
            onclick={loadOrders}
            class="px-3 py-1.5 text-xs font-bold rounded-lg border border-app-border hover:bg-app-cardSubtle"
          >
            Refresh
          </button>
        </div>

        {#if ordersLoading}
          <div class="space-y-4">
            {#each [1, 2, 3] as _}
              <div class="h-24 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
            {/each}
          </div>
        {:else if orders.length === 0}
          <div class="text-center py-12 text-app-textMuted space-y-2">
            <div class="text-4xl">📦</div>
            <h3 class="text-sm font-bold text-app-text">No Orders Placed Yet</h3>
            <p class="text-xs max-w-sm mx-auto">When you accept a quotation, your order appears here with live delivery tracking milestones.</p>
          </div>
        {:else}
          <div class="space-y-3">
            {#each orders as ord (ord._id)}
              <div class="p-5 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
                <div class="space-y-1.5">
                  <div class="flex items-center space-x-3">
                    <span class="text-xs font-mono font-bold text-app-textMuted">#{ord._id.slice(-6)}</span>
                    <span class="text-base font-bold text-app-text">{ord.productName}</span>
                    <span class="text-xs font-bold text-brand-orange">₹{ord.totalAmount}</span>
                  </div>
                  <div class="text-xs text-app-textMuted space-x-4">
                    <span>Quantity: <strong>{ord.quantity} {ord.unit}</strong> (@ ₹{ord.unitPrice}/{ord.unit})</span>
                    <span>Wholesaler: <strong>{ord.wholesalerProfile?.companyName || 'Wholesaler'}</strong></span>
                  </div>
                  <div class="text-[11px] text-app-textMuted">
                    Placed: {new Date(ord.createdAt).toLocaleDateString()} {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <!-- Order Status & Milestone Tracking Actions (Feature 4) -->
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider
                    {ord.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30' :
                     ord.status === 'shipped' || ord.status === 'out_for_delivery' ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30' :
                     ord.status === 'packed' || ord.status === 'processing' ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30' :
                     'bg-amber-500/20 text-amber-600 border border-amber-500/30'}"
                  >
                    {ord.status.replace(/_/g, ' ')}
                  </span>

                  <!-- Track Delivery Button (Feature 4) -->
                  <button 
                    onclick={() => trackingOrderId = ord._id}
                    class="px-3 py-1.5 text-xs font-bold bg-app-card border border-app-border hover:border-brand-orange text-app-text rounded-xl transition flex items-center gap-1.5"
                  >
                    <Truck class="h-3.5 w-3.5 text-brand-orange" />
                    <span>Track Delivery</span>
                  </button>

                  <button 
                    onclick={() => quickReorder(ord)}
                    class="px-3 py-1.5 text-xs font-bold bg-brand-orange hover:bg-brand-orangeHover text-white rounded-xl shadow-xs transition"
                  >
                    Reorder
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    <!-- TAB 3: Smart Reorder & Depletion Recommendations (Feature 1) -->
    {:else if activeTab === 'reorder'}
      <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
        <div class="flex items-center justify-between border-b border-app-border pb-3">
          <div class="flex items-center space-x-3">
            <div class="p-2.5 rounded-xl bg-brand-orange/10 text-brand-orange">
              <Sparkles class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-xl font-bold font-heading text-app-text">
                Smart Reorder Recommendations
              </h2>
              <p class="text-xs text-app-textMuted">Intelligent predictions calculated from your real purchase order intervals</p>
            </div>
          </div>
          <button
            onclick={loadRecommendations}
            class="px-3 py-1.5 text-xs font-bold rounded-lg border border-app-border hover:bg-app-cardSubtle"
          >
            Refresh
          </button>
        </div>

        {#if recommendationsLoading}
          <div class="space-y-4">
            {#each [1, 2] as _}
              <div class="h-28 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
            {/each}
          </div>
        {:else if retailerRecommendations.length === 0}
          <div class="text-center py-12 text-app-textMuted space-y-2">
            <Sparkles class="h-8 w-8 text-brand-orange mx-auto opacity-50 mb-2" />
            <h3 class="text-sm font-bold text-app-text">Insufficient history for prediction</h3>
            <p class="text-xs max-w-sm mx-auto">Complete more procurement orders to establish regular purchase intervals and stockout predictions.</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each retailerRecommendations as rec}
              <div class="p-5 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col justify-between space-y-4">
                <div class="space-y-2">
                  <div class="flex items-start justify-between">
                    <div>
                      <h4 class="font-heading font-bold text-app-text text-base">{rec.productName}</h4>
                      <p class="text-xs text-app-textMuted">
                        Ordered {rec.ordersCount} time(s) • Total: {rec.totalQuantityOrdered} {rec.unit}
                      </p>
                    </div>

                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase
                      {rec.urgency === 'high' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}"
                    >
                      {rec.urgency} Priority
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-xs bg-app-card p-3 rounded-xl border border-app-border/60">
                    <div>
                      <span class="text-[11px] text-app-textMuted block">Last Ordered</span>
                      <span class="font-bold text-app-text">{rec.daysSinceLastOrder} days ago</span>
                    </div>
                    <div>
                      <span class="text-[11px] text-app-textMuted block">Typical Cycle</span>
                      <span class="font-bold text-app-text">{rec.averageIntervalDays ? `Every ${rec.averageIntervalDays} days` : 'Variable'}</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-app-border/60">
                  <div>
                    <span class="text-[11px] text-app-textMuted block">Recommended Reorder</span>
                    <span class="text-sm font-extrabold text-brand-orange">{rec.recommendedReorderQuantity} {rec.unit}</span>
                  </div>

                  <button
                    onclick={() => quickReorder(rec)}
                    class="px-4 py-2 text-xs font-bold rounded-xl bg-brand-orange text-white hover:bg-brand-orangeHover shadow-sm transition"
                  >
                    ⚡ Reorder Now
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    <!-- TAB 4: Map-Based Supplier Discovery (Features 10 & 11) -->
    {:else if activeTab === 'map'}
      <div class="space-y-4">
        <SupplierMap 
          userLocation={retailerProfile}
          categories={categories}
          onSelectSupplier={(w) => {
            reqRemarks = `Preferred Supplier: ${w.companyName}`;
            activeTab = 'requests';
            toasts.info(`Supplier "${w.companyName}" targeted for request.`);
          }}
        />
      </div>
    {/if}

  </div>
</div>

<!-- Quotation Matrix Modal (Features 2, 3, 5, 6) -->
{#if showDetailModal && selectedRequest}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-3xl rounded-3xl border border-app-border shadow-2xl overflow-hidden p-6 space-y-5 animate-toast max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-start border-b border-app-border pb-4">
        <div>
          <span class="text-xs font-bold text-brand-orange uppercase tracking-wider">Wholesaler Quotation Matrix</span>
          <h3 class="text-xl font-bold font-heading text-app-text mt-0.5">{selectedRequest.productName}</h3>
          <p class="text-xs text-app-textMuted">
            Requested: {selectedRequest.requestedQuantity || selectedRequest.quantity} {selectedRequest.unit}
            {#if selectedRequest.fulfilledQuantity > 0}
              <span class="ml-2 text-blue-600 font-semibold">• Fulfilled so far: {selectedRequest.fulfilledQuantity} {selectedRequest.unit}</span>
            {/if}
          </p>
        </div>
        <button 
          onclick={() => showDetailModal = false}
          class="p-2 text-app-textMuted hover:text-app-text rounded-lg text-lg"
        >
          ✕
        </button>
      </div>

      <!-- Quick Action: Price History Benchmark (Feature 2) -->
      <div class="flex items-center justify-between p-3.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs">
        <div class="flex items-center space-x-2">
          <Coins class="h-4 w-4 text-brand-orange" />
          <span class="font-bold text-app-text">Price Benchmark & Market History</span>
        </div>
        <button
          type="button"
          onclick={() => {
            priceHistoryProduct = selectedRequest.productName;
            priceHistoryReqId = selectedRequest._id;
          }}
          class="px-3 py-1 font-bold text-xs bg-brand-orange text-white rounded-lg hover:bg-brand-orangeHover transition"
        >
          View Price History & Trend
        </button>
      </div>

      {#if bidsLoading}
        <div class="py-12 text-center text-app-textMuted text-xs">Loading available bids...</div>
      {:else if requestBids.length === 0}
        <div class="py-12 text-center text-app-textMuted text-xs">
          No wholesaler bids submitted yet. Local wholesalers have been notified.
        </div>
      {:else}
        <div class="space-y-3 overflow-y-auto pr-1 flex-1">
          {#each requestBids as bid (bid._id)}
            {@const isPartialOffer = (bid.quantity < (selectedRequest.remainingQuantity || selectedRequest.quantity))}
            <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle space-y-3">
              <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="text-sm font-bold text-app-text">{bid.wholesalerProfile?.companyName || 'Wholesaler Supplier'}</span>
                    
                    <!-- Supplier Scorecard Button (Feature 3) -->
                    <button
                      type="button"
                      onclick={() => scorecardWholesalerId = bid.wholesaler}
                      class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold hover:bg-emerald-500/20 transition flex items-center gap-1"
                      title="Inspect supplier delivery & fulfillment scorecard"
                    >
                      <ShieldCheck class="h-3 w-3" />
                      <span>Supplier Scorecard</span>
                    </button>
                  </div>

                  <p class="text-xs text-app-textMuted mt-0.5">
                    ETA: <strong>{bid.deliveryTime}</strong> • Offered: <strong>{bid.quantity} {selectedRequest.unit}</strong>
                  </p>
                </div>

                <div class="text-right">
                  <div class="text-base font-extrabold text-brand-orange">₹{bid.price} / {selectedRequest.unit}</div>
                  <div class="text-[11px] text-app-textMuted">
                    Total: ₹{(bid.price * bid.quantity).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <!-- Multi-Product item quotation breakdown (Feature 6) -->
              {#if bid.items && bid.items.length > 0}
                <div class="border-t border-app-border/60 pt-2 space-y-1.5">
                  <span class="text-[10px] font-bold text-app-textMuted uppercase tracking-wider block">Item Breakdown</span>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {#each bid.items as itm}
                      <div class="p-2 bg-app-card rounded-lg border border-app-border flex items-center justify-between">
                        <div>
                          <span class="font-bold text-app-text block">{itm.productName}</span>
                          <span class="text-[11px] text-app-textMuted">Offered: {itm.offeredQuantity} / Req: {itm.requestedQuantity}</span>
                        </div>
                        <span class="font-bold text-brand-orange">₹{itm.price}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if bid.remarks}
                <p class="text-[11px] text-app-textMuted italic">"{bid.remarks}"</p>
              {/if}

              <!-- Acceptance Action (Feature 5 & 8 Partial Fulfillment) -->
              <div class="flex justify-end pt-2 border-t border-app-border/40">
                {#if selectedRequest.status !== 'accepted' && bid.status !== 'accepted'}
                  <button 
                    onclick={() => handleAcceptBid(bid._id, isPartialOffer, bid.quantity)}
                    class="px-4 py-2 text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5
                      {isPartialOffer 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-brand-orange hover:bg-brand-orangeHover text-white'}"
                  >
                    {#if isPartialOffer}
                      <span>Accept Partial ({bid.quantity} {selectedRequest.unit})</span>
                    {:else}
                      <span>Accept Complete Quote</span>
                    {/if}
                  </button>
                {:else if bid.status === 'accepted'}
                  <span class="text-xs font-bold text-emerald-600 px-3 py-1 bg-emerald-500/10 rounded-full flex items-center gap-1">
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    <span>Accepted Quote</span>
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
  <DeliveryTrackingModal 
    orderId={trackingOrderId}
    onClose={() => trackingOrderId = null}
  />
{/if}

{#if scorecardWholesalerId}
  <SupplierScorecardModal
    wholesalerId={scorecardWholesalerId}
    onClose={() => scorecardWholesalerId = null}
  />
{/if}

{#if priceHistoryProduct}
  <PriceHistoryModal
    productName={priceHistoryProduct}
    requestId={priceHistoryReqId}
    onClose={() => {
      priceHistoryProduct = null;
      priceHistoryReqId = null;
    }}
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
        <button 
          onclick={() => showConfirmModal = false}
          class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-textMuted hover:text-app-text"
        >
          Cancel
        </button>
        <button 
          onclick={confirmCallback}
          class="flex-1 py-2.5 text-xs font-bold bg-brand-orange hover:bg-brand-orangeHover text-white rounded-xl shadow-xs"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}
