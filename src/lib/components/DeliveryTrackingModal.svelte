<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { 
    X, 
    Truck, 
    CheckCircle2, 
    Clock, 
    Package, 
    MapPin, 
    Calendar, 
    FileText,
    AlertCircle,
    RotateCw,
    Navigation
  } from 'lucide-svelte';

  let { 
    orderId = null,
    order = null,
    show = $bindable(true),
    onClose = null 
  } = $props();

  let tracking = $state(null);
  let loading = $state(false);
  let error = $state('');

  const activeOrderId = $derived(
    orderId || order?._id || order?.id || (typeof order === 'string' ? order : null)
  );

  const stepOrder = ['accepted', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

  function isStepCompleted(stepKey, currentStatus) {
    const currentIdx = stepOrder.indexOf(currentStatus);
    const stepIdx = stepOrder.indexOf(stepKey);
    return stepIdx !== -1 && currentIdx >= stepIdx;
  }

  function isCurrentStep(stepKey, currentStatus) {
    return stepKey === currentStatus;
  }

  function handleClose() {
    show = false;
    if (onClose) onClose();
  }

  async function fetchTracking() {
    if (!activeOrderId) {
      loading = false;
      error = 'Tracking information is not available yet for this order.';
      return;
    }

    loading = true;
    error = '';

    // Guard with a 10-second timeout so modal never hangs indefinitely
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out while loading delivery details. Please try again.')), 10000)
    );

    try {
      const fetchPromise = api.get(`/orders/${activeOrderId}/tracking`);
      const res = await Promise.race([fetchPromise, timeoutPromise]);
      
      if (res && res.tracking) {
        tracking = res.tracking;
      } else {
        error = 'Tracking information is not available yet.';
      }
    } catch (err) {
      console.error('Failed to load tracking info:', err);
      error = err.message || 'Unable to load real-time delivery details.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (show && activeOrderId) {
      fetchTracking();
    } else if (show && !activeOrderId) {
      loading = false;
      error = 'Tracking information is not available yet.';
    }
  });

  onMount(() => {
    if (show && activeOrderId) {
      fetchTracking();
    }
  });
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
    <div class="relative w-full max-w-2xl bg-app-card border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between p-5 border-b border-app-border bg-app-cardSubtle">
        <div class="flex items-center space-x-3">
          <div class="p-2.5 rounded-xl bg-brand-orange/10 text-brand-orange">
            <Truck class="h-5 w-5" />
          </div>
          <div>
            <h3 class="font-heading font-bold text-app-text text-base">Delivery Tracking</h3>
            <p class="text-xs text-app-textMuted font-mono">
              Order #{activeOrderId ? activeOrderId.toString().slice(-6) : (order?.productName || 'Details')}
            </p>
          </div>
        </div>
        <button 
          type="button" 
          onclick={handleClose}
          aria-label="Close"
          class="p-2 rounded-lg text-app-textMuted hover:text-app-text hover:bg-app-border/40 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto space-y-6 flex-1">
        {#if loading}
          <div class="py-14 flex flex-col items-center justify-center text-center">
            <div class="w-9 h-9 border-3 border-brand-orange border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-xs font-semibold text-app-text">Loading real-time delivery tracking...</p>
            <p class="text-[11px] text-app-textMuted mt-1">Fetching live transit updates from supplier</p>
          </div>
        {:else if error}
          <div class="py-10 flex flex-col items-center justify-center text-center space-y-3">
            <div class="p-3 bg-rose-500/10 text-rose-500 rounded-2xl">
              <AlertCircle class="h-8 w-8" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-app-text">Unable to Load Tracking</h4>
              <p class="text-xs text-app-textMuted mt-1 max-w-sm">{error}</p>
            </div>
            <button 
              type="button"
              onclick={fetchTracking}
              class="px-4 py-2 bg-brand-orange hover:bg-brand-orange/90 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <RotateCw class="h-3.5 w-3.5" />
              <span>Retry Tracking</span>
            </button>
          </div>
        {:else if tracking}
          <!-- Order Summary Card -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-app-cardSubtle rounded-xl border border-app-border text-xs">
            <div>
              <span class="text-app-textMuted block text-[11px]">Product</span>
              <span class="font-bold text-app-text">{tracking.productName}</span>
            </div>
            <div>
              <span class="text-app-textMuted block text-[11px]">Quantity</span>
              <span class="font-bold text-app-text">{tracking.quantity} {tracking.unit}</span>
            </div>
            <div>
              <span class="text-app-textMuted block text-[11px]">Supplier</span>
              <span class="font-bold text-app-text">{tracking.wholesalerCompany}</span>
            </div>
            <div>
              <span class="text-app-textMuted block text-[11px]">Status</span>
              <span class="font-bold uppercase text-brand-orange px-2 py-0.5 rounded bg-brand-orange/10 inline-block mt-0.5">
                {tracking.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <!-- Dates Card -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div class="p-3.5 bg-app-card border border-app-border rounded-xl flex items-center space-x-3">
              <div class="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <Calendar class="h-4 w-4" />
              </div>
              <div>
                <span class="text-app-textMuted text-[11px] block">Expected Delivery</span>
                <span class="font-semibold text-app-text">
                  {tracking.expectedDeliveryDate ? new Date(tracking.expectedDeliveryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Estimated 24-48 hrs'}
                </span>
              </div>
            </div>

            <div class="p-3.5 bg-app-card border border-app-border rounded-xl flex items-center space-x-3">
              <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 class="h-4 w-4" />
              </div>
              <div>
                <span class="text-app-textMuted text-[11px] block">Actual Delivery</span>
                <span class="font-semibold text-app-text">
                  {tracking.actualDeliveryDate ? new Date(tracking.actualDeliveryDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
                </span>
              </div>
            </div>
          </div>

          <!-- Visual Milestone Timeline -->
          <div class="py-2">
            <h4 class="text-xs font-bold text-app-text uppercase tracking-wider mb-4">Milestone Progress</h4>
            
            <div class="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-app-border">
              {#each (tracking.timelineSteps || []) as step}
                {@const completed = isStepCompleted(step.key, tracking.status)}
                {@const current = isCurrentStep(step.key, tracking.status)}
                
                <div class="relative flex items-start space-x-4">
                  <!-- Circle marker -->
                  <div 
                    class="absolute -left-6 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                      {completed 
                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                        : (current ? 'bg-brand-orange border-brand-orange text-white ring-4 ring-brand-orange/20 animate-pulse' : 'bg-app-card border-app-border text-transparent')}"
                  >
                    {#if completed}
                      <CheckCircle2 class="w-3.5 h-3.5" />
                    {/if}
                  </div>

                  <!-- Step info -->
                  <div class="flex-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold {completed || current ? 'text-app-text' : 'text-app-textMuted'}">
                        {step.label}
                      </span>
                      {#if step.timestamp}
                        <span class="text-[11px] text-app-textMuted">
                          {new Date(step.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Delivery Notes -->
          {#if tracking.deliveryNotes}
            <div class="p-3.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs space-y-1">
              <span class="font-bold text-app-text flex items-center gap-1.5">
                <FileText class="h-3.5 w-3.5 text-brand-orange" />
                Delivery Notes from Wholesaler
              </span>
              <p class="text-app-textMuted italic">"{tracking.deliveryNotes}"</p>
            </div>
          {/if}
        {:else}
          <div class="py-12 text-center text-app-textMuted text-xs">
            Tracking information is not available yet.
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-app-border bg-app-cardSubtle flex justify-end">
        <button 
          type="button" 
          onclick={handleClose}
          class="px-4 py-2 text-xs font-semibold rounded-xl bg-app-card border border-app-border text-app-text hover:bg-app-border/40 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
