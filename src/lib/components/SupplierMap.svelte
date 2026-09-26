<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { api } from '$lib/api.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import { getMapLibre, osmRasterStyle } from '$lib/maplibre.js';
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
    ShieldCheck,
    Clock,
    Route,
    Crosshair,
    X,
    Loader2,
    Package
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

  // Filter & Search States
  let searchQuery = $state('');
  let selectedCategory = $state('');
  let radiusKm = $state(50);
  let selectedWholesaler = $state(null);

  // Location Search State (city / place)
  let placeSearchQuery = $state('');
  let placeSearchResults = $state([]);
  let isSearchingPlaces = $state(false);
  let showPlaceDropdown = $state(false);
  let searchDebounceTimer = null;
  let placeSearchError = $state('');

  // Directions & Routing State
  let activeRoute = $state(null);
  let routeLoading = $state(false);
  let routeError = $state('');

  // Geolocation button state
  let locating = $state(false);
  let locationLabel = $state('Current Map Center');

  // Data States
  let wholesalers = $state([]);
  let loading = $state(true);
  let mapLoading = $state(true);
  let mapError = $state(null);

  // MapTiler API Key (Optional)
  const mapTilerKey = (import.meta.env.VITE_MAPTILER_API_KEY || '').trim();
  const hasMapTilerKey = Boolean(mapTilerKey && mapTilerKey !== 'YOUR_MAPTILER_API_KEY');

  // Center coordinates (Default: Salem / Tamil Nadu 11.6643, 78.1460, or user location if available)
  let currentLat = $state(11.6643);
  let currentLng = $state(78.1460);

  let expandedStockWholesalerId = $state(null);

  $effect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      const uLat = Number(userLocation.latitude);
      const uLng = Number(userLocation.longitude);
      if (uLat !== currentLat || uLng !== currentLng) {
        currentLat = uLat;
        currentLng = uLng;
        locationLabel = userLocation.address || userLocation.city || 'Your Registered Location';
        loadWholesalers();
      }
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

      // Automatically fit bounds so all eligible wholesalers appear on the map
      if (wholesalers.length > 0 && mapInstance && browser) {
        getMapLibre().then(maplibregl => {
          const bounds = new maplibregl.LngLatBounds();
          if (currentLat && currentLng) bounds.extend([currentLng, currentLat]);
          wholesalers.forEach(w => {
            if (w.longitude && w.latitude) bounds.extend([w.longitude, w.latitude]);
          });
          mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 13 });
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load wholesalers:', err);
      toasts.error('Failed to fetch nearby suppliers');
    } finally {
      loading = false;
    }
  }

  // Handle City / Address autocomplete search
  function handlePlaceSearchInput(e) {
    const val = e.target.value;
    placeSearchQuery = val;
    placeSearchError = '';

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    if (!val || val.trim().length < 2) {
      placeSearchResults = [];
      showPlaceDropdown = false;
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      isSearchingPlaces = true;
      try {
        const res = await api.get(`/location/search?q=${encodeURIComponent(val.trim())}`);
        if (res.success && Array.isArray(res.data)) {
          placeSearchResults = res.data;
          showPlaceDropdown = res.data.length > 0;
          if (res.data.length === 0) {
            placeSearchError = 'No locations found. Try a different city or place.';
          }
        } else {
          placeSearchResults = [];
          showPlaceDropdown = false;
        }
      } catch (err) {
        console.error('Location search failed:', err);
        placeSearchError = 'Network error searching location. Please retry.';
      } finally {
        isSearchingPlaces = false;
      }
    }, 350);
  }

  function selectSearchedPlace(place) {
    currentLat = Number(place.latitude);
    currentLng = Number(place.longitude);
    locationLabel = place.formattedAddress || place.name;
    placeSearchQuery = place.name;
    showPlaceDropdown = false;
    placeSearchResults = [];

    if (mapInstance) {
      mapInstance.flyTo({
        center: [currentLng, currentLat],
        zoom: 12,
        essential: true
      });
      renderUserMarker();
    }

    clearRoute();
    loadWholesalers();
    toasts.success(`Centered on ${place.name}`);
  }

  // Handle Device Geolocation
  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      toasts.error('Geolocation is not supported by your browser. Please search for your city manually.');
      return;
    }

    locating = true;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        locating = false;
        currentLat = Number(pos.coords.latitude.toFixed(6));
        currentLng = Number(pos.coords.longitude.toFixed(6));

        try {
          const revRes = await api.get(`/location/reverse?lat=${currentLat}&lng=${currentLng}`);
          if (revRes.success && revRes.data) {
            locationLabel = revRes.data.formattedAddress || revRes.data.city || 'Current Device Location';
            placeSearchQuery = revRes.data.city || revRes.data.formattedAddress || '';
          } else {
            locationLabel = 'Current Device Location';
          }
        } catch {
          locationLabel = 'Current Device Location';
        }

        if (mapInstance) {
          mapInstance.flyTo({
            center: [currentLng, currentLat],
            zoom: 13,
            essential: true
          });
          renderUserMarker();
        }

        clearRoute();
        loadWholesalers();
        toasts.success('Location updated from device GPS');
      },
      (err) => {
        locating = false;
        console.warn('Geolocation error:', err);
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function initMap() {
    if (!browser || !mapContainer) {
      mapLoading = false;
      return;
    }

    try {
      const maplibregl = await getMapLibre();

      const mapStyle = hasMapTilerKey
        ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`
        : osmRasterStyle;

      mapInstance = new maplibregl.Map({
        container: mapContainer,
        style: mapStyle,
        center: [currentLng, currentLat],
        zoom: 11,
        attributionControl: false,
      });

      mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

      mapInstance.on('load', () => {
        mapLoading = false;
        mapError = null;
        if (mapInstance) {
          mapInstance.resize();
        }
        renderUserMarker();
        updateMapMarkers();
      });

      mapInstance.on('error', (e) => {
        console.warn('MapLibre error:', e);
        // If MapTiler failed, fallback to OSM
        if (hasMapTilerKey && mapInstance && mapInstance.setStyle) {
          try {
            mapInstance.setStyle(osmRasterStyle);
          } catch {
            mapError = 'Map tiles could not be loaded.';
          }
        }
      });

      // Allow retailer to click on map to reposition search center
      mapInstance.on('click', async (e) => {
        // Ignore if clicking on a marker
        if (e.originalEvent && e.originalEvent.target && e.originalEvent.target.closest('.mapboxgl-marker, .maplibregl-marker')) {
          return;
        }

        const { lng, lat } = e.lngLat;
        currentLng = Number(lng.toFixed(6));
        currentLat = Number(lat.toFixed(6));
        locationLabel = `${currentLat}, ${currentLng}`;

        renderUserMarker();
        clearRoute();
        loadWholesalers();

        try {
          const revRes = await api.get(`/location/reverse?lat=${currentLat}&lng=${currentLng}`);
          if (revRes.success && revRes.data) {
            locationLabel = revRes.data.formattedAddress || revRes.data.city || locationLabel;
          }
        } catch {
          // Keep coordinate label
        }
      });
    } catch (err) {
      console.error('Map initialization failed:', err);
      mapError = err.message || 'Map failed to load';
      mapLoading = false;
    }
  }

  async function renderUserMarker() {
    if (!mapInstance || !browser) return;
    if (userMarker) userMarker.remove();

    try {
      const maplibregl = await getMapLibre();

      const el = document.createElement('div');
      el.className = 'user-pin flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-lg text-white';
      el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

      userMarker = new maplibregl.Marker({ element: el })
        .setLngLat([currentLng, currentLat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div style="font-family: inherit; padding: 4px;">
              <div style="font-weight: 700; color: #1e40af;">📍 Your Search Center</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${locationLabel}</div>
            </div>
          `)
        )
        .addTo(mapInstance);
    } catch (err) {
      console.warn('Failed to render user marker:', err);
    }
  }

  async function updateMapMarkers() {
    if (!mapInstance || !browser) return;

    try {
      const maplibregl = await getMapLibre();

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
          const deliveryStatusHtml = w.deliveryStatus
            ? `<div style="font-size: 11px; font-weight: 600; color: ${w.isDeliveryAvailable ? '#047857' : '#b45309'}; margin-bottom: 4px;">
                ${w.isDeliveryAvailable ? '✓ Delivery Available' : '⚠ Outside Delivery Area'} (${w.deliveryRadiusKm || 25} km radius)
               </div>`
            : '';

          const stockHtml = (w.availableStock && w.availableStock.length > 0)
            ? `<div style="font-size: 11px; color: #334155; margin-top: 6px; padding-top: 5px; border-top: 1px dashed #cbd5e1;">
                <b style="color: #0f172a;">Live Stock:</b>
                <div style="margin-top: 2px; color: #475569;">
                  ${w.availableStock.slice(0, 3).map(s => `${s.productName} - ${s.quantity} ${s.unit}`).join('<br/>')}
                  ${w.availableStock.length > 3 ? `<span style="font-size: 10px; color: #94a3b8;">+${w.availableStock.length - 3} more</span>` : ''}
                </div>
               </div>`
            : '';

          const popupContent = `
            <div style="font-family: inherit; min-width: 210px; padding: 6px;">
              <div style="font-weight: 700; font-size: 14px; color: #1e293b; margin-bottom: 2px;">${w.companyName}</div>
              <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">📍 ${w.address || ''}${w.city ? `, ${w.city}` : ''}</div>
              ${distanceTag ? `<div style="font-size: 11px; color: #FD6F2F; margin-bottom: 4px;">🚗 ${distanceTag}</div>` : ''}
              ${deliveryStatusHtml}
              <div style="font-size: 11px; color: #047857; font-weight: 600; margin-bottom: 4px;">
                ✓ Fulfillment: ${w.performance?.fulfillmentRate || '98%'} (${w.performance?.completedOrders || 0} orders)
              </div>
              ${stockHtml}
              <div style="display: flex; gap: 6px; margin-top: 8px;">
                <a 
                  href="https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${w.latitude},${w.longitude}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style="background: #2563eb; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"
                >
                  Maps ↗
                </a>
              </div>
            </div>
          `;

          const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupContent);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([w.longitude, w.latitude])
            .setPopup(popup)
            .addTo(mapInstance);

          el.addEventListener('click', () => {
            focusWholesaler(w);
          });

          markers.push(marker);
        }
      });
    } catch (err) {
      console.warn('Failed to update map markers:', err);
    }
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

  // Real Road Directions (OSRM / Routing API)
  async function getDirections(w) {
    if (!w || !w.latitude || !w.longitude) {
      toasts.error('Directions are unavailable because this wholesaler has not saved a valid location.');
      return;
    }
    if (!currentLat || !currentLng || isNaN(currentLat) || isNaN(currentLng)) {
      toasts.error('Directions are unavailable because your starting location is not set. Please click on the map or use your device location.');
      return;
    }

    selectedWholesaler = w;
    routeLoading = true;
    routeError = '';

    try {
      const res = await api.get(
        `/directions?startLat=${currentLat}&startLng=${currentLng}&endLat=${w.latitude}&endLng=${w.longitude}`
      );

      if (!res.success || !res.route) {
        throw new Error(res.message || 'Route could not be calculated');
      }

      activeRoute = {
        distanceKm: res.distanceKm,
        durationMin: res.durationMin,
        startAddress: locationLabel,
        wholesaler: w,
        routeGeometry: res.route.geometry,
      };

      // Render route line on MapLibre
      if (mapInstance && browser) {
        const maplibregl = await getMapLibre();

        // Add or update source
        if (mapInstance.getSource('route-source')) {
          mapInstance.getSource('route-source').setData(res.route);
        } else {
          mapInstance.addSource('route-source', {
            type: 'geojson',
            data: res.route,
          });

          mapInstance.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#2563eb',
              'line-width': 5,
              'line-opacity': 0.85,
            },
          });
        }

        // Fit map bounds to contain both origin and destination
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([currentLng, currentLat]);
        bounds.extend([w.longitude, w.latitude]);
        if (res.route.geometry && Array.isArray(res.route.geometry.coordinates)) {
          res.route.geometry.coordinates.forEach(coord => bounds.extend(coord));
        }

        mapInstance.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      }

      toasts.success(`Route calculated: ${res.distanceKm} km (${res.durationMin} mins)`);
    } catch (err) {
      console.error('Directions error:', err);
      routeError = err.message || 'Unable to retrieve road directions';
      toasts.error(routeError);
    } finally {
      routeLoading = false;
    }
  }

  function clearRoute() {
    activeRoute = null;
    routeError = '';
    if (mapInstance) {
      if (mapInstance.getLayer('route-line')) {
        mapInstance.removeLayer('route-line');
      }
      if (mapInstance.getSource('route-source')) {
        mapInstance.removeSource('route-source');
      }
    }
  }

  onMount(() => {
    loadWholesalers();
    initMap();
  });

  onDestroy(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });
</script>

<div class="space-y-4">
  <!-- Top Bar: Location Search, Geolocation, Filters -->
  <div class="bg-app-card border border-app-border rounded-2xl p-4 shadow-sm space-y-3">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="flex items-center space-x-3">
        <div class="p-2.5 rounded-xl bg-brand-orange/10 text-brand-orange">
          <MapPin class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-heading font-bold text-app-text text-base">Find Nearby Wholesalers</h3>
          <p class="text-xs text-app-textMuted flex items-center gap-1.5 mt-0.5">
            <span>Center:</span>
            <span class="font-medium text-app-text truncate max-w-[280px]" title={locationLabel}>{locationLabel}</span>
          </p>
        </div>
      </div>

      <!-- Action Buttons: My Location & Radius -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onclick={requestCurrentLocation}
          disabled={locating}
          class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 transition disabled:opacity-50"
          title="Use GPS to set your search location"
        >
          {#if locating}
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            <span>Locating...</span>
          {:else}
            <Crosshair class="h-3.5 w-3.5" />
            <span>Use My Location</span>
          {/if}
        </button>

        <!-- Radius Selector -->
        <div class="flex items-center space-x-1.5 bg-app-cardSubtle px-2.5 py-1.5 border border-app-border rounded-lg text-xs text-app-text">
          <SlidersHorizontal class="h-3.5 w-3.5 text-brand-orange" />
          <span>Radius:</span>
          <select 
            bind:value={radiusKm} 
            onchange={() => loadWholesalers()}
            class="bg-transparent font-semibold text-brand-orange focus:outline-none cursor-pointer"
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Second Row: City / Place Search Bar & Category Filter -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 border-t border-app-border">
      <!-- Search Place / City Input -->
      <div class="md:col-span-6 relative">
        <div class="relative">
          <Search class="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-app-textMuted" />
          <input
            type="text"
            value={placeSearchQuery}
            oninput={handlePlaceSearchInput}
            onfocus={() => { if (placeSearchResults.length > 0) showPlaceDropdown = true; }}
            placeholder="Search city, town or locality (e.g. Salem, Chennai)..."
            class="w-full pl-8 pr-8 py-2 text-xs bg-app-cardSubtle border border-app-border rounded-lg text-app-text focus:outline-none focus:border-brand-orange"
          />
          {#if isSearchingPlaces}
            <Loader2 class="h-3.5 w-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-brand-orange" />
          {:else if placeSearchQuery}
            <button
              type="button"
              onclick={() => { placeSearchQuery = ''; placeSearchResults = []; showPlaceDropdown = false; }}
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-textMuted hover:text-app-text"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          {/if}
        </div>

        <!-- Autocomplete Suggestions Dropdown -->
        {#if showPlaceDropdown && placeSearchResults.length > 0}
          <div class="absolute left-0 right-0 top-full mt-1 bg-app-card border border-app-border rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-app-border">
            {#each placeSearchResults as place}
              <button
                type="button"
                class="w-full text-left p-2.5 hover:bg-app-cardSubtle text-xs transition flex items-start space-x-2"
                onclick={() => selectSearchedPlace(place)}
              >
                <MapPin class="h-3.5 w-3.5 text-brand-orange shrink-0 mt-0.5" />
                <div class="truncate">
                  <span class="font-semibold text-app-text block truncate">{place.name}</span>
                  <span class="text-[11px] text-app-textMuted truncate block">{place.formattedAddress}</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Supplier / Product Keyword Search -->
      <div class="md:col-span-3 relative">
        <input
          type="text"
          bind:value={searchQuery}
          oninput={() => loadWholesalers()}
          placeholder="Filter supplier name..."
          class="w-full px-3 py-2 text-xs bg-app-cardSubtle border border-app-border rounded-lg text-app-text focus:outline-none focus:border-brand-orange"
        />
      </div>

      <!-- Category Filter -->
      <div class="md:col-span-3">
        <select
          bind:value={selectedCategory}
          onchange={() => loadWholesalers()}
          class="w-full px-3 py-2 text-xs bg-app-cardSubtle border border-app-border rounded-lg text-app-text focus:outline-none focus:border-brand-orange"
        >
          <option value="">All Categories</option>
          {#each categories as cat}
            <option value={cat.name}>{cat.name}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Active Route Banner (When Directions are open) -->
  {#if activeRoute}
    <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
      <div class="flex items-start space-x-3">
        <div class="p-2.5 rounded-xl bg-blue-600 text-white shrink-0">
          <Route class="h-5 w-5" />
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Active Road Route</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
              {activeRoute.distanceKm} km
            </span>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 flex items-center gap-1">
              <Clock class="h-3 w-3" />
              ~{activeRoute.durationMin} mins
            </span>
          </div>
          <p class="text-xs text-app-textMuted mt-1">
            <b>From:</b> {activeRoute.startAddress} <br />
            <b>To:</b> {activeRoute.wholesaler.companyName} ({activeRoute.wholesaler.address || ''}, {activeRoute.wholesaler.city || ''})
          </p>
        </div>
      </div>

      <div class="flex items-center space-x-2 shrink-0">
        <a
          href="https://www.google.com/maps/dir/?api=1&origin={currentLat},{currentLng}&destination={activeRoute.wholesaler.latitude},{activeRoute.wholesaler.longitude}"
          target="_blank"
          rel="noopener noreferrer"
          class="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-1.5"
        >
          <span>Open in Google Maps</span>
          <ExternalLink class="h-3.5 w-3.5" />
        </a>
        <button
          type="button"
          onclick={clearRoute}
          class="p-1.5 text-app-textMuted hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
          title="Clear Route"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>
  {/if}

  <!-- Map and Supplier Split View -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <!-- Map Container (7 columns) -->
    <div class="lg:col-span-7 bg-app-card border border-app-border rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[440px] relative">
      {#if mapLoading}
        <div class="absolute inset-0 bg-app-card/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
          <div class="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin mb-2"></div>
          <p class="text-xs font-medium text-app-textMuted">Loading interactive map...</p>
        </div>
      {/if}

      {#if mapError}
        <div class="absolute inset-0 bg-app-card z-10 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle class="h-8 w-8 text-rose-500 mb-2" />
          <p class="text-sm font-semibold text-app-text mb-1">Map Notice</p>
          <p class="text-xs text-app-textMuted max-w-sm mb-3">{mapError}</p>
          <button
            type="button"
            onclick={() => initMap()}
            class="px-3 py-1 text-xs font-semibold rounded-lg bg-brand-orange text-white"
          >
            Retry Map
          </button>
        </div>
      {/if}

      <div bind:this={mapContainer} class="w-full h-full min-h-[460px] flex-1"></div>

      <!-- Map Footer Bar -->
      <div class="p-2.5 bg-app-card border-t border-app-border text-[11px] text-app-textMuted flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center space-x-3">
          <div class="flex items-center space-x-1">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <span>Your Search Point</span>
          </div>
          <div class="flex items-center space-x-1">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-brand-orange"></span>
            <span>Wholesalers</span>
          </div>
        </div>
        <span>Click map to relocate search center</span>
      </div>
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
          <p class="text-xs text-app-textMuted">
            No wholesalers found within {radiusKm} km of this location. Try expanding the radius or search another city like Salem or Chennai.
          </p>
        </div>
      {:else}
        <div class="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
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
                    <span>{w.address || 'Address on file'}{w.city ? `, ${w.city}` : ''}</span>
                  </p>
                </div>

                {#if w.distanceKm !== null}
                  <span class="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-orange/10 text-brand-orange">
                    {w.distanceKm} km
                  </span>
                {/if}
              </div>

              <!-- Delivery Radius & Proximity Status -->
              <div class="flex flex-wrap items-center gap-2 mb-2">
                {#if w.deliveryStatus}
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1
                    {w.isDeliveryAvailable 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}">
                    <Truck class="h-3 w-3" />
                    <span>{w.deliveryStatus} ({w.deliveryRadiusKm || 25} km radius)</span>
                  </span>
                {/if}
              </div>

              <!-- Available Live Stock -->
              {#if w.availableStock && w.availableStock.length > 0}
                <div class="p-2.5 rounded-lg bg-app-cardSubtle border border-app-border/60 my-2">
                  <div class="flex items-center justify-between mb-1.5">
                    <div class="text-[11px] font-bold text-app-text flex items-center gap-1.5">
                      <Package class="h-3.5 w-3.5 text-brand-orange" />
                      <span>Available Stock ({w.availableStock.length}):</span>
                    </div>
                    {#if w.availableStock.length > 4}
                      <button
                        type="button"
                        onclick={(e) => {
                          e.stopPropagation();
                          expandedStockWholesalerId = expandedStockWholesalerId === w._id ? null : w._id;
                        }}
                        class="text-[10px] text-brand-orange font-semibold hover:underline"
                      >
                        {expandedStockWholesalerId === w._id ? 'Show less' : `View all (${w.availableStock.length})`}
                      </button>
                    {/if}
                  </div>
                  <div class="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                    {#each (expandedStockWholesalerId === w._id ? w.availableStock : w.availableStock.slice(0, 4)) as stockItem}
                      <span class="px-2 py-0.5 rounded text-[11px] font-medium bg-app-card border border-app-border text-app-text flex items-center gap-1">
                        <b class="text-brand-orange">{stockItem.productName}</b>
                        <span class="text-app-textMuted">• {stockItem.quantity} {stockItem.unit}</span>
                        {#if stockItem.unitPrice}
                          <span class="text-emerald-600 font-bold">₹{stockItem.unitPrice}</span>
                        {/if}
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Performance Summary -->
              <div class="flex items-center gap-3 my-2 text-[11px] text-app-textMuted bg-app-cardSubtle px-2.5 py-1.5 rounded-lg border border-app-border/50">
                <span class="flex items-center gap-1 text-emerald-600 font-semibold">
                  <CheckCircle2 class="h-3.5 w-3.5" />
                  {w.performance?.fulfillmentRate || '98%'} Fulfillment
                </span>
                <span>•</span>
                <span>{w.performance?.completedOrders || 0} Delivered</span>
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

              <!-- Actions Strip: Directions, Google Maps, Create Request -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-app-border/40 mt-2">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    onclick={(e) => {
                      e.stopPropagation();
                      getDirections(w);
                    }}
                    disabled={routeLoading && selectedWholesaler?._id === w._id}
                    class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    {#if routeLoading && selectedWholesaler?._id === w._id}
                      <Loader2 class="h-3 w-3 animate-spin" />
                      <span>Routing...</span>
                    {:else}
                      <Route class="h-3 w-3" />
                      <span>Get Directions</span>
                    {/if}
                  </button>

                  <a
                    href="https://www.google.com/maps/dir/?api=1&origin={currentLat},{currentLng}&destination={w.latitude},{w.longitude}"
                    target="_blank"
                    rel="noopener noreferrer"
                    onclick={(e) => e.stopPropagation()}
                    class="p-1 text-app-textMuted hover:text-blue-600 rounded"
                    title="Open Navigation in Google Maps"
                  >
                    <ExternalLink class="h-3.5 w-3.5" />
                  </a>
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
