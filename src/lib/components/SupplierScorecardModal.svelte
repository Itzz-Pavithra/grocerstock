<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { 
    X, 
    ShieldCheck, 
    Truck, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    Coins, 
    TrendingUp,
    Store,
    Phone,
    MapPin
  } from 'lucide-svelte';

  let { wholesalerId, onClose } = $props();

  let scorecard = $state(null);
  let loading = $state(true);
  let error = $state('');

  async function fetchScorecard() {
    loading = true;
    error = '';
    try {
      const res = await api.get(`/wholesalers/${wholesalerId}/performance`);
      scorecard = res.scorecard;
    } catch (err) {
      console.error('Failed to load supplier performance:', err);
      error = err.message || 'Failed to load supplier scorecard';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (wholesalerId) fetchScorecard();
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
  <div class="relative w-full max-w-xl bg-app-card border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
    <!-- Header -->
    <div class="flex items-center justify-between p-5 border-b border-app-border bg-app-cardSubtle">
      <div class="flex items-center space-x-3">
        <div class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
          <ShieldCheck class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-heading font-bold text-app-text text-base">Supplier Performance Scorecard</h3>
          <p class="text-xs text-app-textMuted">Transparent metrics calculated from real database orders</p>
        </div>
      </div>
      <button 
        type="button" 
        onclick={onClose}
        class="p-2 rounded-lg text-app-textMuted hover:text-app-text hover:bg-app-border/40 transition-colors"
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    <!-- Content -->
    <div class="p-6 overflow-y-auto space-y-5 flex-1">
      {#if loading}
        <div class="py-12 flex flex-col items-center justify-center">
          <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p class="text-xs text-app-textMuted">Evaluating supplier records...</p>
        </div>
      {:else if error}
        <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      {:else if scorecard}
        <!-- Wholesaler Company Card -->
        <div class="p-4 bg-app-cardSubtle border border-app-border rounded-xl text-xs space-y-1">
          <div class="flex items-center justify-between">
            <h4 class="font-heading font-bold text-app-text text-sm">{scorecard.companyName}</h4>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
              Verified Supplier
            </span>
          </div>
          <p class="text-app-textMuted flex items-center gap-1">
            <MapPin class="h-3 w-3 text-brand-orange" />
            <span>{scorecard.address}{scorecard.city ? `, ${scorecard.city}` : ''}</span>
          </p>
          {#if scorecard.phone}
            <p class="text-app-textMuted flex items-center gap-1">
              <Phone class="h-3 w-3" />
              <span>{scorecard.phone}</span>
            </p>
          {/if}
        </div>

        <!-- KPI Metric Grid (Feature 3) -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <!-- Fulfillment Rate -->
          <div class="p-3.5 bg-app-card border border-app-border rounded-xl space-y-1">
            <span class="text-[11px] text-app-textMuted flex items-center gap-1">
              <CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />
              Fulfillment Rate
            </span>
            <div class="text-lg font-heading font-extrabold text-emerald-600">
              {scorecard.metrics.fulfillmentRate}
            </div>
            <span class="text-[10px] text-app-textMuted block">
              {scorecard.metrics.completedOrders} of {scorecard.metrics.totalOrders} fulfilled
            </span>
          </div>

          <!-- On-time Delivery Rate -->
          <div class="p-3.5 bg-app-card border border-app-border rounded-xl space-y-1">
            <span class="text-[11px] text-app-textMuted flex items-center gap-1">
              <Clock class="h-3.5 w-3.5 text-blue-500" />
              On-Time Rate
            </span>
            <div class="text-lg font-heading font-extrabold text-blue-600">
              {scorecard.metrics.onTimeDeliveryRate}
            </div>
            <span class="text-[10px] text-app-textMuted block">
              {scorecard.metrics.onTimeDeliveries || 0} on-time deliveries
            </span>
          </div>

          <!-- Average Delivery Speed -->
          <div class="p-3.5 bg-app-card border border-app-border rounded-xl space-y-1">
            <span class="text-[11px] text-app-textMuted flex items-center gap-1">
              <Truck class="h-3.5 w-3.5 text-brand-orange" />
              Avg Delivery Time
            </span>
            <div class="text-lg font-heading font-extrabold text-app-text">
              {scorecard.metrics.averageDeliveryDays}
            </div>
            <span class="text-[10px] text-app-textMuted block">Order to delivery</span>
          </div>

          <!-- Quotation Response Turnaround -->
          <div class="p-3.5 bg-app-card border border-app-border rounded-xl space-y-1">
            <span class="text-[11px] text-app-textMuted flex items-center gap-1">
              <TrendingUp class="h-3.5 w-3.5 text-purple-500" />
              Response Speed
            </span>
            <div class="text-lg font-heading font-extrabold text-app-text">
              {scorecard.metrics.avgQuotationTurnaroundHours}
            </div>
            <span class="text-[10px] text-app-textMuted block">Average bid response</span>
          </div>

          <!-- Total Orders Delivered -->
          <div class="p-3.5 bg-app-card border border-app-border rounded-xl space-y-1">
            <span class="text-[11px] text-app-textMuted flex items-center gap-1">
              <Store class="h-3.5 w-3.5 text-amber-500" />
              Completed Orders
            </span>
            <div class="text-lg font-heading font-extrabold text-app-text">
              {scorecard.metrics.completedOrders}
            </div>
            <span class="text-[10px] text-app-textMuted block">{scorecard.metrics.cancelledOrders} cancelled</span>
          </div>

          <!-- Total Order Value -->
          <div class="p-3.5 bg-app-card border border-app-border rounded-xl space-y-1">
            <span class="text-[11px] text-app-textMuted flex items-center gap-1">
              <Coins class="h-3.5 w-3.5 text-emerald-500" />
              Total Volume
            </span>
            <div class="text-lg font-heading font-extrabold text-app-text">
              ₹{scorecard.metrics.totalOrderValue.toLocaleString('en-IN')}
            </div>
            <span class="text-[10px] text-app-textMuted block">Completed volume</span>
          </div>
        </div>

        {#if scorecard.message}
          <div class="p-3 rounded-xl bg-app-cardSubtle border border-app-border text-[11px] text-app-textMuted italic text-center">
            {scorecard.message}
          </div>
        {/if}
      {/if}
    </div>

    <!-- Footer -->
    <div class="p-4 border-t border-app-border bg-app-cardSubtle flex justify-end">
      <button 
        type="button" 
        onclick={onClose}
        class="px-4 py-2 text-xs font-semibold rounded-xl bg-app-card border border-app-border text-app-text hover:bg-app-border/40 transition-colors"
      >
        Close
      </button>
    </div>
  </div>
</div>
