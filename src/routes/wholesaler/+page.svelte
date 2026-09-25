<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { api } from '$lib/api.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { toasts } from '$lib/toasts.svelte.js';

  // Active Tab: 'requests' | 'orders' | 'inventory'
  let activeTab = $state('requests');
  let dashboardLoading = $state(true);

  // Data States
  let incomingRequests = $state([]);
  let myBids = $state([]);
  let orders = $state([]);
  let inventory = $state([]);
  let ordersLoading = $state(false);
  let inventoryLoading = $state(false);

  // Filters for Request Feed
  let searchFeedQuery = $state('');
  let categoryFilter = $state('');
  let urgencyFilter = $state('');

  // Stats
  let stats = $state({ pending: 0, responded: 0, accepted: 0, stockItems: 0 });

  // Derived KPI Calculations from real database models
  let openRequestsCount = $derived(incomingRequests.length);

  let ordersToFulfillCount = $derived(
    orders.filter(o => o.status === 'accepted' || o.status === 'processing').length
  );

  let ordersInTransitCount = $derived(
    orders.filter(o => o.status === 'shipped').length
  );

  let monthlyRevenue = $derived(() => {
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

  // Low stock inventory warnings
  let lowStockInventory = $derived(
    inventory.filter(i => i.stockQuantity !== undefined && i.stockQuantity <= (i.minStockThreshold || 10))
  );

  // Filtered Incoming Requests
  let filteredRequests = $derived(
    incomingRequests.filter(r => {
      const matchSearch = !searchFeedQuery || r.productName.toLowerCase().includes(searchFeedQuery.toLowerCase()) || (r.brand && r.brand.toLowerCase().includes(searchFeedQuery.toLowerCase()));
      const matchCategory = !categoryFilter || r.category === categoryFilter;
      const matchUrgency = !urgencyFilter || r.urgency === urgencyFilter;
      return matchSearch && matchCategory && matchUrgency;
    })
  );

  // Response Form Modal State
  let selectedRequest = $state(null);
  let showFormModal = $state(false);
  let formAvailability = $state('available');
  let formQuantity = $state(0);
  let formPrice = $state(0);
  let formDeliveryTime = $state('24 hours');
  let formRemarks = $state('');
  let formError = $state('');
  let formLoading = $state(false);

  // Add Inventory Form Modal State
  let showAddInvModal = $state(false);
  let invProdName = $state('');
  let invCategory = $state('');
  let invBrand = $state('');
  let invUnit = $state('kg');
  let invStockQty = $state(100);
  let invPrice = $state(0);
  let invMinThreshold = $state(10);
  let invFormError = $state('');
  let invFormLoading = $state(false);

  // Order Status Update State
  let selectedOrder = $state(null);
  let showOrderStatusModal = $state(false);
  let nextStatusChoice = $state('');
  let statusNotes = $state('');
  let updateLoading = $state(false);

  // Custom Confirmation Modal
  let showConfirmModal = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state(null);

  function triggerConfirm(message, callback) {
    confirmMessage = message;
    confirmCallback = () => {
      callback();
      showConfirmModal = false;
    };
    showConfirmModal = true;
  }

  // Load Wholesaler Dashboard Requests
  async function loadDashboardData(quiet = false) {
    if (!auth.token) return;
    if (!quiet) dashboardLoading = true;
    try {
      const reqRes = await api.get('/requests?limit=10000');
      const allRequests = reqRes.requests || [];

      const bidsList = [];
      const incomingList = [];

      for (let reqObj of allRequests) {
        const respRes = await api.get(`/responses/request/${reqObj._id}`);
        const respList = respRes.responses || [];
        const myBid = respList.find(r => r.wholesaler && r.wholesaler.toString() === auth.user._id.toString());

        if (myBid) {
          bidsList.push({ ...reqObj, myBid });
        } else if (reqObj.status !== 'accepted' && reqObj.status !== 'rejected') {
          incomingList.push(reqObj);
        }
      }

      incomingRequests = incomingList;
      myBids = bidsList;

      stats.pending = incomingList.length;
      stats.responded = bidsList.length;
      stats.accepted = bidsList.filter(b => b.myBid.status === 'accepted').length;

    } catch (err) {
      console.error('Failed to load wholesaler data:', err);
      toasts.error('Error fetching requests');
    } finally {
      dashboardLoading = false;
    }
  }

  async function loadOrders() {
    ordersLoading = true;
    try {
      const res = await api.get('/orders');
      orders = res.orders || [];
    } catch (err) {
      console.error('Failed to fetch wholesaler orders:', err);
    } finally {
      ordersLoading = false;
    }
  }

  async function loadInventory() {
    inventoryLoading = true;
    try {
      const res = await api.get('/inventory');
      inventory = res.inventory || [];
      stats.stockItems = inventory.length;
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      inventoryLoading = false;
    }
  }

  function openResponseForm(reqObj) {
    selectedRequest = reqObj;
    formQuantity = reqObj.quantity;
    formPrice = 0;
    formAvailability = 'available';
    formDeliveryTime = '24 hours';
    formRemarks = '';
    formError = '';
    showFormModal = true;
  }

  async function submitBid() {
    formError = '';
    if (formPrice <= 0) {
      formError = 'Unit price must be greater than zero.';
      return;
    }

    formLoading = true;
    try {
      await api.post(`/responses/request/${selectedRequest._id}`, {
        availability: formAvailability,
        quantity: Number(formQuantity),
        price: Number(formPrice),
        deliveryTime: formDeliveryTime,
        remarks: formRemarks
      });

      toasts.success('Quotation submitted successfully!');
      showFormModal = false;
      loadDashboardData(true);
    } catch (err) {
      formError = err.message || 'Failed to submit quote';
      toasts.error(formError);
    } finally {
      formLoading = false;
    }
  }

  async function handleAddInventory(e) {
    e.preventDefault();
    invFormError = '';
    if (!invProdName || !invCategory || invPrice <= 0 || invStockQty < 0) {
      invFormError = 'Please provide product name, category, price, and valid stock quantity.';
      return;
    }

    invFormLoading = true;
    try {
      await api.post('/inventory', {
        productName: invProdName,
        category: invCategory,
        brand: invBrand,
        unit: invUnit,
        stockQuantity: Number(invStockQty),
        unitPrice: Number(invPrice),
        minStockThreshold: Number(invMinThreshold)
      });

      toasts.success('Inventory item added successfully!');
      showAddInvModal = false;
      invProdName = '';
      invCategory = '';
      invBrand = '';
      invPrice = 0;
      invStockQty = 100;

      loadInventory();
    } catch (err) {
      invFormError = err.message || 'Failed to add inventory item';
      toasts.error(invFormError);
    } finally {
      invFormLoading = false;
    }
  }

  function openOrderStatusModal(ord) {
    selectedOrder = ord;
    nextStatusChoice = ord.status === 'accepted' ? 'processing' : ord.status === 'processing' ? 'shipped' : 'delivered';
    statusNotes = '';
    showOrderStatusModal = true;
  }

  async function handleUpdateOrderStatus() {
    if (!selectedOrder || !nextStatusChoice) return;
    updateLoading = true;
    try {
      await api.put(`/orders/${selectedOrder._id}/status`, {
        status: nextStatusChoice,
        notes: statusNotes
      });

      toasts.success(`Order status updated to ${nextStatusChoice.toUpperCase()}!`);
      showOrderStatusModal = false;
      loadOrders();
      loadInventory();
    } catch (err) {
      toasts.error(err.message || 'Failed to update order status');
    } finally {
      updateLoading = false;
    }
  }

  async function handleDeleteInv(invId) {
    triggerConfirm('Are you sure you want to remove this item from your inventory catalog?', async () => {
      try {
        await api.delete(`/inventory/${invId}`);
        toasts.success('Inventory item removed');
        loadInventory();
      } catch (err) {
        toasts.error(err.message || 'Failed to remove item');
      }
    });
  }

  onMount(() => {
    if (!auth.token) {
      goto('/auth');
      return;
    }
    if (auth.user && auth.user.role !== 'wholesaler') {
      goto('/unauthorized');
      return;
    }

    loadDashboardData();
    loadOrders();
    loadInventory();
  });
</script>

<div class="min-h-screen bg-app-bg text-app-text p-4 sm:p-6 lg:p-8 transition-colors duration-200 animate-page-fade">
  <div class="max-w-7xl mx-auto space-y-6">
    
    <!-- 1. Header Bar -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm">
      <div>
        <div class="flex items-center space-x-2 text-xs font-bold text-brand-orange uppercase tracking-wider">
          <span>Wholesale Distributor Operations</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-1">
          Wholesaler Dashboard
        </h1>
        <p class="text-xs text-app-muted mt-1">
          Monitor open market demand, submit instant price bids, and fulfill retailer stock orders.
        </p>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex bg-app-cardSubtle p-1.5 rounded-2xl border border-app-border">
        <button 
          onclick={() => activeTab = 'requests'}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'requests' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          📋 Open Demand Radar ({incomingRequests.length})
        </button>
        <button 
          onclick={() => { activeTab = 'orders'; loadOrders(); }}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'orders' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          🚚 Fulfillment Orders ({orders.length})
        </button>
        <button 
          onclick={() => { activeTab = 'inventory'; loadInventory(); }}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'inventory' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          🏭 Warehouse Inventory ({inventory.length})
        </button>
      </div>
    </div>

    <!-- 2. Critical Operational Alerts Banner -->
    {#if lowStockInventory.length > 0}
      <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div class="flex items-center space-x-3">
          <span class="text-xl">🏭</span>
          <div>
            <h4 class="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">Warehouse Inventory Warning</h4>
            <p class="text-xs text-rose-800 dark:text-rose-400">
              {lowStockInventory.length} product SKU(s) in your catalog are running low or out of stock.
            </p>
          </div>
        </div>
        <button 
          onclick={() => { activeTab = 'inventory'; showAddInvModal = true; }}
          class="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition whitespace-nowrap"
        >
          Update Catalog Stock
        </button>
      </div>
    {/if}

    <!-- 3. Real 4 KPI Cards Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- KPI 1: Open Market Requests -->
      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-amber-500 uppercase tracking-wider">Open Demand Requests</span>
        <div class="text-3xl font-extrabold font-heading text-amber-500 mt-2">{openRequestsCount}</div>
        <span class="text-[10px] text-app-muted mt-1 block">Retailer restock postings</span>
      </div>

      <!-- KPI 2: Orders to Fulfill -->
      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-brand-orange uppercase tracking-wider">Orders to Fulfill</span>
        <div class="text-3xl font-extrabold font-heading text-brand-orange mt-2">{ordersToFulfillCount}</div>
        <span class="text-[10px] text-app-muted mt-1 block">Accepted & processing</span>
      </div>

      <!-- KPI 3: Orders in Transit -->
      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-purple-500 uppercase tracking-wider">Orders in Transit</span>
        <div class="text-3xl font-extrabold font-heading text-purple-500 mt-2">{ordersInTransitCount}</div>
        <span class="text-[10px] text-app-muted mt-1 block">Dispatched shipments</span>
      </div>

      <!-- KPI 4: Monthly Revenue (Real calculated sum) -->
      <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
        <span class="text-xs font-bold text-app-muted uppercase tracking-wider">Monthly Revenue</span>
        <div class="text-3xl font-extrabold font-heading text-app-text mt-2">
          ₹{monthlyRevenue().toLocaleString()}
        </div>
        <span class="text-[10px] text-app-muted mt-1 block">Current month orders</span>
      </div>
    </div>

    <!-- 4. Quick Action Strip -->
    <div class="flex flex-wrap items-center gap-3 bg-app-card p-4 rounded-2xl border border-app-border shadow-sm">
      <span class="text-xs font-bold text-app-muted uppercase tracking-wider mr-2">Quick Actions:</span>
      <button 
        onclick={() => { activeTab = 'inventory'; showAddInvModal = true; }}
        class="px-4 py-2 text-xs font-bold bg-brand-orange text-white rounded-xl shadow-xs hover:bg-brand-orange/90 transition hover-lift"
      >
        + Add Inventory Stock
      </button>
      <button 
        onclick={() => activeTab = 'requests'}
        class="px-4 py-2 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text rounded-xl hover:bg-app-border/40 transition hover-lift"
      >
        📋 Review Market Demand
      </button>
      <button 
        onclick={() => { activeTab = 'orders'; loadOrders(); }}
        class="px-4 py-2 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text rounded-xl hover:bg-app-border/40 transition hover-lift"
      >
        🚚 Manage Dispatches
      </button>
    </div>

    {#if activeTab === 'requests'}
      <!-- 5. Open Retailer Request Feed Panel -->
      <div class="space-y-4">
        <!-- Search & Filter Bar -->
        <div class="bg-app-card p-4 rounded-2xl border border-app-border shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div class="relative flex-1 min-w-[200px]">
            <input 
              type="text" 
              bind:value={searchFeedQuery}
              placeholder="Search demand feed by product or brand..."
              class="w-full pl-9 pr-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
            />
            <span class="absolute left-3 top-2.5 text-app-muted text-xs">🔍</span>
          </div>

          <div class="flex items-center space-x-2">
            <select 
              bind:value={urgencyFilter}
              class="px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none"
            >
              <option value="">All Urgencies</option>
              <option value="high">High Urgency</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {#if dashboardLoading}
          <div class="space-y-4">
            {#each Array(4) as _}
              <div class="h-28 bg-app-card rounded-2xl border border-app-border animate-shimmer"></div>
            {/each}
          </div>
        {:else if filteredRequests.length === 0}
          <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-3">
            <div class="text-4xl">📋</div>
            <h3 class="text-base font-bold text-app-text">No Open Requests Match Filters</h3>
            <p class="text-xs text-app-muted max-w-sm mx-auto">
              No new retailer stock requests are open for bidding right now. Check back soon!
            </p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each filteredRequests as reqItem (reqItem._id)}
              <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift flex flex-col justify-between space-y-4 transition-all">
                <div class="space-y-2">
                  <div class="flex justify-between items-start">
                    <div>
                      <h3 class="text-base font-bold text-app-text">{reqItem.productName}</h3>
                      <span class="text-xs text-app-muted">Category: {reqItem.category}</span>
                    </div>
                    <span class="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase
                      {reqItem.urgency === 'high' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}"
                    >
                      {reqItem.urgency} Urgency
                    </span>
                  </div>

                  <div class="p-3 bg-app-cardSubtle rounded-xl text-xs space-y-1">
                    <div class="flex justify-between">
                      <span class="text-app-muted">Required Quantity:</span>
                      <strong class="text-brand-orange">{reqItem.quantity} {reqItem.unit}</strong>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-app-muted">Target Delivery Date:</span>
                      <strong>{new Date(reqItem.preferredDeliveryDate).toLocaleDateString()}</strong>
                    </div>
                    {#if reqItem.remarks}
                      <div class="text-[11px] text-app-muted italic border-t border-app-border/50 pt-1 mt-1">
                        "{reqItem.remarks}"
                      </div>
                    {/if}
                  </div>
                </div>

                <button 
                  onclick={() => openResponseForm(reqItem)}
                  class="w-full py-2.5 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs transition hover-lift flex justify-center items-center space-x-1.5"
                >
                  <span>Submit Price Quote</span>
                  <span>→</span>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'orders'}
      <!-- 6. Orders Requiring Fulfillment Panel -->
      <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
        <h2 class="text-xl font-bold font-heading text-app-text border-b border-app-border pb-3">
          Orders Requiring Fulfillment ({orders.length})
        </h2>

        {#if ordersLoading}
          <div class="space-y-4">
            {#each Array(3) as _}
              <div class="h-24 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
            {/each}
          </div>
        {:else if orders.length === 0}
          <div class="text-center py-12 text-app-muted space-y-2">
            <div class="text-4xl">🚚</div>
            <h3 class="text-sm font-bold text-app-text">No active orders to fulfill</h3>
            <p class="text-xs max-w-sm mx-auto">When retailers accept your quotation, orders will appear here for packing, dispatch, and delivery updates.</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each orders as ord (ord._id)}
              <div class="p-5 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
                <div class="space-y-1.5">
                  <div class="flex items-center space-x-3">
                    <span class="text-xs font-mono font-bold text-app-muted">#{ord._id.slice(-6)}</span>
                    <span class="text-base font-bold text-app-text">{ord.productName}</span>
                    <span class="text-xs font-bold text-brand-orange">Total: ₹{ord.totalAmount}</span>
                  </div>
                  <div class="text-xs text-app-muted space-x-4">
                    <span>Qty: <strong>{ord.quantity} {ord.unit}</strong> (@ ₹{ord.unitPrice}/{ord.unit})</span>
                    <span>Retailer Store: <strong>{ord.retailerProfile?.storeName || 'Retailer Store'}</strong></span>
                  </div>
                </div>

                <div class="flex items-center space-x-3">
                  <span class="text-xs font-bold px-3 py-1 rounded-full uppercase
                    {ord.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-500' :
                     ord.status === 'shipped' ? 'bg-purple-500/20 text-purple-500' :
                     ord.status === 'processing' ? 'bg-blue-500/20 text-blue-500' : 'bg-amber-500/20 text-amber-500'}"
                  >
                    {ord.status}
                  </span>

                  {#if ord.status !== 'delivered' && ord.status !== 'cancelled'}
                    <button 
                      onclick={() => openOrderStatusModal(ord)}
                      class="px-4 py-2 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs transition"
                    >
                      Update Status →
                    </button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'inventory'}
      <!-- 7. Inventory Health Monitor Panel -->
      <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
        <div class="flex justify-between items-center border-b border-app-border pb-4">
          <div>
            <h2 class="text-xl font-bold font-heading text-app-text">Warehouse Stock Inventory Health</h2>
            <p class="text-xs text-app-muted">Monitor stock levels and unit pricing for local retailers</p>
          </div>
          <button 
            onclick={() => showAddInvModal = true}
            class="px-4 py-2.5 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-md transition hover-lift"
          >
            + Add Stock Item
          </button>
        </div>

        {#if inventoryLoading}
          <div class="space-y-3">
            {#each Array(4) as _}
              <div class="h-16 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
            {/each}
          </div>
        {:else if inventory.length === 0}
          <div class="text-center py-12 text-app-muted space-y-2">
            <div class="text-4xl">🏭</div>
            <h3 class="text-sm font-bold text-app-text">No data available yet</h3>
            <p class="text-xs max-w-sm mx-auto">Add your warehouse inventory products to showcase stock availability to local retailers.</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each inventory as inv (inv._id)}
              <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col justify-between space-y-3 transition-all">
                <div class="flex justify-between items-start">
                  <div>
                    <h4 class="text-sm font-bold text-app-text">{inv.productName}</h4>
                    <span class="text-[11px] text-app-muted">{inv.category} {inv.brand ? `• ${inv.brand}` : ''}</span>
                  </div>
                  <button 
                    onclick={() => handleDeleteInv(inv._id)}
                    class="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg text-xs"
                    title="Remove item"
                  >
                    🗑️
                  </button>
                </div>

                <div class="p-3 bg-app-card rounded-xl text-xs space-y-1 border border-app-border">
                  <div class="flex justify-between">
                    <span class="text-app-muted">In Stock:</span>
                    <strong class={inv.stockQuantity <= (inv.minStockThreshold || 10) ? 'text-rose-500 font-extrabold' : 'text-emerald-500'}>
                      {inv.stockQuantity} {inv.unit}
                    </strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-app-muted">Wholesale Price:</span>
                    <strong class="text-brand-orange">₹{inv.unitPrice} / {inv.unit}</strong>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

  </div>
</div>

<!-- Submit Quotation Modal -->
{#if showFormModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-lg rounded-3xl border border-app-border shadow-2xl p-6 space-y-5 animate-toast">
      <div class="flex justify-between items-center border-b border-app-border pb-3">
        <h3 class="text-lg font-bold font-heading text-app-text">Submit Quotation Quote</h3>
        <button onclick={() => showFormModal = false} class="text-app-muted hover:text-app-text text-lg">✕</button>
      </div>

      {#if formError}
        <div class="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl font-semibold border border-rose-200">
          {formError}
        </div>
      {/if}

      <div class="space-y-4 text-xs">
        <div>
          <span class="text-app-muted block">Requesting Product:</span>
          <strong class="text-sm font-bold text-app-text">{selectedRequest?.productName} ({selectedRequest?.quantity} {selectedRequest?.unit})</strong>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="form-price" class="block font-bold text-app-text uppercase mb-1">Offered Unit Price (₹) *</label>
            <input 
              id="form-price"
              type="number" 
              bind:value={formPrice}
              min="0"
              step="0.5"
              placeholder="e.g. 45"
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
            />
          </div>

          <div>
            <label for="form-quantity" class="block font-bold text-app-text uppercase mb-1">Offered Quantity *</label>
            <input 
              id="form-quantity"
              type="number" 
              bind:value={formQuantity}
              min="1"
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label for="form-delivery-time" class="block font-bold text-app-text uppercase mb-1">Lead Time / Delivery Schedule</label>
          <input 
            id="form-delivery-time"
            type="text" 
            bind:value={formDeliveryTime}
            placeholder="Same day / 24 hours"
            class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
          />
        </div>

        <div>
          <label for="form-remarks" class="block font-bold text-app-muted uppercase mb-1">Remarks / Offer Details</label>
          <textarea 
            id="form-remarks"
            bind:value={formRemarks}
            rows="2"
            placeholder="Free doorstep delivery on bulk order..."
            class="w-full px-3.5 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
          ></textarea>
        </div>

        <div class="flex space-x-3 pt-2">
          <button 
            onclick={() => showFormModal = false}
            class="flex-1 py-3 text-xs font-bold border border-app-border rounded-xl text-app-muted hover:text-app-text"
          >
            Cancel
          </button>
          <button 
            onclick={submitBid}
            disabled={formLoading}
            class="flex-1 py-3 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-md"
          >
            {formLoading ? 'Submitting...' : 'Submit Quote'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Add Inventory Item Modal -->
{#if showAddInvModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-lg rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <div class="flex justify-between items-center border-b border-app-border pb-3">
        <h3 class="text-lg font-bold font-heading text-app-text">Add Inventory Stock Item</h3>
        <button onclick={() => showAddInvModal = false} class="text-app-muted hover:text-app-text text-lg">✕</button>
      </div>

      <form onsubmit={handleAddInventory} class="space-y-4 text-xs">
        {#if invFormError}
          <div class="p-3 text-xs bg-rose-50 text-rose-600 rounded-xl font-semibold border border-rose-200">
            {invFormError}
          </div>
        {/if}

        <div>
          <label for="inv-prod-name" class="block font-bold text-app-text uppercase mb-1">Product Name *</label>
          <input 
            id="inv-prod-name"
            type="text" 
            bind:value={invProdName}
            placeholder="Whole Wheat Atta"
            class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
            required
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="inv-category" class="block font-bold text-app-text uppercase mb-1">Category *</label>
            <input 
              id="inv-category"
              type="text" 
              bind:value={invCategory}
              placeholder="Flour & Grains"
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
              required
            />
          </div>
          <div>
            <label for="inv-brand" class="block font-bold text-app-muted uppercase mb-1">Brand</label>
            <input 
              id="inv-brand"
              type="text" 
              bind:value={invBrand}
              placeholder="Aashirvaad"
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label for="inv-unit" class="block font-bold text-app-text uppercase mb-1">Unit *</label>
            <input 
              id="inv-unit"
              type="text" 
              bind:value={invUnit}
              placeholder="kg"
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
              required
            />
          </div>
          <div>
            <label for="inv-stock-qty" class="block font-bold text-app-text uppercase mb-1">Stock Qty *</label>
            <input 
              id="inv-stock-qty"
              type="number" 
              bind:value={invStockQty}
              min="0"
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
              required
            />
          </div>
          <div>
            <label for="inv-price" class="block font-bold text-app-text uppercase mb-1">Price (₹) *</label>
            <input 
              id="inv-price"
              type="number" 
              bind:value={invPrice}
              min="0"
              step="0.5"
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
              required
            />
          </div>
        </div>

        <div class="flex space-x-3 pt-2">
          <button 
            type="button"
            onclick={() => showAddInvModal = false}
            class="flex-1 py-3 text-xs font-bold border border-app-border rounded-xl text-app-muted hover:text-app-text"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={invFormLoading}
            class="flex-1 py-3 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-md"
          >
            {invFormLoading ? 'Adding...' : 'Save Stock'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Update Order Fulfillment Status Modal -->
{#if showOrderStatusModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-sm rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <h3 class="text-base font-bold font-heading text-app-text">Update Order Fulfillment Status</h3>
      <p class="text-xs text-app-muted">Order: {selectedOrder?.productName} ({selectedOrder?.quantity} {selectedOrder?.unit})</p>

      <div class="space-y-3 text-xs">
        <div>
          <label for="next-status-choice" class="block font-bold text-app-text mb-1">Next Status Pipeline Step:</label>
          <select 
            id="next-status-choice"
            bind:value={nextStatusChoice}
            class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs font-bold text-brand-orange uppercase"
          >
            <option value="processing">PROCESSING</option>
            <option value="shipped">SHIPPED (In-Transit)</option>
            <option value="delivered">DELIVERED (Fulfilled)</option>
          </select>
        </div>

        <div>
          <label for="status-notes" class="block font-bold text-app-muted mb-1">Notes / Tracking Info</label>
          <input 
            id="status-notes"
            type="text" 
            bind:value={statusNotes}
            placeholder="Driver dispatched / tracking #1882..."
            class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text"
          />
        </div>

        <div class="flex space-x-3 pt-2">
          <button 
            onclick={() => showOrderStatusModal = false}
            class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-muted"
          >
            Cancel
          </button>
          <button 
            onclick={handleUpdateOrderStatus}
            disabled={updateLoading}
            class="flex-1 py-2.5 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs"
          >
            {updateLoading ? 'Updating...' : 'Confirm Update'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Confirmation Modal -->
{#if showConfirmModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-sm rounded-3xl border border-app-border shadow-2xl p-6 text-center space-y-4 animate-toast">
      <div class="text-3xl">⚠️</div>
      <h3 class="text-base font-bold text-app-text">Confirm Action</h3>
      <p class="text-xs text-app-muted leading-relaxed">{confirmMessage}</p>
      <div class="flex space-x-3 pt-2">
        <button 
          onclick={() => showConfirmModal = false}
          class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-muted"
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
