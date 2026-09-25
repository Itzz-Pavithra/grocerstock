<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { api } from '$lib/api.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import { 
    MapPin, 
    Navigation, 
    Store, 
    Truck, 
    Search, 
    SlidersHorizontal, 
    CheckCircle2, 
    ExternalLink, 
    AlertCircle,
    Info,
    Phone,
    ShieldCheck
  } from 'lucide-svelte';

  let { 
    userLocation = null,
    onSelectSupplier = null,
    categories = []
  } = $props();

  let mapContainer = $state(null);
  let mapInstance = null;
  let markers = [];
  let userMarker = null;

  // Filter States
  let searchQuery = $state('');
  let selectedCategory = $state('');
  let radiusKm = $state(30);
  let selectedWholesaler = $state(null);

  // Data States
  let wholesalers = $state([]);
  let loading = $state(true);
  let mapLoading = $state(true);
  let mapError = $state(null);

  // MapTiler API Key (Read safely from Vite public env)
  const mapTilerKey = (import.meta.env.VITE_MAPTILER_API_KEY || '').trim();
  const hasMapTilerKey = Boolean(mapTilerKey && mapTilerKey !== 'YOUR_MAPTILER_API_KEY');

  // Fallback / center coordinates (Default: Bengaluru 12.9716, 77.5946 if not provided)
  let currentLat = $state(12.9716);
  let currentLng = $state(77.5946);

  $effect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      currentLat = userLocation.latitude;
      currentLng = userLocation.longitude;
    }
  });

  async function loadWholesalers() {
    loading = true;
    try {
      const params = new URLSearchParams();
      if (currentLat && currentLng) {
        params.append('latitude', currentLat.toString());
        params.append('longitude', currentLng.toString());
      }
      if (radiusKm) params.append('radius', radiusKm.toString());
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const res = await api.get(`/wholesalers/nearby?${params.toString()}`);
      wholesalers = res.wholesalers || [];
      updateMapMarkers();
    } catch (err) {
      console.error('Failed to load wholesalers:', err);
      toasts.error('Failed to fetch nearby suppliers');
    } finally {
      loading = false;
    }
  }

  async function initMap() {
    if (!browser || !mapContainer || !hasMapTilerKey) {
      mapLoading = false;
      return;
    }

    try {
      const maplibregl = (await import('maplibre-gl')).default;

      mapInstance = new maplibregl.Map({
        container: mapContainer,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`,
        center: [currentLng, currentLat],
        zoom: 12,
        attributionControl: false,
      });

      mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

      mapInstance.on('load', () => {
        mapLoading = false;
        renderUserMarker(maplibregl);
        updateMapMarkers();
      });

      mapInstance.on('error', (e) => {
        console.warn('MapLibre/MapTiler error:', e);
        mapError = 'Map tiles could not be loaded. Please verify your MapTiler API Key.';
        mapLoading = false;
      });

      // Allow retailer to click on map to reposition search center
      mapInstance.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        currentLng = Number(lng.toFixed(4));
        currentLat = Number(lat.toFixed(4));
        renderUserMarker(maplibregl);
        loadWholesalers();
      });
    } catch (err) {
      console.error('Map initialization failed:', err);
      mapError = err.message || 'Map failed to load';
      mapLoading = false;
    }
  }

  function renderUserMarker(maplibregl) {
    if (!mapInstance || !browser) return;
    if (userMarker) userMarker.remove();

    const el = document.createElement('div');
    el.className = 'user-pin flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-lg text-white animate-pulse';
    el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

    userMarker = new maplibregl.Marker({ element: el })
      .setLngLat([currentLng, currentLat])
      .setPopup(
        new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div style="font-family: inherit; padding: 4px;">
            <div style="font-weight: 700; color: #1e40af;">📍 Your Store Location</div>
            <div style="font-size: 11px; color: #64748b;">${userLocation?.storeName || 'My Retail Store'}</div>
          </div>
        `)
      )
      .addTo(mapInstance);
  }

  async function updateMapMarkers() {
    if (!mapInstance || !browser) return;

    const maplibregl = (await import('maplibre-gl')).default;

    // Remove existing wholesaler markers
    markers.forEach((m) => m.remove());
    markers = [];

    wholesalers.forEach((w) => {
      if (w.longitude && w.latitude) {
        const el = document.createElement('div');
        el.className = 'wholesaler-pin cursor-pointer transform hover:scale-110 transition-transform duration-150';
        el.innerHTML = `
          <div style="background-color: #FD6F2F; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
        `;

        const distanceTag = w.distanceKm !== null ? `<b>${w.distanceKm} km</b> away` : '';
        const popupContent = `
          <div style="font-family: inherit; min-width: 190px; padding: 6px;">
            <div style="font-weight: 700; font-size: 14px; color: #1e293b; margin-bottom: 2px;">${w.companyName}</div>
            <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">📍 ${w.address}, ${w.city || ''}</div>
            ${distanceTag ? `<div style="font-size: 11px; color: #FD6F2F; margin-bottom: 6px;">🚗 ${distanceTag}</div>` : ''}
            <div style="font-size: 11px; color: #047857; font-weight: 600; margin-bottom: 6px;">
              ✓ Fulfillment: ${w.performance?.fulfillmentRate || '98%'} (${w.performance?.completedOrders || 0} orders)
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
              ${(w.categoriesSupplied || []).slice(0, 3).map(c => `<span style="font-size: 10px; background: #FFF0E8; color: #FD6F2F; padding: 2px 6px; border-radius: 4px;">${c}</span>`).join('')}
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupContent);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([w.longitude, w.latitude])
          .setPopup(popup)
          .addTo(mapInstance);

        el.addEventListener('click', () => {
          selectedWholesaler = w;
        });

        markers.push(marker);
      }
    });
  }

  function focusWholesaler(w) {
    selectedWholesaler = w;
    if (mapInstance && w.longitude && w.latitude) {
      mapInstance.flyTo({
        center: [w.longitude, w.latitude],
        zoom: 14,
        essential: true,
      });
    }
  }

  onMount(() => {
    loadWholesalers();
    if (hasMapTilerKey) {
      initMap();
    } else {
      mapLoading = false;
    }
  });

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });
</script>

<div class="space-y-4">
  <!-- Top Bar: Filters & Geolocation context -->
  <div class="bg-app-card border border-app-border rounded-2xl p-4 shadow-sm">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="flex items-center space-x-3">
        <div class="p-2.5 rounded-xl bg-brand-orange/10 text-brand-orange">
          <MapPin class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-heading font-bold text-app-text text-base">Find Nearby Wholesalers</h3>
          <p class="text-xs text-app-textMuted">
            Discover verified suppliers within your delivery radius
          </p>
        </div>
      </div>

      <!-- Live Filters -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Search Input -->
        <div class="relative min-w-[180px]">
          <Search class="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-app-textMuted" />
          <input
            type="text"
            bind:value={searchQuery}
            oninput={() => loadWholesalers()}
            placeholder="Search suppliers..."
            class="w-full pl-8 pr-3 py-1.5 text-xs bg-app-cardSubtle border border-app-border rounded-lg text-app-text focus:outline-none focus:border-brand-orange"
          />
        </div>

        <!-- Category Filter -->
        <select
          bind:value={selectedCategory}
          onchange={() => loadWholesalers()}
          class="px-3 py-1.5 text-xs bg-app-cardSubtle border border-app-border rounded-lg text-app-text focus:outline-none focus:border-brand-orange"
        >
          <option value="">All Categories</option>
          {#each categories as cat}
            <option value={cat.name}>{cat.name}</option>
          {/each}
        </select>

        <!-- Radius Filter -->
        <div class="flex items-center space-x-1.5 bg-app-cardSubtle px-2.5 py-1.5 border border-app-border rounded-lg text-xs text-app-text">
          <SlidersHorizontal class="h-3.5 w-3.5 text-brand-orange" />
          <span>Radius:</span>
          <select 
            bind:value={radiusKm} 
            onchange={() => loadWholesalers()}
            class="bg-transparent font-semibold text-brand-orange focus:outline-none cursor-pointer"
          >
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- Map and Supplier Split View -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <!-- Map Container (7 columns) -->
    <div class="lg:col-span-7 bg-app-card border border-app-border rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[420px] relative">
      {#if !hasMapTilerKey}
        <!-- Notice if VITE_MAPTILER_API_KEY is not configured -->
        <div class="h-full flex-1 flex flex-col items-center justify-center p-8 text-center bg-app-cardSubtle">
          <div class="p-3.5 rounded-full bg-amber-500/10 text-amber-600 mb-3">
            <Info class="h-7 w-7" />
          </div>
          <h4 class="font-heading font-bold text-app-text text-base mb-1.5">Interactive Map View</h4>
          <p class="text-xs text-app-textMuted max-w-md mb-4">
            Map integration uses MapTiler tiles. To activate the live graphical map, set <code class="px-1.5 py-0.5 rounded bg-app-card border border-app-border font-mono text-brand-orange">VITE_MAPTILER_API_KEY</code> in your environment variables.
          </p>
          <div class="text-xs text-app-textMuted flex items-center space-x-1.5 bg-app-card px-3 py-1.5 rounded-lg border border-app-border">
            <ShieldCheck class="h-4 w-4 text-emerald-500" />
            <span>All supplier coordinates & distance calculations continue to work via MongoDB!</span>
          </div>
        </div>
      {:else}
        {#if mapLoading}
          <div class="absolute inset-0 bg-app-card/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
            <div class="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin mb-2"></div>
            <p class="text-xs font-medium text-app-textMuted">Loading MapTiler map...</p>
          </div>
        {/if}

        {#if mapError}
          <div class="absolute inset-0 bg-app-card z-10 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle class="h-8 w-8 text-rose-500 mb-2" />
            <p class="text-sm font-semibold text-app-text mb-1">Map Unavailable</p>
            <p class="text-xs text-app-textMuted max-w-sm">{mapError}</p>
          </div>
        {/if}

        <div bind:this={mapContainer} class="w-full h-full min-h-[440px] flex-1"></div>

        <div class="p-2.5 bg-app-card border-t border-app-border text-[11px] text-app-textMuted flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <span>Your Store</span>
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-brand-orange ml-2"></span>
            <span>Wholesalers</span>
          </div>
          <span>Tip: Click on map to update search location</span>
        </div>
      {/if}
    </div>

    <!-- Wholesalers List (5 columns) -->
    <div class="lg:col-span-5 flex flex-col space-y-3">
      <div class="flex items-center justify-between px-1">
        <span class="text-xs font-bold text-app-text uppercase tracking-wider">
          Nearby Suppliers ({wholesalers.length})
        </span>
        {#if loading}
          <span class="text-xs text-brand-orange animate-pulse">Updating...</span>
        {/if}
      </div>

      {#if loading && wholesalers.length === 0}
        <div class="space-y-3">
          {#each [1, 2, 3] as _}
            <div class="p-4 bg-app-card border border-app-border rounded-xl animate-pulse space-y-2">
              <div class="h-4 bg-app-border/40 rounded w-2/3"></div>
              <div class="h-3 bg-app-border/30 rounded w-1/2"></div>
              <div class="h-3 bg-app-border/20 rounded w-4/5"></div>
            </div>
          {/each}
        </div>
      {:else if wholesalers.length === 0}
        <div class="p-8 text-center bg-app-card border border-app-border rounded-xl">
          <Truck class="h-8 w-8 text-app-textMuted mx-auto mb-2 opacity-50" />
          <p class="text-sm font-semibold text-app-text mb-1">No Suppliers Found</p>
          <p class="text-xs text-app-textMuted">Try expanding your search radius or changing category filters.</p>
        </div>
      {:else}
        <div class="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {#each wholesalers as w (w._id)}
            <div
              role="button"
              tabindex="0"
              class="p-4 rounded-xl border transition-all text-left group cursor-pointer
                {selectedWholesaler?._id === w._id
                  ? 'bg-brand-orange/5 border-brand-orange shadow-sm'
                  : 'bg-app-card border-app-border hover:border-brand-orange/50 hover:bg-app-cardSubtle'}"
              onclick={() => focusWholesaler(w)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') focusWholesaler(w); }}
            >
              <div class="flex items-start justify-between gap-2 mb-1.5">
                <div>
                  <h4 class="font-heading font-bold text-app-text text-sm group-hover:text-brand-orange transition-colors">
                    {w.companyName}
                  </h4>
                  <p class="text-xs text-app-textMuted flex items-center gap-1 mt-0.5">
                    <MapPin class="h-3 w-3 text-brand-orange shrink-0" />
                    <span>{w.address}{w.city ? `, ${w.city}` : ''}</span>
                  </p>
                </div>

                {#if w.distanceKm !== null}
                  <span class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-orange/10 text-brand-orange">
                    {w.distanceKm} km
                  </span>
                {/if}
              </div>

              <!-- Performance Summary -->
              <div class="flex items-center gap-3 my-2 text-[11px] text-app-textMuted bg-app-cardSubtle px-2.5 py-1.5 rounded-lg border border-app-border/50">
                <span class="flex items-center gap-1 text-emerald-600 font-semibold">
                  <CheckCircle2 class="h-3.5 w-3.5" />
                  {w.performance?.fulfillmentRate || '98%'} Fulfillment
                </span>
                <span>•</span>
                <span>{w.performance?.completedOrders || 0} Delivered Orders</span>
              </div>

              <!-- Categories Supplied -->
              {#if w.categoriesSupplied && w.categoriesSupplied.length > 0}
                <div class="flex flex-wrap gap-1 mt-2 mb-3">
                  {#each w.categoriesSupplied as cat}
                    <span class="text-[10px] px-2 py-0.5 rounded bg-app-card border border-app-border text-app-textMuted">
                      {cat}
                    </span>
                  {/each}
                </div>
              {/if}

              <!-- Actions -->
              <div class="flex items-center justify-between pt-2 border-t border-app-border/40 mt-2">
                <div class="text-[11px] text-app-textMuted flex items-center gap-1">
                  <Phone class="h-3 w-3" />
                  <span>{w.phone || 'Available'}</span>
                </div>

                {#if onSelectSupplier}
                  <button
                    type="button"
                    onclick={(e) => {
                      e.stopPropagation();
                      onSelectSupplier(w);
                    }}
                    class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand-orange text-white hover:bg-brand-orangeHover transition-colors flex items-center gap-1"
                  >
                    <span>Create Request</span>
                    <ExternalLink class="h-3 w-3" />
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
