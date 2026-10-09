<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { api } from '$lib/api.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import GroupBuyingSection from '$lib/components/GroupBuyingSection.svelte';
  import DeliveryTrackingModal from '$lib/components/DeliveryTrackingModal.svelte';
  import { 
    getMapLibre, 
    getEffectiveMapStyle, 
    createMapTransformRequest, 
    cleanOsmRasterStyle 
  } from '$lib/maplibre.js';
  import {
    LayoutDashboard,
    ShoppingCart,
    FileText,
    Warehouse,
    Truck,
    Layers,
    Coins,
    Award,
    MapPin,
    Settings,
    AlertTriangle,
    Plus,
    RefreshCw,
    Send,
    CheckCircle2,
    Clock,
    X,
    ChevronRight,
    TrendingUp,
    Store,
    ShieldCheck,
    Calendar,
    Package,
    Trash2,
    DollarSign
  } from 'lucide-svelte';

  // Active Tab: 'overview' | 'incoming' | 'quotations' | 'inventory' | 'orders' | 'groupbuy' | 'profitability' | 'performance' | 'location' | 'profile'
  let activeTab = $state('overview');
  let dashboardLoading = $state(false);

  // Wholesaler Business Location State
  let wholesalerProfile = $state(null);
  let locAddress = $state('');
  let locCity = $state('');
  let locState = $state('');
  let locPostalCode = $state('');
  let locLat = $state(12.9716);
  let locLng = $state(77.5946);
  let locRadius = $state(50);
  let locSaving = $state(false);
  let locLocating = $state(false);

  // Location search autocomplete
  let locSearchQuery = $state('');
  let locSearchResults = $state([]);
  let locSearching = $state(false);
  let showLocDropdown = $state(false);
  let locDebounceTimer = null;

  // Location Map container & instance
  let locMapContainer = $state(null);
  let locMapInstance = null;
  let locMapMarker = null;
  let locMapLoading = $state(false);
  let locMapError = $state(null);

  // Data States
  let orders = $state([]);
  let inventory = $state([]);
  let incomingRequests = $state([]);
  let myQuotations = $state([]);
  let profitabilityData = $state(null);
  let myPerformance = $state(null);

  // Loading States
  let ordersLoading = $state(false);
  let inventoryLoading = $state(false);
  let incomingLoading = $state(false);
  let quotationsLoading = $state(false);
  let profitabilityLoading = $state(false);
  let performanceLoading = $state(false);

  // Quotation Submission Modal State
  let selectedIncomingReq = $state(null);
  let showQuoteModal = $state(false);
  let quotePrice = $state(0);
  let quoteQuantity = $state(0);
  let quoteDeliveryTime = $state('24-48 hours');
  let quoteRemarks = $state('');
  let quoteLoading = $state(false);

  // Tracking Modal State
  let selectedTrackingOrder = $state(null);
  let showTrackingModal = $state(false);

  // Order Status Update State
  let selectedOrder = $state(null);
  let showOrderStatusModal = $state(false);
  let nextStatusChoice = $state('');
  let statusNotes = $state('');
  let availableStatusChoices = $state([]);
  let expectedDeliveryDateInput = $state('');
  let updateLoading = $state(false);

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

  // Confirmation Modal
  let showConfirmModal = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state(null);

  // Derived KPI Calculations
  let catalogCount = $derived(inventory.length);

  let ordersToFulfillCount = $derived(
    orders.filter(o => o.status === 'accepted' || o.status === 'processing').length
  );

  let ordersInTransitCount = $derived(
    orders.filter(o => o.status === 'shipped' || o.status === 'out_for_delivery').length
  );

  let monthlyRevenue = $derived(
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

  let lowStockInventory = $derived(
    inventory.filter(i => i.stockQuantity !== undefined && i.stockQuantity <= (i.minStockThreshold || 10))
  );

  let sidebarBadges = $derived({
    incomingRequests: incomingRequests.length,
    lowStock: lowStockInventory.length,
    activeOrders: ordersToFulfillCount + ordersInTransitCount,
  });

  function triggerConfirm(message, callback) {
    confirmMessage = message;
    confirmCallback = () => {
      callback();
      showConfirmModal = false;
    };
    showConfirmModal = true;
  }

  function handleTabChange(tab) {
    activeTab = tab;
    if (tab === 'incoming') loadIncomingRequests();
    if (tab === 'quotations') loadMyQuotations();
    if (tab === 'orders') loadOrders();
    if (tab === 'inventory') loadInventory();
    if (tab === 'profitability') loadProfitability();
    if (tab === 'performance') loadMyPerformance();
    if (tab === 'location') setTimeout(initLocationMap, 150);
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
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      inventoryLoading = false;
    }
  }

  async function loadIncomingRequests() {
    incomingLoading = true;
    try {
      const res = await api.get('/requests/wholesaler/incoming');
      incomingRequests = res.requests || [];
    } catch (err) {
      console.error('Failed to load incoming requests:', err);
    } finally {
      incomingLoading = false;
    }
  }

  async function loadMyQuotations() {
    quotationsLoading = true;
    try {
      const res = await api.get('/responses/my-quotations');
      myQuotations = res.quotations || [];
    } catch (err) {
      console.error('Failed to load submitted quotations:', err);
    } finally {
      quotationsLoading = false;
    }
  }

  async function loadProfitability() {
    profitabilityLoading = true;
    try {
      const res = await api.get('/analytics/wholesaler-profitability');
      if (res.success) {
        profitabilityData = res;
      }
    } catch (err) {
      console.error('Failed to load wholesaler profitability:', err);
    } finally {
      profitabilityLoading = false;
    }
  }

  async function loadMyPerformance() {
    performanceLoading = true;
    try {
      const res = await api.get('/wholesalers/my-performance');
      const card = res.scorecard || res.performance;
      myPerformance = card?.metrics ? { ...card, ...card.metrics } : (card || null);
    } catch (err) {
      console.warn('Failed to load performance scorecard:', err?.message || err);
      myPerformance = null;
    } finally {
      performanceLoading = false;
    }
  }

  function openQuotationModal(reqItem) {
    selectedIncomingReq = reqItem;
    quotePrice = 0;
    quoteQuantity = reqItem.remainingQuantity || reqItem.quantity;
    quoteDeliveryTime = '24-48 hours';
    quoteRemarks = '';
    showQuoteModal = true;
  }

  async function handleSubmitQuotation(e) {
    e.preventDefault();
    if (!selectedIncomingReq || quotePrice <= 0 || quoteQuantity <= 0) {
      toasts.error('Please enter a valid price and quantity.');
      return;
    }

    quoteLoading = true;
    try {
      await api.post(`/responses/${selectedIncomingReq._id}`, {
        price: Number(quotePrice),
        quantity: Number(quoteQuantity),
        deliveryTime: quoteDeliveryTime,
        remarks: quoteRemarks,
      });

      toasts.success('Quotation submitted successfully to retailer!');
      showQuoteModal = false;
      loadIncomingRequests();
      loadMyQuotations();
    } catch (err) {
      toasts.error(err.message || 'Failed to submit quotation');
    } finally {
      quoteLoading = false;
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
    const transitionMap = {
      accepted: ['processing'],
      processing: ['packed', 'shipped'],
      packed: ['shipped'],
      shipped: ['out_for_delivery', 'delivered'],
      out_for_delivery: ['delivered']
    };
    availableStatusChoices = transitionMap[ord.status] || [];
    nextStatusChoice = availableStatusChoices[0] || ord.status;
    statusNotes = '';
    expectedDeliveryDateInput = ord.expectedDeliveryDate ? new Date(ord.expectedDeliveryDate).toISOString().slice(0, 10) : '';
    showOrderStatusModal = true;
  }

  async function handleUpdateOrderStatus() {
    if (!selectedOrder || !nextStatusChoice) return;
    updateLoading = true;
    try {
      await api.put(`/orders/${selectedOrder._id}/status`, {
        status: nextStatusChoice,
        notes: statusNotes,
        expectedDeliveryDate: expectedDeliveryDateInput || undefined
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

  async function loadProfileLocation() {
    try {
      const res = await api.get('/auth/me');
      if (res && res.profile) {
        wholesalerProfile = res.profile;
        if (res.profile.address) locAddress = res.profile.address;
        if (res.profile.city) locCity = res.profile.city;
        if (res.profile.state) locState = res.profile.state;
        if (res.profile.postalCode) locPostalCode = res.profile.postalCode;
        if (res.profile.latitude !== undefined && res.profile.latitude !== null && res.profile.latitude !== '') {
          locLat = Number(res.profile.latitude);
        }
        if (res.profile.longitude !== undefined && res.profile.longitude !== null && res.profile.longitude !== '') {
          locLng = Number(res.profile.longitude);
        }
        if (res.profile.deliveryRadiusKm !== undefined) {
          locRadius = Number(res.profile.deliveryRadiusKm);
        }

        if (locMapInstance && browser) {
          locMapInstance.setCenter([locLng, locLat]);
          renderLocMarker();
        }
      }
    } catch (err) {
      console.warn('Failed to load profile location:', err);
    }
  }

  async function initLocationMap() {
    await new Promise(r => setTimeout(r, 100));
    if (!browser || !locMapContainer) return;

    if (locMapInstance) {
      locMapLoading = false;
      setTimeout(() => locMapInstance?.resize(), 50);
      return;
    }

    locMapLoading = true;
    locMapError = null;
    try {
      const maplibregl = await getMapLibre();
      const mapStyle = getEffectiveMapStyle();
      const transformRequest = createMapTransformRequest();

      locMapInstance = new maplibregl.Map({
        container: locMapContainer,
        style: mapStyle,
        center: [locLng, locLat],
        zoom: 14,
        attributionControl: false,
        transformRequest,
      });

      locMapInstance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

      let isReady = false;
      const markLoaded = () => {
        if (isReady) return;
        isReady = true;
        locMapLoading = false;
        locMapError = null;
        renderLocMarker(maplibregl);
        setTimeout(() => locMapInstance?.resize(), 50);
      };

      locMapInstance.once('load', markLoaded);
      locMapInstance.once('style.load', markLoaded);
      locMapInstance.once('idle', markLoaded);
      setTimeout(markLoaded, 600);

      locMapInstance.on('error', (e) => {
        console.warn('MapLibre runtime error:', e);
        if (locMapInstance?.setStyle) {
          try {
            locMapInstance.setStyle(cleanOsmRasterStyle);
          } catch {
            // Keep style
          }
        }
      });

      locMapInstance.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        locLng = Number(lng.toFixed(6));
        locLat = Number(lat.toFixed(6));
        renderLocMarker(maplibregl);
        reverseGeocodeCoords(locLat, locLng);
      });
    } catch (err) {
      console.error('Location map failed to load:', err);
      locMapError = err.message || 'Map failed to load';
      locMapLoading = false;
    }
  }

  async function renderLocMarker(maplibregl) {
    if (!locMapInstance || !browser) return;
    if (locMapMarker) locMapMarker.remove();

    const mgl = maplibregl || (await getMapLibre());

    const el = document.createElement('div');
    el.className = 'cursor-pointer';
    el.innerHTML = `
      <div style="background-color: #D4A72C; color: #202124; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    `;

    locMapMarker = new mgl.Marker({ element: el, draggable: true })
      .setLngLat([locLng, locLat])
      .addTo(locMapInstance);

    locMapMarker.on('dragend', () => {
      const lngLat = locMapMarker.getLngLat();
      locLng = Number(lngLat.lng.toFixed(6));
      locLat = Number(lngLat.lat.toFixed(6));
      reverseGeocodeCoords(locLat, locLng);
    });
  }

  async function reverseGeocodeCoords(lat, lng) {
    try {
      const res = await api.get(`/location/reverse?lat=${lat}&lng=${lng}`);
      if (res.success && res.data) {
        if (res.data.formattedAddress) locAddress = res.data.formattedAddress;
        if (res.data.city) locCity = res.data.city;
        if (res.data.state) locState = res.data.state;
        if (res.data.postalCode) locPostalCode = res.data.postalCode;
        toasts.info(`Address updated: ${res.data.city || res.data.formattedAddress}`);
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    }
  }

  function handleLocSearchInput(e) {
    const val = e.target.value;
    locSearchQuery = val;
    if (locDebounceTimer) clearTimeout(locDebounceTimer);

    if (!val || val.trim().length < 2) {
      locSearchResults = [];
      showLocDropdown = false;
      return;
    }

    locDebounceTimer = setTimeout(async () => {
      locSearching = true;
      try {
        const res = await api.get(`/location/search?q=${encodeURIComponent(val.trim())}`);
        if (res.success && Array.isArray(res.data)) {
          locSearchResults = res.data;
          showLocDropdown = res.data.length > 0;
        } else {
          locSearchResults = [];
          showLocDropdown = false;
        }
      } catch (err) {
        console.error('Loc search error:', err);
      } finally {
        locSearching = false;
      }
    }, 350);
  }

  async function selectLocPlace(place) {
    locLat = Number(place.latitude);
    locLng = Number(place.longitude);
    locAddress = place.formattedAddress || place.name;
    if (place.city) locCity = place.city;
    if (place.state) locState = place.state;
    if (place.postalCode) locPostalCode = place.postalCode;
    locSearchQuery = place.name;
    showLocDropdown = false;
    locSearchResults = [];

    if (locMapInstance && browser) {
      locMapInstance.flyTo({ center: [locLng, locLat], zoom: 14, essential: true });
      const maplibregl = await getMapLibre();
      renderLocMarker(maplibregl);
    }
    toasts.success(`Selected: ${place.name}`);
  }

  function requestWholesalerDeviceLocation() {
    if (!navigator.geolocation) {
      toasts.error('Geolocation is not supported by your browser.');
      return;
    }

    locLocating = true;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        locLocating = false;
        locLat = Number(pos.coords.latitude.toFixed(6));
        locLng = Number(pos.coords.longitude.toFixed(6));

        if (locMapInstance && browser) {
          locMapInstance.flyTo({ center: [locLng, locLat], zoom: 14, essential: true });
          const maplibregl = await getMapLibre();
          renderLocMarker(maplibregl);
        }

        await reverseGeocodeCoords(locLat, locLng);
        toasts.success('Location updated from device GPS');
      },
      (err) => {
        locLocating = false;
        toasts.error('Unable to retrieve device GPS location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSaveLocation() {
    if (!locAddress || !locAddress.trim()) {
      toasts.error('Please provide a business address.');
      return;
    }

    locSaving = true;
    try {
      const res = await api.put('/auth/profile', {
        address: locAddress.trim(),
        city: locCity.trim(),
        state: locState.trim(),
        postalCode: locPostalCode.trim(),
        latitude: locLat,
        longitude: locLng,
        deliveryRadiusKm: locRadius,
      });

      if (res.success) {
        wholesalerProfile = res.profile;
        toasts.success('Warehouse business location saved successfully!');
      } else {
        toasts.error(res.message || 'Failed to save location');
      }
    } catch (err) {
      toasts.error(err.message || 'Failed to update business location');
    } finally {
      locSaving = false;
    }
  }

  $effect(() => {
    if (activeTab === 'location' && browser && locMapContainer) {
      if (!locMapInstance) {
        initLocationMap();
      } else {
        setTimeout(() => locMapInstance?.resize(), 100);
      }
    }
  });

  onMount(() => {
    if (!auth.token) {
      goto('/auth');
      return;
    }
    if (auth.user && auth.user.role !== 'wholesaler') {
      if (auth.user.role === 'retailer') {
        toasts.warning('Retailer accounts cannot access Wholesaler operations.');
        goto('/retailer');
      } else {
        goto('/unauthorized');
      }
      return;
    }

    loadOrders();
    loadInventory();
    loadIncomingRequests();
    loadProfileLocation();
  });

  onDestroy(() => {
    if (locDebounceTimer) clearTimeout(locDebounceTimer);
    if (locMapInstance) {
      locMapInstance.remove();
      locMapInstance = null;
    }
  });
</script>

<div class="min-h-screen bg-app-bg text-app-text flex">
  <!-- Wholesaler Navigation Sidebar -->
  <Sidebar
    role="wholesaler"
    activeTab={activeTab}
    onSelectTab={handleTabChange}
    badges={sidebarBadges}
  />

  <!-- Main Scrollable Content Area -->
  <div class="flex-1 overflow-y-auto max-h-screen p-4 sm:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto space-y-6">

      <!-- ===== OVERVIEW DASHBOARD ===== -->
      {#if activeTab === 'overview'}
        <div class="space-y-6">
          <!-- Header Banner -->
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm">
            <div>
              <div class="flex items-center space-x-2 text-xs font-bold text-[#D4A72C] uppercase tracking-wider">
                <span>Distribution Logistics Center</span>
              </div>
              <h1 class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-1">
                Wholesaler Dashboard
              </h1>
              <p class="text-xs text-app-textMuted mt-1">
                Fulfill retailer procurement requests, monitor warehouse stock depletion, and track delivery logistics.
              </p>
            </div>
            <div class="flex items-center gap-2">
              {#if wholesalerProfile?.businessVerification?.status === 'approved'}
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck class="w-3.5 h-3.5" />
                  <span>Verified Supplier</span>
                </span>
              {:else}
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                  <Clock class="w-3.5 h-3.5" />
                  <span>Verification Pending</span>
                </span>
              {/if}
            </div>
          </div>

          <!-- Low Stock Warning Banner -->
          {#if lowStockInventory.length > 0}
            <div class="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div class="flex items-center space-x-3">
                <span class="text-xl">⚠️</span>
                <div>
                  <h4 class="text-xs font-bold text-rose-500 uppercase tracking-wider">Catalog Stock Notice</h4>
                  <p class="text-xs text-app-textMuted">
                    {lowStockInventory.length} product SKU(s) in your warehouse catalog are running low or depleted.
                  </p>
                </div>
              </div>
              <button 
                onclick={() => handleTabChange('inventory')}
                class="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition whitespace-nowrap"
              >
                Inspect Inventory
              </button>
            </div>
          {/if}

          <!-- KPI Cards Grid -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button onclick={() => handleTabChange('incoming')} class="text-left bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift transition">
              <span class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Incoming Requests</span>
              <div class="text-3xl font-extrabold font-heading text-[#D4A72C] mt-2">{incomingRequests.length}</div>
              <span class="text-[10px] text-app-textMuted mt-1 block">Retailers seeking quotes</span>
            </button>

            <button onclick={() => handleTabChange('orders')} class="text-left bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift transition">
              <span class="text-xs font-bold text-amber-500 uppercase tracking-wider">Orders to Fulfill</span>
              <div class="text-3xl font-extrabold font-heading text-amber-500 mt-2">{ordersToFulfillCount}</div>
              <span class="text-[10px] text-app-textMuted mt-1 block">Accepted & processing</span>
            </button>

            <button onclick={() => handleTabChange('orders')} class="text-left bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift transition">
              <span class="text-xs font-bold text-blue-500 uppercase tracking-wider">In Transit</span>
              <div class="text-3xl font-extrabold font-heading text-blue-500 mt-2">{ordersInTransitCount}</div>
              <span class="text-[10px] text-app-textMuted mt-1 block">Dispatched deliveries</span>
            </button>

            <button onclick={() => handleTabChange('profitability')} class="text-left bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift transition">
              <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider">Monthly Revenue</span>
              <div class="text-3xl font-extrabold font-heading text-app-text mt-2">
                ₹{monthlyRevenue.toLocaleString('en-IN')}
              </div>
              <span class="text-[10px] text-app-textMuted mt-1 block">Delivered & active orders</span>
            </button>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex flex-wrap items-center gap-3 bg-app-card p-4 rounded-2xl border border-app-border shadow-sm">
            <span class="text-xs font-bold text-app-textMuted uppercase tracking-wider mr-2">Quick Navigation:</span>
            <button 
              onclick={() => handleTabChange('incoming')}
              class="px-4 py-2 text-xs font-bold bg-[#D4A72C] text-[#202124] rounded-xl shadow-xs hover:bg-amber-600 transition hover-lift flex items-center gap-1.5"
            >
              <ShoppingCart class="w-3.5 h-3.5" />
              <span>Review Incoming Requests ({incomingRequests.length})</span>
            </button>
            <button 
              onclick={() => { showAddInvModal = true; }}
              class="px-4 py-2 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text rounded-xl hover:bg-app-border/40 transition hover-lift flex items-center gap-1.5"
            >
              <Plus class="w-3.5 h-3.5 text-[#D4A72C]" />
              <span>Add Stock Item</span>
            </button>
            <button 
              onclick={() => handleTabChange('orders')}
              class="px-4 py-2 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text rounded-xl hover:bg-app-border/40 transition hover-lift flex items-center gap-1.5"
            >
              <Truck class="w-3.5 h-3.5 text-blue-500" />
              <span>Manage Dispatches</span>
            </button>
            <button 
              onclick={() => handleTabChange('location')}
              class="px-4 py-2 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text rounded-xl hover:bg-app-border/40 transition hover-lift flex items-center gap-1.5"
            >
              <MapPin class="w-3.5 h-3.5 text-rose-500" />
              <span>Delivery Area & Radius</span>
            </button>
          </div>

          <!-- Recent Incoming Requests Preview -->
          <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
            <div class="flex items-center justify-between border-b border-app-border pb-3">
              <div>
                <h3 class="text-base font-bold font-heading text-app-text">Open Retailer Requests Nearby</h3>
                <p class="text-xs text-app-textMuted">Retailers currently requesting grocery stock in your delivery coverage</p>
              </div>
              <button onclick={() => handleTabChange('incoming')} class="text-xs font-bold text-[#D4A72C] hover:underline">
                View All ({incomingRequests.length}) →
              </button>
            </div>

            {#if incomingRequests.length === 0}
              <div class="text-center py-8 text-app-textMuted text-xs">
                No active procurement requests from local retailers at this moment. Check back soon.
              </div>
            {:else}
              <div class="space-y-3">
                {#each incomingRequests.slice(0, 3) as reqItem}
                  <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div class="space-y-1">
                      <div class="flex items-center space-x-2">
                        <span class="font-bold text-sm text-app-text">{reqItem.productName}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-[#D4A72C]/10 text-[#D4A72C] font-bold uppercase">{reqItem.category}</span>
                      </div>
                      <p class="text-xs text-app-textMuted">
                        Requested: <strong class="text-app-text">{reqItem.quantity} {reqItem.unit}</strong> • Needed by: {new Date(reqItem.preferredDeliveryDate).toLocaleDateString()}
                      </p>
                    </div>
                    <button 
                      onclick={() => openQuotationModal(reqItem)}
                      class="px-4 py-2 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl transition shadow-xs whitespace-nowrap"
                    >
                      Quote Price
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

      <!-- ===== INCOMING REQUESTS TAB ===== -->
      {:else if activeTab === 'incoming'}
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Procurement Opportunities</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Incoming Stock Requests</h1>
              <p class="text-xs text-app-textMuted mt-1">Browse open requests broadcasted by grocery retailers within your service radius.</p>
            </div>
            <button 
              onclick={loadIncomingRequests} 
              class="px-3.5 py-2 text-xs font-bold border border-app-border rounded-xl bg-app-card hover:bg-app-cardSubtle text-app-text flex items-center gap-1.5 transition"
            >
              <RefreshCw class="w-3.5 h-3.5 {incomingLoading ? 'animate-spin' : ''}" />
              <span>Refresh Feed</span>
            </button>
          </div>

          {#if incomingLoading}
            <div class="space-y-3">
              {#each [1, 2, 3] as _}
                <div class="h-28 bg-app-card rounded-2xl border border-app-border animate-shimmer"></div>
              {/each}
            </div>
          {:else if incomingRequests.length === 0}
            <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-3">
              <div class="text-4xl">🛒</div>
              <h3 class="text-base font-bold text-app-text">No Open Requests In Your Area</h3>
              <p class="text-xs text-app-textMuted max-w-sm mx-auto">
                No active stock requests match your delivery radius right now. Update your service radius in the Delivery Area tab if needed.
              </p>
            </div>
          {:else}
            <div class="space-y-3">
              {#each incomingRequests as reqItem (reqItem._id)}
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover-lift">
                  <div class="space-y-2 flex-1">
                    <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span class="text-base font-bold text-app-text">{reqItem.productName}</span>
                      {#if reqItem.brand}
                        <span class="text-[10px] px-2 py-0.5 rounded-md bg-app-cardSubtle text-app-textMuted font-bold">{reqItem.brand}</span>
                      {/if}
                      
                      <!-- Distance Badge -->
                      {#if reqItem.distanceKm !== null && reqItem.distanceKm !== undefined}
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold {reqItem.isWithinRadius ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}">
                          📍 {reqItem.distanceKm} km away {reqItem.isWithinRadius ? '(In Zone)' : '(Extended Zone)'}
                        </span>
                      {/if}

                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase
                        {reqItem.urgency === 'high' ? 'bg-rose-500/10 text-rose-600' : reqItem.urgency === 'medium' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'}"
                      >
                        {reqItem.urgency || 'Normal'} Priority
                      </span>
                    </div>

                    <div class="text-xs text-app-textMuted flex flex-wrap items-center gap-4">
                      <span>Quantity: <strong class="text-[#D4A72C]">{reqItem.remainingQuantity || reqItem.quantity} {reqItem.unit}</strong></span>
                      <span>Needed By: <strong>{new Date(reqItem.preferredDeliveryDate).toLocaleDateString()}</strong></span>
                      {#if reqItem.retailerProfile?.storeName}
                        <span>Store: <strong>{reqItem.retailerProfile.storeName}</strong> ({reqItem.retailerProfile.city || ''})</span>
                      {/if}
                    </div>

                    {#if reqItem.remarks}
                      <p class="text-[11px] text-app-textMuted italic">Note: "{reqItem.remarks}"</p>
                    {/if}
                  </div>

                  <!-- Action -->
                  <div class="flex items-center space-x-2 shrink-0">
                    <button 
                      onclick={() => openQuotationModal(reqItem)}
                      class="px-5 py-2.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <FileText class="w-3.5 h-3.5" />
                      <span>Submit Quotation</span>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ===== MY SUBMITTED BIDS TAB ===== -->
      {:else if activeTab === 'quotations'}
        <div class="space-y-6">
          <div class="flex justify-between items-center">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Quotations & Offers</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">My Submitted Bids</h1>
              <p class="text-xs text-app-textMuted mt-1">Track active quotations submitted to retailers and review buyer decisions.</p>
            </div>
            <button 
              onclick={loadMyQuotations}
              class="px-3.5 py-2 text-xs font-bold border border-app-border rounded-xl bg-app-card hover:bg-app-cardSubtle text-app-text flex items-center gap-1.5 transition"
            >
              <RefreshCw class="w-3.5 h-3.5 {quotationsLoading ? 'animate-spin' : ''}" />
              <span>Refresh</span>
            </button>
          </div>

          {#if quotationsLoading}
            <div class="space-y-3">
              {#each [1, 2, 3] as _}
                <div class="h-24 bg-app-card rounded-2xl border border-app-border animate-shimmer"></div>
              {/each}
            </div>
          {:else if myQuotations.length === 0}
            <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-3">
              <div class="text-4xl">📄</div>
              <h3 class="text-base font-bold text-app-text">No Quotations Submitted Yet</h3>
              <p class="text-xs text-app-textMuted max-w-sm mx-auto">
                Explore the Incoming Requests tab to find retailer demands and submit competitive wholesale pricing.
              </p>
            </div>
          {:else}
            <div class="space-y-3">
              {#each myQuotations as quote (quote._id)}
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div class="space-y-1">
                    <div class="flex items-center space-x-2">
                      <span class="font-bold text-sm text-app-text">{quote.stockRequest?.productName || 'Stock Request'}</span>
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase
                        {quote.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-600' : quote.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}"
                      >
                        {quote.status}
                      </span>
                    </div>
                    <div class="text-xs text-app-textMuted space-x-4">
                      <span>Offered: <strong>{quote.quantity} {quote.stockRequest?.unit || 'units'}</strong></span>
                      <span>Rate: <strong class="text-[#D4A72C]">₹{quote.price}/{quote.stockRequest?.unit || 'unit'}</strong></span>
                      <span>Total: <strong class="text-app-text">₹{(quote.price * quote.quantity).toLocaleString('en-IN')}</strong></span>
                      <span>ETA: <strong>{quote.deliveryTime}</strong></span>
                    </div>
                  </div>

                  {#if quote.status === 'accepted'}
                    <button 
                      onclick={() => handleTabChange('orders')}
                      class="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition"
                    >
                      View Order Fulfillment →
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ===== CATALOG & INVENTORY TAB ===== -->
      {:else if activeTab === 'inventory'}
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-app-border pb-4">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Warehouse Catalog</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-0.5">Stock & Inventory Health</h1>
              <p class="text-xs text-app-textMuted">Maintain available stock volumes and baseline wholesale unit prices.</p>
            </div>
            <button 
              onclick={() => showAddInvModal = true}
              class="px-4 py-2.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-md transition hover-lift flex items-center gap-1.5"
            >
              <Plus class="w-4 h-4" />
              <span>Add Stock Item</span>
            </button>
          </div>

          {#if inventoryLoading}
            <div class="space-y-3">
              {#each [1, 2, 3] as _}
                <div class="h-16 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
              {/each}
            </div>
          {:else if inventory.length === 0}
            <div class="text-center py-12 text-app-textMuted space-y-2">
              <div class="text-4xl">🏭</div>
              <h3 class="text-sm font-bold text-app-text">No catalog items added yet</h3>
              <p class="text-xs max-w-sm mx-auto">Add your warehouse inventory products to showcase stock availability to local retailers.</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each inventory as inv (inv._id)}
                <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col justify-between space-y-3 transition">
                  <div class="flex justify-between items-start">
                    <div>
                      <h4 class="text-sm font-bold text-app-text">{inv.productName}</h4>
                      <span class="text-[11px] text-app-textMuted">{inv.category} {inv.brand ? `• ${inv.brand}` : ''}</span>
                    </div>
                    <button 
                      onclick={() => handleDeleteInv(inv._id)}
                      class="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg text-xs transition"
                      title="Remove item"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div class="p-3 bg-app-card rounded-xl text-xs space-y-1.5 border border-app-border">
                    <div class="flex justify-between items-center">
                      <span class="text-app-textMuted">In Stock:</span>
                      <strong class={inv.stockQuantity <= (inv.minStockThreshold || 10) ? 'text-rose-500 font-extrabold' : 'text-emerald-600'}>
                        {inv.stockQuantity} {inv.unit}
                      </strong>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-app-textMuted">Wholesale Price:</span>
                      <strong class="text-[#D4A72C]">₹{inv.unitPrice} / {inv.unit}</strong>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ===== ORDERS & FULFILLMENT TAB ===== -->
      {:else if activeTab === 'orders'}
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
          <div class="flex justify-between items-center border-b border-app-border pb-3">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Order Pipeline</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-0.5">Orders Requiring Fulfillment ({orders.length})</h1>
              <p class="text-xs text-app-textMuted">Dispatch shipments, log delivery milestones, and ensure SLA compliance.</p>
            </div>
            <button onclick={loadOrders} class="px-3 py-1.5 text-xs font-bold rounded-lg border border-app-border hover:bg-app-cardSubtle">
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
              <div class="text-4xl">🚚</div>
              <h3 class="text-sm font-bold text-app-text">No active orders to fulfill</h3>
              <p class="text-xs max-w-sm mx-auto">When retailers accept your quotation, orders appear here for packing, dispatch, and delivery updates.</p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each orders as ord (ord._id)}
                <div class="p-5 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition">
                  <div class="space-y-1.5 flex-1">
                    <div class="flex items-center space-x-3">
                      <span class="text-xs font-mono font-bold text-app-textMuted">#{ord._id.slice(-6)}</span>
                      <span class="text-base font-bold text-app-text">{ord.productName}</span>
                      <span class="text-xs font-bold text-[#D4A72C]">Total: ₹{ord.totalAmount?.toLocaleString('en-IN')}</span>
                    </div>
                    <div class="text-xs text-app-textMuted space-x-4">
                      <span>Qty: <strong>{ord.quantity} {ord.unit}</strong></span>
                      <span>Retailer Store: <strong>{ord.retailerProfile?.companyName || ord.retailerProfile?.storeName || 'Retailer Store'}</strong></span>
                      {#if ord.expectedDeliveryDate}
                        <span class="text-amber-500 font-semibold">ETA: {new Date(ord.expectedDeliveryDate).toLocaleDateString()}</span>
                      {/if}
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-bold px-3 py-1 rounded-full uppercase
                      {ord.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-600' :
                       ord.status === 'out_for_delivery' || ord.status === 'shipped' ? 'bg-blue-500/20 text-blue-600' :
                       ord.status === 'packed' || ord.status === 'processing' ? 'bg-amber-500/20 text-amber-600' : 'bg-gray-500/20 text-gray-500'}"
                    >
                      {ord.status.replace(/_/g, ' ')}
                    </span>

                    <button 
                      onclick={() => { selectedTrackingOrder = ord; showTrackingModal = true; }}
                      class="px-3 py-1.5 text-xs font-bold border border-app-border bg-app-card hover:bg-app-cardSubtle text-app-text rounded-xl shadow-xs transition flex items-center gap-1"
                    >
                      <MapPin class="w-3.5 h-3.5 text-rose-500" />
                      <span>Track</span>
                    </button>

                    {#if ord.status !== 'delivered' && ord.status !== 'cancelled'}
                      <button 
                        onclick={() => openOrderStatusModal(ord)}
                        class="px-3.5 py-1.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs transition"
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

      <!-- ===== GROUP BUYING TAB ===== -->
      {:else if activeTab === 'groupbuy'}
        <GroupBuyingSection role="wholesaler" />

      <!-- ===== WHOLESALE PROFITABILITY TAB ===== -->
      {:else if activeTab === 'profitability'}
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
          <div class="flex justify-between items-center border-b border-app-border pb-4">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Financial Performance</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-0.5">Wholesale Profitability & P&L</h1>
              <p class="text-xs text-app-textMuted">Realized revenue, inventory valuation, and margin calculations derived from actual database orders.</p>
            </div>
            <button 
              onclick={loadProfitability}
              class="px-3 py-1.5 text-xs font-bold rounded-lg border border-app-border hover:bg-app-cardSubtle flex items-center gap-1"
            >
              <RefreshCw class="w-3.5 h-3.5 {profitabilityLoading ? 'animate-spin' : ''}" />
              <span>Refresh P&L</span>
            </button>
          </div>

          {#if profitabilityLoading}
            <div class="space-y-4">
              <div class="h-28 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
              <div class="h-48 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
            </div>
          {:else if profitabilityData?.metrics}
            {@const m = profitabilityData.metrics}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="bg-app-cardSubtle p-5 rounded-2xl border border-app-border">
                <span class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Fulfilled Revenue</span>
                <div class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-2">
                  ₹{m.totalFulfilledRevenue.toLocaleString('en-IN')}
                </div>
                <span class="text-[10px] text-app-textMuted mt-1 block">Completed deliveries</span>
              </div>

              <div class="bg-app-cardSubtle p-5 rounded-2xl border border-app-border">
                <span class="text-xs font-bold text-blue-500 uppercase tracking-wider">Inventory Valuation</span>
                <div class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-2">
                  ₹{m.inventoryValuation.toLocaleString('en-IN')}
                </div>
                <span class="text-[10px] text-app-textMuted mt-1 block">Warehouse assets</span>
              </div>

              <div class="bg-app-cardSubtle p-5 rounded-2xl border border-app-border">
                <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider">Est. Gross Profit</span>
                <div class="text-2xl sm:text-3xl font-extrabold font-heading text-emerald-600 mt-2">
                  ₹{m.estimatedGrossProfit.toLocaleString('en-IN')}
                </div>
                <span class="text-[10px] text-app-textMuted mt-1 block">Margin: {m.grossMarginPercent}%</span>
              </div>

              <div class="bg-app-cardSubtle p-5 rounded-2xl border border-app-border">
                <span class="text-xs font-bold text-purple-500 uppercase tracking-wider">Fulfillment Rate</span>
                <div class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-2">
                  {m.fulfillmentRate}%
                </div>
                <span class="text-[10px] text-app-textMuted mt-1 block">On-Time: {m.onTimeDeliveryRate !== null ? `${m.onTimeDeliveryRate}%` : 'N/A'}</span>
              </div>
            </div>

            <!-- Product Revenue Breakdown Table -->
            {#if profitabilityData.productBreakdown && profitabilityData.productBreakdown.length > 0}
              <div class="space-y-3 pt-4 border-t border-app-border">
                <h3 class="text-sm font-bold text-app-text uppercase tracking-wider">Revenue Breakdown by Product</h3>
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs">
                    <thead>
                      <tr class="border-b border-app-border text-app-textMuted">
                        <th class="py-2.5 px-3">Product</th>
                        <th class="py-2.5 px-3">Units Sold</th>
                        <th class="py-2.5 px-3 text-right">Revenue Generated</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-app-border/40">
                      {#each profitabilityData.productBreakdown as item}
                        <tr class="hover:bg-app-cardSubtle/50 transition">
                          <td class="py-2.5 px-3 font-semibold text-app-text">{item.productName}</td>
                          <td class="py-2.5 px-3 text-app-textMuted">{item.quantity} {item.unit}</td>
                          <td class="py-2.5 px-3 text-right font-bold text-[#D4A72C]">₹{item.revenue.toLocaleString('en-IN')}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {/if}

            <p class="text-[11px] text-app-textMuted italic bg-app-cardSubtle p-3 rounded-xl border border-app-border">
              {profitabilityData.disclosure}
            </p>
          {/if}
        </div>

      <!-- ===== PERFORMANCE SCORECARD TAB ===== -->
      {:else if activeTab === 'performance'}
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
          <div class="flex justify-between items-center border-b border-app-border pb-4">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Reliability Score</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-0.5">Supplier Performance Scorecard</h1>
              <p class="text-xs text-app-textMuted">Metrics calculated from completed deliveries and displayed to retailers in comparison matrices.</p>
            </div>
            <button onclick={loadMyPerformance} class="px-3.5 py-1.5 text-xs font-bold border border-app-border rounded-xl bg-app-cardSubtle hover:bg-app-card text-app-text transition">
              Refresh
            </button>
          </div>

          {#if performanceLoading}
            <div class="h-64 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
          {:else if !myPerformance}
            <div class="text-center py-12 text-app-textMuted space-y-2">
              <div class="text-4xl">📊</div>
              <h3 class="text-sm font-bold text-app-text">Performance data unavailable</h3>
              <p class="text-xs max-w-sm mx-auto">Complete orders with retailers to establish your verified delivery scorecard.</p>
            </div>
          {:else}
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
                <span class="text-[11px] font-bold text-app-textMuted uppercase">Total Orders</span>
                <div class="text-2xl font-extrabold font-heading text-app-text mt-1">{myPerformance.totalOrders || 0}</div>
                <span class="text-[10px] text-app-textMuted">Lifetime assignments</span>
              </div>

              <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
                <span class="text-[11px] font-bold text-app-textMuted uppercase">Fulfillment Rate</span>
                <div class="text-2xl font-extrabold font-heading text-emerald-600 mt-1">
                  {myPerformance.fulfillmentRate !== null && myPerformance.fulfillmentRate !== undefined ? `${myPerformance.fulfillmentRate}%` : 'N/A'}
                </div>
                <span class="text-[10px] text-app-textMuted">{myPerformance.completedOrders || 0} completed</span>
              </div>

              <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
                <span class="text-[11px] font-bold text-app-textMuted uppercase">On-Time Rate</span>
                <div class="text-2xl font-extrabold font-heading text-[#D4A72C] mt-1">
                  {myPerformance.onTimeDeliveryRate !== null && myPerformance.onTimeDeliveryRate !== undefined ? `${myPerformance.onTimeDeliveryRate}%` : 'N/A'}
                </div>
                <span class="text-[10px] text-app-textMuted">{myPerformance.onTimeDeliveries || 0} on-time</span>
              </div>

              <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
                <span class="text-[11px] font-bold text-app-textMuted uppercase">Avg Delivery Time</span>
                <div class="text-2xl font-extrabold font-heading text-blue-500 mt-1">
                  {myPerformance.averageDeliveryDays !== null && myPerformance.averageDeliveryDays !== undefined ? `${myPerformance.averageDeliveryDays} days` : 'N/A'}
                </div>
                <span class="text-[10px] text-app-textMuted">Order accepted to delivery</span>
              </div>
            </div>

            <div class="p-3 bg-app-cardSubtle rounded-2xl border border-app-border text-[11px] text-app-textMuted flex items-center space-x-2">
              <ShieldCheck class="w-4 h-4 text-emerald-600 shrink-0" />
              <span>These performance metrics are calculated automatically from completed order timestamps and verified deliveries.</span>
            </div>
          {/if}
        </div>

      <!-- ===== DELIVERY AREA & MAP TAB ===== -->
      {:else if activeTab === 'location'}
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-app-border pb-4">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Logistics Coverage</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-0.5">Warehouse Location & Delivery Radius</h1>
              <p class="text-xs text-app-textMuted mt-1">Set your warehouse coordinates and service radius to receive relevant local requests.</p>
            </div>
            <button
              type="button"
              onclick={requestWholesalerDeviceLocation}
              disabled={locLocating}
              class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition flex items-center gap-1.5 shrink-0"
            >
              <span>🎯</span>
              <span>{locLocating ? 'Detecting GPS...' : 'Use Device Location'}</span>
            </button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-7 flex flex-col space-y-2">
              <div class="bg-app-cardSubtle border border-app-border rounded-2xl overflow-hidden min-h-[420px] relative flex flex-col">
                {#if locMapLoading}
                  <div class="absolute inset-0 bg-app-card/80 backdrop-blur-xs z-10 flex flex-col items-center justify-center">
                    <div class="w-8 h-8 border-3 border-[#D4A72C] border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p class="text-xs font-medium text-app-textMuted">Loading interactive map...</p>
                  </div>
                {/if}

                {#if locMapError}
                  <div class="absolute inset-0 bg-app-card z-10 flex flex-col items-center justify-center p-6 text-center">
                    <p class="text-sm font-semibold text-app-text mb-1">Map Notice</p>
                    <p class="text-xs text-app-textMuted max-w-sm mb-3">{locMapError}</p>
                    <button type="button" onclick={initLocationMap} class="px-3 py-1 text-xs font-semibold rounded-lg bg-[#D4A72C] text-[#202124]">Retry Map</button>
                  </div>
                {/if}

                <div bind:this={locMapContainer} class="w-full h-full min-h-[420px] flex-1"></div>

                <div class="p-2.5 bg-app-card border-t border-app-border text-[11px] text-app-textMuted flex items-center justify-between">
                  <span>Coordinates: <b>{locLat.toFixed(5)}, {locLng.toFixed(5)}</b></span>
                  <span class="text-[#D4A72C] font-semibold">📍 Drag or Click to Relocate</span>
                </div>
              </div>
            </div>

            <!-- Address Form Fields -->
            <div class="lg:col-span-5 space-y-4">
              <div class="space-y-1 relative">
                <label for="loc-search-box" class="block text-xs font-bold text-app-text uppercase tracking-wider">
                  Search City or Business Address
                </label>
                <div class="relative">
                  <input
                    id="loc-search-box"
                    type="text"
                    value={locSearchQuery}
                    oninput={handleLocSearchInput}
                    onfocus={() => { if (locSearchResults.length > 0) showLocDropdown = true; }}
                    placeholder="e.g. Salem, Chennai, Bengaluru..."
                    class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C] focus:outline-none"
                  />
                  {#if locSearching}
                    <span class="absolute right-3 top-2.5 text-xs text-[#D4A72C] animate-pulse">Searching...</span>
                  {/if}
                </div>

                {#if showLocDropdown && locSearchResults.length > 0}
                  <div class="absolute left-0 right-0 top-full mt-1 bg-app-card border border-app-border rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto divide-y divide-app-border">
                    {#each locSearchResults as place}
                      <button
                        type="button"
                        class="w-full text-left p-2.5 hover:bg-app-cardSubtle text-xs transition flex items-start space-x-2"
                        onclick={() => selectLocPlace(place)}
                      >
                        <span class="text-[#D4A72C] shrink-0">📍</span>
                        <div class="truncate">
                          <span class="font-semibold text-app-text block truncate">{place.name}</span>
                          <span class="text-[11px] text-app-textMuted truncate block">{place.formattedAddress}</span>
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="space-y-3 pt-2 border-t border-app-border">
                <div>
                  <label for="loc-address-input" class="block text-[11px] font-bold text-app-textMuted uppercase mb-1">Warehouse Address *</label>
                  <textarea
                    id="loc-address-input"
                    bind:value={locAddress}
                    rows="2"
                    placeholder="Plot 14, Industrial Estate, Salem"
                    class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-[#D4A72C] resize-none"
                  ></textarea>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="loc-city-input" class="block text-[11px] font-bold text-app-textMuted uppercase mb-1">City</label>
                    <input id="loc-city-input" type="text" bind:value={locCity} placeholder="Salem" class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" />
                  </div>
                  <div>
                    <label for="loc-radius-select" class="block text-[11px] font-bold text-app-textMuted uppercase mb-1">Service Radius</label>
                    <select id="loc-radius-select" bind:value={locRadius} class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text font-semibold text-[#D4A72C]">
                      <option value={10}>10 km</option>
                      <option value={25}>25 km</option>
                      <option value={50}>50 km</option>
                      <option value={100}>100 km</option>
                    </select>
                  </div>
                </div>

                <div class="pt-2">
                  <button
                    type="button"
                    onclick={handleSaveLocation}
                    disabled={locSaving}
                    class="w-full py-2.5 px-4 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {locSaving ? 'Saving to Database...' : 'Save Business Location'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      <!-- ===== PROFILE TAB ===== -->
      {:else if activeTab === 'profile'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Account</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Company Profile</h1>
          </div>
          <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4 max-w-xl">
            <div class="flex items-center space-x-4">
              <div class="w-16 h-16 rounded-2xl bg-[#D4A72C]/20 flex items-center justify-center text-2xl font-black text-[#D4A72C]">
                {auth.user?.email?.charAt(0).toUpperCase() || 'W'}
              </div>
              <div>
                <p class="font-bold text-app-text">{auth.user?.email}</p>
                <p class="text-xs text-app-textMuted capitalize">Wholesale Supplier Account</p>
                <span class="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">Email Verified</span>
              </div>
            </div>
            {#if wholesalerProfile}
              <div class="grid grid-cols-2 gap-3 pt-3 border-t border-app-border text-xs">
                {#if wholesalerProfile.companyName}<div><span class="text-app-textMuted block font-bold uppercase tracking-wider text-[10px]">Company</span><span class="font-bold text-app-text">{wholesalerProfile.companyName}</span></div>{/if}
                {#if wholesalerProfile.address}<div><span class="text-app-textMuted block font-bold uppercase tracking-wider text-[10px]">Address</span><span class="font-bold text-app-text">{wholesalerProfile.address}</span></div>{/if}
                {#if wholesalerProfile.city}<div><span class="text-app-textMuted block font-bold uppercase tracking-wider text-[10px]">City</span><span class="font-bold text-app-text">{wholesalerProfile.city}</span></div>{/if}
                {#if wholesalerProfile.phone}<div><span class="text-app-textMuted block font-bold uppercase tracking-wider text-[10px]">Phone</span><span class="font-bold text-app-text">{wholesalerProfile.phone}</span></div>{/if}
              </div>
            {/if}
            <div class="pt-3 border-t border-app-border">
              <button onclick={() => auth.logout('/auth')} class="px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/30 rounded-xl transition">Sign Out</button>
            </div>
          </div>
        </div>
      {/if}

    </div>
  </div>
</div>

<!-- Submit Quotation Modal -->
{#if showQuoteModal && selectedIncomingReq}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-md rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <div class="flex justify-between items-center border-b border-app-border pb-3">
        <div>
          <span class="text-[10px] font-bold text-[#D4A72C] uppercase tracking-wider">Wholesaler Bid</span>
          <h3 class="text-base font-bold font-heading text-app-text">Submit Quotation</h3>
        </div>
        <button onclick={() => showQuoteModal = false} class="text-app-textMuted hover:text-app-text text-lg">✕</button>
      </div>

      <div class="bg-app-cardSubtle p-3 rounded-xl border border-app-border text-xs space-y-1">
        <div class="font-bold text-app-text">{selectedIncomingReq.productName}</div>
        <div class="text-app-textMuted">Requested: <strong>{selectedIncomingReq.quantity} {selectedIncomingReq.unit}</strong></div>
      </div>

      <form onsubmit={handleSubmitQuotation} class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="quote-rate" class="block font-bold text-app-text uppercase mb-1">Price per {selectedIncomingReq.unit} (₹) *</label>
            <input 
              id="quote-rate"
              type="number" 
              step="0.5" 
              min="0.1" 
              bind:value={quotePrice} 
              class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-[#D4A72C]" 
              required 
            />
          </div>
          <div>
            <label for="quote-offered-qty" class="block font-bold text-app-text uppercase mb-1">Offered Quantity *</label>
            <input 
              id="quote-offered-qty"
              type="number" 
              min="1" 
              bind:value={quoteQuantity} 
              class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-[#D4A72C]" 
              required 
            />
          </div>
        </div>

        <div>
          <label for="quote-eta" class="block font-bold text-app-text uppercase mb-1">Delivery ETA *</label>
          <input 
            id="quote-eta"
            type="text" 
            bind:value={quoteDeliveryTime} 
            placeholder="e.g. 24-48 hours" 
            class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-[#D4A72C]" 
            required 
          />
        </div>

        <div>
          <label for="quote-notes" class="block font-bold text-app-textMuted uppercase mb-1">Remarks (Optional)</label>
          <textarea 
            id="quote-notes"
            bind:value={quoteRemarks} 
            rows="2" 
            placeholder="Free delivery included, high grade batch..." 
            class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-[#D4A72C] resize-none"
          ></textarea>
        </div>

        <div class="p-2.5 bg-[#D4A72C]/10 rounded-xl border border-[#D4A72C]/20 flex justify-between items-center text-xs">
          <span class="text-app-text font-bold">Total Bid Value:</span>
          <span class="text-sm font-extrabold text-[#D4A72C]">₹{(quotePrice * quoteQuantity).toLocaleString('en-IN')}</span>
        </div>

        <div class="flex space-x-3 pt-2">
          <button type="button" onclick={() => showQuoteModal = false} class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-textMuted hover:text-app-text">Cancel</button>
          <button type="submit" disabled={quoteLoading} class="flex-1 py-2.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs transition">
            {quoteLoading ? 'Sending...' : 'Send Quotation'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Add Inventory Item Modal -->
{#if showAddInvModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-lg rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <div class="flex justify-between items-center border-b border-app-border pb-3">
        <h3 class="text-lg font-bold font-heading text-app-text">Add Inventory Stock Item</h3>
        <button onclick={() => showAddInvModal = false} class="text-app-textMuted hover:text-app-text text-lg">✕</button>
      </div>

      <form onsubmit={handleAddInventory} class="space-y-4 text-xs">
        {#if invFormError}
          <div class="p-3 text-xs bg-rose-500/10 text-rose-600 rounded-xl font-semibold border border-rose-500/20">{invFormError}</div>
        {/if}

        <div>
          <label for="inv-prod-name" class="block font-bold text-app-text uppercase mb-1">Product Name *</label>
          <input id="inv-prod-name" type="text" bind:value={invProdName} placeholder="Whole Wheat Atta" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C]" required />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="inv-cat-input" class="block font-bold text-app-text uppercase mb-1">Category *</label>
            <input id="inv-cat-input" type="text" bind:value={invCategory} placeholder="Flour & Grains" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C]" required />
          </div>
          <div>
            <label for="inv-brand-input" class="block font-bold text-app-textMuted uppercase mb-1">Brand</label>
            <input id="inv-brand-input" type="text" bind:value={invBrand} placeholder="Brand Name" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C]" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label for="inv-unit-input" class="block font-bold text-app-text uppercase mb-1">Unit *</label>
            <input id="inv-unit-input" type="text" bind:value={invUnit} placeholder="kg" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" required />
          </div>
          <div>
            <label for="inv-stock-qty" class="block font-bold text-app-text uppercase mb-1">Stock Qty *</label>
            <input id="inv-stock-qty" type="number" bind:value={invStockQty} min="0" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" required />
          </div>
          <div>
            <label for="inv-price-input" class="block font-bold text-app-text uppercase mb-1">Price (₹) *</label>
            <input id="inv-price-input" type="number" bind:value={invPrice} min="0" step="0.5" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" required />
          </div>
        </div>

        <div class="flex space-x-3 pt-2">
          <button type="button" onclick={() => showAddInvModal = false} class="flex-1 py-3 text-xs font-bold border border-app-border rounded-xl text-app-textMuted hover:text-app-text">Cancel</button>
          <button type="submit" disabled={invFormLoading} class="flex-1 py-3 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-md">
            {invFormLoading ? 'Adding...' : 'Save Stock'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Update Order Status Modal -->
{#if showOrderStatusModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-sm rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <h3 class="text-base font-bold font-heading text-app-text">Update Order Fulfillment Status</h3>
      <p class="text-xs text-app-textMuted">
        Order #{selectedOrder?._id.slice(-6)} • Current: <span class="font-bold text-[#D4A72C] uppercase">{selectedOrder?.status.replace(/_/g, ' ')}</span>
      </p>

      <div class="space-y-3 text-xs">
        <div>
          <label for="status-pipeline-select" class="block font-bold text-app-text mb-1">Next Step:</label>
          {#if availableStatusChoices.length === 0}
            <div class="p-2.5 bg-app-cardSubtle rounded-xl text-app-textMuted text-xs">
              No further transitions available.
            </div>
          {:else}
            <select id="status-pipeline-select" bind:value={nextStatusChoice} class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs font-bold text-[#D4A72C] uppercase">
              {#each availableStatusChoices as st}
                <option value={st}>{st.replace(/_/g, ' ').toUpperCase()}</option>
              {/each}
            </select>
          {/if}
        </div>

        <div>
          <label for="order-eta-input" class="block font-bold text-app-text mb-1">ETA Date</label>
          <input id="order-eta-input" type="date" bind:value={expectedDeliveryDateInput} class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" />
        </div>

        <div>
          <label for="order-dispatch-notes" class="block font-bold text-app-textMuted mb-1">Dispatch Notes</label>
          <input id="order-dispatch-notes" type="text" bind:value={statusNotes} placeholder="Driver dispatched..." class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" />
        </div>

        <div class="flex space-x-3 pt-2">
          <button onclick={() => showOrderStatusModal = false} class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-textMuted">Cancel</button>
          <button onclick={handleUpdateOrderStatus} disabled={updateLoading || availableStatusChoices.length === 0} class="flex-1 py-2.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs">
            {updateLoading ? 'Updating...' : 'Confirm'}
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
      <p class="text-xs text-app-textMuted leading-relaxed">{confirmMessage}</p>
      <div class="flex space-x-3 pt-2">
        <button onclick={() => showConfirmModal = false} class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-textMuted">Cancel</button>
        <button onclick={confirmCallback} class="flex-1 py-2.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs">Confirm</button>
      </div>
    </div>
  </div>
{/if}

<!-- Delivery Tracking Modal -->
{#if showTrackingModal && selectedTrackingOrder}
  <DeliveryTrackingModal 
    orderId={selectedTrackingOrder._id}
    onClose={() => { showTrackingModal = false; selectedTrackingOrder = null; }}
  />
{/if}
