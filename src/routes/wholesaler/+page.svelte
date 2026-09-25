<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { api } from '$lib/api.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import DeliveryTrackingModal from '$lib/components/DeliveryTrackingModal.svelte';
  import SupplierScorecardModal from '$lib/components/SupplierScorecardModal.svelte';
  import { getMapLibre, osmRasterStyle } from '$lib/maplibre.js';

  // Active Tab: 'requests' | 'orders' | 'inventory' | 'predictions' | 'performance' | 'location'
  let activeTab = $state('requests');
  let dashboardLoading = $state(true);

  // Wholesaler Business Location State
  let wholesalerProfile = $state(null);
  let locAddress = $state('');
  let locCity = $state('');
  let locState = $state('');
  let locPostalCode = $state('');
  let locLat = $state(11.6643); // Salem default
  let locLng = $state(78.1460);
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
  let incomingRequests = $state([]);
  let myBids = $state([]);
  let orders = $state([]);
  let inventory = $state([]);
  let predictions = $state([]);
  let myPerformance = $state(null);
  let ordersLoading = $state(false);
  let inventoryLoading = $state(false);
  let predictionsLoading = $state(false);
  let performanceLoading = $state(false);

  // Tracking Modal State
  let selectedTrackingOrder = $state(null);
  let showTrackingModal = $state(false);

  // Multi-item quotation state
  let formItems = $state([]);
  let formExpectedDeliveryDate = $state('');

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

  async function loadPredictions() {
    predictionsLoading = true;
    try {
      const res = await api.get('/inventory/predictions');
      predictions = res.predictions || [];
    } catch (err) {
      console.error('Failed to load predictions:', err);
      toasts.error('Failed to load stockout predictions');
    } finally {
      predictionsLoading = false;
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

  let availableStatusChoices = $state([]);
  let expectedDeliveryDateInput = $state('');

  function openResponseForm(reqObj) {
    selectedRequest = reqObj;
    formAvailability = 'available';
    formDeliveryTime = '24 hours';
    formRemarks = '';
    formError = '';

    if (reqObj.items && Array.isArray(reqObj.items) && reqObj.items.length > 0) {
      formItems = reqObj.items.map(it => ({
        product: it.product,
        productName: it.productName || it.brand || 'Item',
        requestedQuantity: it.quantity,
        offeredQuantity: it.quantity,
        unitPrice: it.targetPrice || 0,
        unit: it.unit || 'kg',
        available: true,
        remarks: ''
      }));
      formQuantity = reqObj.quantity || 0;
      formPrice = 0;
    } else {
      formItems = [];
      formQuantity = reqObj.quantity;
      formPrice = 0;
    }

    showFormModal = true;
  }

  async function submitBid() {
    formError = '';

    const isMultiItem = formItems && formItems.length > 0;

    if (isMultiItem) {
      const availableItems = formItems.filter(it => it.available);
      if (availableItems.length === 0) {
        formError = 'Please mark at least one item as available.';
        return;
      }
      for (const it of availableItems) {
        if (!it.unitPrice || it.unitPrice <= 0) {
          formError = `Please enter a valid unit price for "${it.productName}".`;
          return;
        }
        if (!it.offeredQuantity || it.offeredQuantity <= 0) {
          formError = `Please enter a valid offered quantity for "${it.productName}".`;
          return;
        }
      }
    } else {
      if (formPrice <= 0) {
        formError = 'Unit price must be greater than zero.';
        return;
      }
      if (formQuantity <= 0) {
        formError = 'Quantity offered must be greater than zero.';
        return;
      }
    }

    formLoading = true;
    try {
      const payload = {
        availability: formAvailability,
        deliveryTime: formDeliveryTime,
        remarks: formRemarks
      };

      if (isMultiItem) {
        payload.items = formItems.map(it => ({
          product: it.product,
          productName: it.productName,
          requestedQuantity: Number(it.requestedQuantity),
          offeredQuantity: it.available ? Number(it.offeredQuantity) : 0,
          unitPrice: Number(it.unitPrice),
          unit: it.unit,
          available: it.available,
          remarks: it.remarks || ''
        }));
        payload.price = payload.items.reduce((sum, it) => sum + (it.offeredQuantity * it.unitPrice), 0);
        payload.quantity = payload.items.reduce((sum, it) => sum + it.offeredQuantity, 0);
      } else {
        payload.quantity = Number(formQuantity);
        payload.price = Number(formPrice);
      }

      await api.post(`/responses/request/${selectedRequest._id}`, payload);

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
      loadPredictions();
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

  const mapTilerKey = (import.meta.env.VITE_MAPTILER_API_KEY || '').trim();
  const hasMapTilerKey = Boolean(mapTilerKey && mapTilerKey !== 'YOUR_MAPTILER_API_KEY');

  async function loadProfileLocation() {
    try {
      const res = await api.get('/auth/me');
      if (res && res.profile) {
        wholesalerProfile = res.profile;
        if (res.profile.address) locAddress = res.profile.address;
        if (res.profile.city) locCity = res.profile.city;
        if (res.profile.state) locState = res.profile.state;
        if (res.profile.postalCode) locPostalCode = res.profile.postalCode;
        if (res.profile.latitude !== undefined && res.profile.latitude !== null) {
          locLat = Number(res.profile.latitude);
        }
        if (res.profile.longitude !== undefined && res.profile.longitude !== null) {
          locLng = Number(res.profile.longitude);
        }
        if (res.profile.deliveryRadiusKm !== undefined) {
          locRadius = Number(res.profile.deliveryRadiusKm);
        }
      }
    } catch (err) {
      console.warn('Failed to load profile location:', err);
    }
  }

  async function initLocationMap() {
    await new Promise(r => setTimeout(r, 120));
    if (!browser || !locMapContainer) return;

    if (locMapInstance) {
      setTimeout(() => locMapInstance?.resize(), 50);
      return;
    }

    locMapLoading = true;
    locMapError = null;
    try {
      const maplibregl = await getMapLibre();
      const mapStyle = hasMapTilerKey
        ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`
        : osmRasterStyle;

      locMapInstance = new maplibregl.Map({
        container: locMapContainer,
        style: mapStyle,
        center: [locLng, locLat],
        zoom: 13,
        attributionControl: false,
      });

      locMapInstance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

      locMapInstance.on('load', () => {
        locMapLoading = false;
        renderLocMarker(maplibregl);
        setTimeout(() => locMapInstance?.resize(), 100);
      });

      locMapInstance.on('error', (e) => {
        console.warn('MapLibre runtime error:', e);
        if (hasMapTilerKey && locMapInstance?.setStyle) {
          try {
            locMapInstance.setStyle(osmRasterStyle);
          } catch {
            // Keep current style
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
      <div style="background-color: #FD6F2F; color: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);">
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
      toasts.error('Geolocation is not supported by your browser. Please search your address manually.');
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
        if (err.code === 1) {
          toasts.warning('Location permission was denied. Search for your location manually.');
        } else if (err.code === 2) {
          toasts.error('Location information is unavailable. Please search manually.');
        } else if (err.code === 3) {
          toasts.error('Location request timed out. Please try again or search manually.');
        } else {
          toasts.error('Unable to retrieve location. Please search manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSaveLocation() {
    if (!locAddress || !locAddress.trim()) {
      toasts.error('Please provide a business address.');
      return;
    }
    if (locLat < -90 || locLat > 90 || locLng < -180 || locLng > 180) {
      toasts.error('Coordinates are out of valid geographic range.');
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
        toasts.success('Warehouse business location saved successfully to database!');
      } else {
        toasts.error(res.message || 'Failed to save location');
      }
    } catch (err) {
      console.error('Save location error:', err);
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
      goto('/unauthorized');
      return;
    }

    loadDashboardData();
    loadOrders();
    loadInventory();
    loadPredictions();
    loadMyPerformance();
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

<div class="min-h-screen bg-app-bg text-app-text p-4 sm:p-6 lg:p-8 transition-colors duration-200 animate-page-fade">
  <div class="max-w-7xl mx-auto space-y-6">
    
    <!-- 1. Header Bar -->
    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm">
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
      <div class="flex flex-wrap gap-1 bg-app-cardSubtle p-1.5 rounded-2xl border border-app-border">
        <button 
          onclick={() => activeTab = 'requests'}
          class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'requests' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          📋 Demand Radar ({incomingRequests.length})
        </button>
        <button 
          onclick={() => { activeTab = 'orders'; loadOrders(); }}
          class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'orders' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          🚚 Orders ({orders.length})
        </button>
        <button 
          onclick={() => { activeTab = 'inventory'; loadInventory(); }}
          class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'inventory' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          🏭 Catalog ({inventory.length})
        </button>
        <button 
          onclick={() => { activeTab = 'predictions'; loadPredictions(); }}
          class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'predictions' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          🔮 Stock Predictions
        </button>
        <button 
          onclick={() => { activeTab = 'performance'; loadMyPerformance(); }}
          class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'performance' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          ⭐ Performance Scorecard
        </button>
        <button 
          onclick={() => { activeTab = 'location'; initLocationMap(); }}
          class="px-3.5 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'location' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          📍 Warehouse Location
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
      <button 
        onclick={() => { activeTab = 'location'; initLocationMap(); }}
        class="px-4 py-2 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text rounded-xl hover:bg-app-border/40 transition hover-lift"
      >
        📍 Set Warehouse Location
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
                <div class="space-y-1.5 flex-1">
                  <div class="flex items-center space-x-3">
                    <span class="text-xs font-mono font-bold text-app-muted">#{ord._id.slice(-6)}</span>
                    <span class="text-base font-bold text-app-text">{ord.productName || (ord.items?.[0]?.productName ? `${ord.items[0].productName} +${ord.items.length - 1} items` : 'Procurement Order')}</span>
                    <span class="text-xs font-bold text-brand-orange">Total: ₹{ord.totalAmount?.toLocaleString()}</span>
                  </div>
                  <div class="text-xs text-app-muted space-x-4">
                    <span>Qty: <strong>{ord.quantity} {ord.unit}</strong></span>
                    <span>Retailer Store: <strong>{ord.retailerProfile?.storeName || 'Retailer Store'}</strong></span>
                    {#if ord.expectedDeliveryDate}
                      <span class="text-amber-500 font-semibold">ETA: {new Date(ord.expectedDeliveryDate).toLocaleDateString()}</span>
                    {/if}
                  </div>

                  {#if ord.items && ord.items.length > 0}
                    <div class="mt-2 pt-2 border-t border-app-border/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {#each ord.items as item}
                        <div class="text-[11px] bg-app-card px-2.5 py-1 rounded-lg border border-app-border flex justify-between">
                          <span class="font-medium text-app-text">{item.productName}</span>
                          <span class="text-brand-orange font-bold">{item.quantity} {item.unit} @ ₹{item.unitPrice}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-bold px-3 py-1 rounded-full uppercase
                    {ord.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-500' :
                     ord.status === 'out_for_delivery' ? 'bg-indigo-500/20 text-indigo-400' :
                     ord.status === 'shipped' ? 'bg-purple-500/20 text-purple-500' :
                     ord.status === 'packed' ? 'bg-cyan-500/20 text-cyan-400' :
                     ord.status === 'processing' ? 'bg-blue-500/20 text-blue-500' : 'bg-amber-500/20 text-amber-500'}"
                  >
                    {ord.status.replace(/_/g, ' ')}
                  </span>

                  <!-- Track Delivery Button -->
                  <button 
                    onclick={() => { selectedTrackingOrder = ord; showTrackingModal = true; }}
                    class="px-3 py-1.5 text-xs font-bold border border-app-border bg-app-card hover:bg-app-border/40 text-app-text rounded-xl shadow-xs transition flex items-center space-x-1"
                  >
                    <span>📍</span>
                    <span>Track</span>
                  </button>

                  {#if ord.status !== 'delivered' && ord.status !== 'cancelled'}
                    <button 
                      onclick={() => openOrderStatusModal(ord)}
                      class="px-3.5 py-1.5 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs transition"
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

    {:else if activeTab === 'predictions'}
      <!-- 8. Intelligent Stockout & Depletion Predictions (Phase 4 Feature 1) -->
      <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-app-border pb-4">
          <div>
            <div class="flex items-center space-x-2 text-xs font-bold text-brand-orange uppercase tracking-wider">
              <span>Predictive Inventory Analytics</span>
            </div>
            <h2 class="text-xl font-bold font-heading text-app-text mt-0.5">
              Warehouse Stockout & Reorder Predictions
            </h2>
            <p class="text-xs text-app-muted">
              Calculated using actual historical order fulfillment consumption over the past 30 days.
            </p>
          </div>
          <button 
            onclick={loadPredictions} 
            class="px-3.5 py-1.5 text-xs font-bold border border-app-border rounded-xl bg-app-cardSubtle hover:bg-app-border/40 text-app-text transition"
          >
            🔄 Refresh Analysis
          </button>
        </div>

        {#if predictionsLoading}
          <div class="space-y-3">
            {#each Array(3) as _}
              <div class="h-20 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
            {/each}
          </div>
        {:else if predictions.length === 0}
          <div class="text-center py-12 text-app-muted space-y-2">
            <div class="text-4xl">🔮</div>
            <h3 class="text-sm font-bold text-app-text">No inventory items available</h3>
            <p class="text-xs max-w-sm mx-auto">Add inventory items to your catalog to generate depletion rate forecasts and stockout predictions.</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {#each predictions as pred}
              <div class="bg-app-cardSubtle p-5 rounded-2xl border border-app-border space-y-3 shadow-xs">
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="text-sm font-bold text-app-text">{pred.productName}</h3>
                    <span class="text-[11px] text-app-muted">{pred.category} {pred.brand ? `• ${pred.brand}` : ''}</span>
                  </div>
                  <span class="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full
                    {pred.status === 'Critical' || pred.status === 'Out of Stock' ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' :
                     pred.status === 'Low' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                     'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'}"
                  >
                    {pred.status}
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-app-border/40">
                  <div class="bg-app-card p-2.5 rounded-xl border border-app-border">
                    <span class="text-[10px] text-app-muted block">Current Stock</span>
                    <strong class="text-sm font-bold text-app-text">{pred.currentStock} {pred.unit}</strong>
                  </div>
                  <div class="bg-app-card p-2.5 rounded-xl border border-app-border">
                    <span class="text-[10px] text-app-muted block">Daily Depletion Rate</span>
                    <strong class="text-sm font-bold text-brand-orange">
                      {pred.hasHistory ? `${pred.averageDailyUsage} ${pred.unit}/day` : 'N/A'}
                    </strong>
                  </div>
                </div>

                <div class="bg-app-card p-3 rounded-xl border border-app-border text-xs space-y-1">
                  <div class="flex justify-between">
                    <span class="text-app-muted">Predicted Stockout:</span>
                    {#if pred.hasHistory}
                      <strong class="text-rose-500 font-bold">
                        {pred.daysUntilStockout !== null ? `${pred.daysUntilStockout} days` : 'Depleted'}
                      </strong>
                    {:else}
                      <span class="text-app-muted italic text-[11px]">Insufficient history for prediction</span>
                    {/if}
                  </div>
                  <div class="flex justify-between">
                    <span class="text-app-muted">Recommended Restock:</span>
                    <strong class="text-app-text font-bold">
                      {pred.recommendedReorderQuantity > 0 ? `${pred.recommendedReorderQuantity} ${pred.unit}` : 'Stock Sufficient'}
                    </strong>
                  </div>
                  <div class="flex justify-between text-[11px] pt-1 border-t border-app-border/30">
                    <span class="text-app-muted">30-Day Total Outflow:</span>
                    <span class="text-app-text font-semibold">{pred.historicalConsumption} {pred.unit}</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === 'performance'}
      <!-- 9. Wholesaler Supplier Scorecard (Phase 6 Feature 3) -->
      <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-app-border pb-4">
          <div>
            <div class="flex items-center space-x-2 text-xs font-bold text-brand-orange uppercase tracking-wider">
              <span>Verified Wholesaler Analytics</span>
            </div>
            <h2 class="text-xl font-bold font-heading text-app-text mt-0.5">
              My Supplier Performance Scorecard
            </h2>
            <p class="text-xs text-app-muted">
              Transparent fulfillment reliability metrics verified from actual database order transactions.
            </p>
          </div>
          <button 
            onclick={loadMyPerformance} 
            class="px-3.5 py-1.5 text-xs font-bold border border-app-border rounded-xl bg-app-cardSubtle hover:bg-app-border/40 text-app-text transition"
          >
            🔄 Refresh Metrics
          </button>
        </div>

        {#if performanceLoading}
          <div class="h-64 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
        {:else if !myPerformance}
          <div class="text-center py-12 text-app-muted space-y-2">
            <div class="text-4xl">📊</div>
            <h3 class="text-sm font-bold text-app-text">Performance data unavailable</h3>
            <p class="text-xs max-w-sm mx-auto">Complete orders with retailers to establish your verified delivery scorecard.</p>
          </div>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
              <span class="text-[11px] font-bold text-app-muted uppercase">Total Orders</span>
              <div class="text-2xl font-extrabold font-heading text-app-text mt-1">{myPerformance.totalOrders}</div>
              <span class="text-[10px] text-app-muted">Lifetime assignments</span>
            </div>

            <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
              <span class="text-[11px] font-bold text-app-muted uppercase">Fulfillment Rate</span>
              <div class="text-2xl font-extrabold font-heading text-emerald-500 mt-1">
                {myPerformance.fulfillmentRate !== null ? `${myPerformance.fulfillmentRate}%` : 'N/A'}
              </div>
              <span class="text-[10px] text-app-muted">{myPerformance.completedOrders} completed of {myPerformance.totalOrders}</span>
            </div>

            <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
              <span class="text-[11px] font-bold text-app-muted uppercase">On-Time Deliveries</span>
              <div class="text-2xl font-extrabold font-heading text-brand-orange mt-1">
                {myPerformance.onTimeDeliveryRate !== null ? `${myPerformance.onTimeDeliveryRate}%` : 'N/A'}
              </div>
              <span class="text-[10px] text-app-muted">{myPerformance.onTimeDeliveries} on-time ({myPerformance.lateDeliveries} late)</span>
            </div>

            <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
              <span class="text-[11px] font-bold text-app-muted uppercase">Avg Delivery Time</span>
              <div class="text-2xl font-extrabold font-heading text-blue-500 mt-1">
                {myPerformance.averageDeliveryDays !== null ? `${myPerformance.averageDeliveryDays} days` : 'N/A'}
              </div>
              <span class="text-[10px] text-app-muted">Order accepted to delivery</span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
              <span class="text-xs text-app-muted">Total Order Value Fulfilled</span>
              <div class="text-xl font-bold text-app-text mt-1">₹{myPerformance.totalOrderValue?.toLocaleString()}</div>
            </div>
            <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
              <span class="text-xs text-app-muted">Cancelled Orders</span>
              <div class="text-xl font-bold {myPerformance.cancelledOrders > 0 ? 'text-rose-500' : 'text-emerald-500'} mt-1">
                {myPerformance.cancelledOrders}
              </div>
            </div>
            <div class="bg-app-cardSubtle p-4 rounded-2xl border border-app-border">
              <span class="text-xs text-app-muted">Avg Quotation Response</span>
              <div class="text-xl font-bold text-purple-400 mt-1">
                {myPerformance.quotationResponseTimeHours !== null ? `${myPerformance.quotationResponseTimeHours} hours` : 'N/A'}
              </div>
            </div>
          </div>

          <div class="p-3 bg-app-cardSubtle rounded-2xl border border-app-border text-[11px] text-app-muted flex items-center space-x-2">
            <span>🛡️</span>
            <span>
              These performance metrics are calculated automatically from completed order timestamps and verified deliveries. They are displayed to retailers when comparing your bids.
            </span>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'location'}
      <!-- Warehouse Location Management Panel -->
      <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-app-border pb-4">
          <div>
            <h2 class="text-xl font-bold font-heading text-app-text flex items-center gap-2">
              <span>📍</span>
              <span>Warehouse & Business Location</span>
            </h2>
            <p class="text-xs text-app-muted mt-1">
              Set your precise warehouse coordinates and service radius. Nearby retailers use this to discover you and calculate road routes.
            </p>
          </div>
          <button
            type="button"
            onclick={requestWholesalerDeviceLocation}
            disabled={locLocating}
            class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            <span>🎯</span>
            <span>{locLocating ? 'Detecting GPS...' : 'Use Current Device Location'}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Left: Interactive Map (7 cols) -->
          <div class="lg:col-span-7 flex flex-col space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-bold text-app-text">Pinpoint Warehouse on Map</span>
              <span class="text-app-muted text-[11px]">Click or drag marker to adjust</span>
            </div>

            <div class="bg-app-cardSubtle border border-app-border rounded-2xl overflow-hidden min-h-[420px] relative flex flex-col">
              {#if locMapLoading}
                <div class="absolute inset-0 bg-app-card/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                  <div class="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p class="text-xs font-medium text-app-textMuted">Loading interactive map...</p>
                </div>
              {/if}

              {#if locMapError}
                <div class="absolute inset-0 bg-app-card z-10 flex flex-col items-center justify-center p-6 text-center">
                  <p class="text-sm font-semibold text-app-text mb-1">Map Notice</p>
                  <p class="text-xs text-app-muted max-w-sm mb-3">{locMapError}</p>
                  <button
                    type="button"
                    onclick={initLocationMap}
                    class="px-3 py-1 text-xs font-semibold rounded-lg bg-brand-orange text-white"
                  >
                    Retry Map
                  </button>
                </div>
              {/if}

              <div bind:this={locMapContainer} class="w-full h-full min-h-[420px] flex-1"></div>

              <div class="p-2.5 bg-app-card border-t border-app-border text-[11px] text-app-muted flex items-center justify-between">
                <span>Coordinates: <b>{locLat.toFixed(5)}, {locLng.toFixed(5)}</b></span>
                <span class="text-brand-orange font-semibold">📍 Drag or Click to Relocate</span>
              </div>
            </div>
          </div>

          <!-- Right: Place Search & Form Fields (5 cols) -->
          <div class="lg:col-span-5 space-y-4">
            <!-- Place / City Search Box -->
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
                  placeholder="e.g. Salem, Chennai, Coimbatore..."
                  class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
                />
                {#if locSearching}
                  <span class="absolute right-3 top-2.5 text-xs text-brand-orange animate-pulse">Searching...</span>
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
                      <span class="text-brand-orange shrink-0">📍</span>
                      <div class="truncate">
                        <span class="font-semibold text-app-text block truncate">{place.name}</span>
                        <span class="text-[11px] text-app-muted truncate block">{place.formattedAddress}</span>
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Form Fields -->
            <div class="space-y-3 pt-2 border-t border-app-border">
              <div>
                <label for="loc-address-input" class="block text-[11px] font-bold text-app-muted uppercase mb-1">
                  Street / Warehouse Address *
                </label>
                <textarea
                  id="loc-address-input"
                  bind:value={locAddress}
                  rows="2"
                  placeholder="e.g. Plot 14, Industrial Estate, Salem"
                  class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-brand-orange resize-none"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="loc-city-input" class="block text-[11px] font-bold text-app-muted uppercase mb-1">City</label>
                  <input
                    id="loc-city-input"
                    type="text"
                    bind:value={locCity}
                    placeholder="Salem"
                    class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-brand-orange"
                  />
                </div>
                <div>
                  <label for="loc-state-input" class="block text-[11px] font-bold text-app-muted uppercase mb-1">State</label>
                  <input
                    id="loc-state-input"
                    type="text"
                    bind:value={locState}
                    placeholder="Tamil Nadu"
                    class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-brand-orange"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="loc-postal-input" class="block text-[11px] font-bold text-app-muted uppercase mb-1">Postal Code</label>
                  <input
                    id="loc-postal-input"
                    type="text"
                    bind:value={locPostalCode}
                    placeholder="636004"
                    class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-brand-orange"
                  />
                </div>
                <div>
                  <label for="loc-radius-select" class="block text-[11px] font-bold text-app-muted uppercase mb-1">Delivery Radius</label>
                  <select
                    id="loc-radius-select"
                    bind:value={locRadius}
                    class="w-full px-3 py-2 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-brand-orange font-semibold text-brand-orange"
                  >
                    <option value={10}>10 km</option>
                    <option value={25}>25 km</option>
                    <option value={50}>50 km</option>
                    <option value={100}>100 km</option>
                    <option value={200}>200 km</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 pt-1">
                <div class="p-2.5 bg-app-cardSubtle border border-app-border rounded-xl">
                  <span class="text-[10px] font-bold text-app-muted uppercase block">Latitude</span>
                  <span class="text-xs font-mono font-semibold text-app-text">{locLat.toFixed(6)}</span>
                </div>
                <div class="p-2.5 bg-app-cardSubtle border border-app-border rounded-xl">
                  <span class="text-[10px] font-bold text-app-muted uppercase block">Longitude</span>
                  <span class="text-xs font-mono font-semibold text-app-text">{locLng.toFixed(6)}</span>
                </div>
              </div>

              <div class="pt-2">
                <button
                  type="button"
                  onclick={handleSaveLocation}
                  disabled={locSaving}
                  class="w-full py-2.5 px-4 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {#if locSaving}
                    <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving to Database...</span>
                  {:else}
                    <span>💾</span>
                    <span>Save Business Location</span>
                  {/if}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

  </div>
</div>

<!-- Submit Quotation Modal -->
{#if showFormModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-2xl rounded-3xl border border-app-border shadow-2xl p-6 space-y-5 animate-toast max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center border-b border-app-border pb-3">
        <div>
          <h3 class="text-lg font-bold font-heading text-app-text">Submit Quotation Offer</h3>
          <p class="text-xs text-app-muted">Provide pricing and availability to the requesting retailer</p>
        </div>
        <button onclick={() => showFormModal = false} class="text-app-muted hover:text-app-text text-lg">✕</button>
      </div>

      {#if formError}
        <div class="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl font-semibold border border-rose-200">
          {formError}
        </div>
      {/if}

      <div class="space-y-4 text-xs">
        {#if formItems && formItems.length > 0}
          <!-- Multi-Product Quotation Breakdown (Phase 9 Feature 6) -->
          <div class="space-y-2">
            <span class="text-xs font-bold text-brand-orange uppercase tracking-wider block">
              Multi-Product Procurement Items ({formItems.length})
            </span>
            <div class="border border-app-border rounded-2xl overflow-hidden divide-y divide-app-border">
              {#each formItems as item, idx}
                <div class="p-3 bg-app-cardSubtle space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id={`item-avail-${idx}`}
                        bind:checked={item.available}
                        class="accent-brand-orange rounded"
                      />
                      <label for={`item-avail-${idx}`} class="font-bold text-sm text-app-text cursor-pointer">
                        {item.productName}
                      </label>
                      <span class="text-app-muted text-[11px]">(Requested: {item.requestedQuantity} {item.unit})</span>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full {item.available ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}">
                      {item.available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>

                  {#if item.available}
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      <div>
                        <label for={`item-offered-${idx}`} class="block text-[10px] text-app-muted font-bold mb-1">Offered Qty ({item.unit})</label>
                        <input 
                          id={`item-offered-${idx}`}
                          type="number"
                          bind:value={item.offeredQuantity}
                          min="1"
                          max={item.requestedQuantity}
                          class="w-full px-2.5 py-1.5 bg-app-card border border-app-border rounded-lg text-xs text-app-text"
                        />
                      </div>
                      <div>
                        <label for={`item-price-${idx}`} class="block text-[10px] text-app-muted font-bold mb-1">Unit Price (₹)</label>
                        <input 
                          id={`item-price-${idx}`}
                          type="number"
                          bind:value={item.unitPrice}
                          min="0"
                          step="0.5"
                          class="w-full px-2.5 py-1.5 bg-app-card border border-app-border rounded-lg text-xs text-app-text font-bold text-brand-orange"
                        />
                      </div>
                      <div class="col-span-2 sm:col-span-1">
                        <label for={`item-notes-${idx}`} class="block text-[10px] text-app-muted font-bold mb-1">Item Notes</label>
                        <input 
                          id={`item-notes-${idx}`}
                          type="text"
                          bind:value={item.remarks}
                          placeholder="Grade A / packaged"
                          class="w-full px-2.5 py-1.5 bg-app-card border border-app-border rounded-lg text-xs text-app-text"
                        />
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>

            <!-- Total Quoted Amount Summary -->
            <div class="p-3 bg-app-card rounded-xl border border-app-border flex justify-between items-center text-xs">
              <span class="text-app-muted">Total Quoted Quotation Value:</span>
              <strong class="text-sm font-bold text-brand-orange">
                ₹{formItems.reduce((sum, it) => sum + (it.available ? (Number(it.offeredQuantity) || 0) * (Number(it.unitPrice) || 0) : 0), 0).toLocaleString()}
              </strong>
            </div>
          </div>
        {:else}
          <!-- Single Product Quotation (Legacy backward compatibility) -->
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
        {/if}

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <input 
              id="form-remarks"
              type="text"
              bind:value={formRemarks}
              placeholder="Free doorstep delivery on bulk order..."
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange focus:outline-none"
            />
          </div>
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

<!-- Update Order Fulfillment Status Modal (Phase 7 Feature 4) -->
{#if showOrderStatusModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-sm rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <h3 class="text-base font-bold font-heading text-app-text">Update Order Fulfillment Status</h3>
      <p class="text-xs text-app-muted">
        Order #{selectedOrder?._id.slice(-6)} • Current: <span class="font-bold text-brand-orange uppercase">{selectedOrder?.status.replace(/_/g, ' ')}</span>
      </p>

      <div class="space-y-3 text-xs">
        <div>
          <label for="next-status-choice" class="block font-bold text-app-text mb-1">Next Fulfillment Pipeline Step:</label>
          {#if availableStatusChoices.length === 0}
            <div class="p-2.5 bg-app-cardSubtle rounded-xl text-app-muted text-xs">
              No further status transitions available for this order.
            </div>
          {:else}
            <select 
              id="next-status-choice"
              bind:value={nextStatusChoice}
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs font-bold text-brand-orange uppercase"
            >
              {#each availableStatusChoices as st}
                <option value={st}>{st.replace(/_/g, ' ').toUpperCase()}</option>
              {/each}
            </select>
          {/if}
        </div>

        <div>
          <label for="expected-delivery-date" class="block font-bold text-app-text mb-1">Expected Delivery Date (ETA)</label>
          <input 
            id="expected-delivery-date"
            type="date" 
            bind:value={expectedDeliveryDateInput}
            class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text"
          />
        </div>

        <div>
          <label for="status-notes" class="block font-bold text-app-muted mb-1">Dispatch / Delivery Notes</label>
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
            disabled={updateLoading || availableStatusChoices.length === 0}
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

<!-- Delivery Tracking Modal -->
{#if showTrackingModal}
  <DeliveryTrackingModal 
    bind:show={showTrackingModal} 
    order={selectedTrackingOrder} 
    onClose={() => showTrackingModal = false} 
  />
{/if}
