<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { 
    X, 
    TrendingDown, 
    TrendingUp, 
    Minus, 
    Coins, 
    ArrowDownRight, 
    ArrowUpRight, 
    Calendar, 
    Store,
    AlertCircle,
    CheckCircle2
  } from 'lucide-svelte';

  let { productName, requestId = null, onClose } = $props();

  let priceData = $state(null);
  let loading = $state(true);
  let error = $state('');

  async function fetchPriceHistory() {
    loading = true;
    error = '';
    try {
      let url = `/common/price-history?productName=${encodeURIComponent(productName)}`;
      if (requestId) url += `&requestId=${encodeURIComponent(requestId)}`;
      priceData = await api.get(url);
    } catch (err) {
      console.error('Failed to load price history:', err);
      error = err.message || 'Failed to load price history';
    } finally {
      loading = false;
    }
  }

  function getTrendBadge(trend) {
    if (trend === 'Below historical average') {
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-600',
        border: 'border-emerald-500/20',
        icon: TrendingDown,
        label: 'Below Average (Great Value)',
      };
    }
    if (trend === 'Above historical average') {
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-600',
        border: 'border-rose-500/20',
        icon: TrendingUp,
        label: 'Above Average',
      };
    }
    return {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600',
      border: 'border-amber-500/20',
      icon: Minus,
      label: 'Near Average',
    };
  }

  onMount(() => {
    if (productName) fetchPriceHistory();
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
  <div class="relative w-full max-w-2xl bg-app-card border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
    <!-- Header -->
    <div class="flex items-center justify-between p-5 border-b border-app-border bg-app-cardSubtle">
      <div class="flex items-center space-x-3">
        <div class="p-2.5 rounded-xl bg-brand-orange/10 text-brand-orange">
          <Coins class="h-5 w-5" />
        </div>
        <div>
          <h3 class="font-heading font-bold text-app-text text-base">Purchase Price Intelligence</h3>
          <p class="text-xs text-app-textMuted font-mono">Product: {productName}</p>
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
    <div class="p-6 overflow-y-auto space-y-6 flex-1">
      {#if loading}
        <div class="py-12 flex flex-col items-center justify-center">
          <div class="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin mb-3"></div>
          <p class="text-xs text-app-textMuted">Analyzing historical transaction records...</p>
        </div>
      {:else if error}
        <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs flex items-center gap-2">
          <AlertCircle class="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      {:else if !priceData || !priceData.hasHistory}
        <div class="py-10 text-center bg-app-cardSubtle border border-app-border rounded-xl p-6">
          <Coins class="h-8 w-8 text-app-textMuted mx-auto mb-2 opacity-50" />
          <h4 class="font-heading font-bold text-app-text text-sm mb-1">No Historical Price Data</h4>
          <p class="text-xs text-app-textMuted max-w-sm mx-auto">
            {priceData?.message || 'No previous completed orders found for this product to establish historical price averages.'}
          </p>
        </div>
      {:else}
        <!-- Benchmark Statistics Cards (Feature 2) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="p-3.5 bg-app-cardSubtle border border-app-border rounded-xl">
            <span class="text-[11px] text-app-textMuted block">Historical Avg</span>
            <div class="text-lg font-heading font-extrabold text-app-text mt-0.5">
              ₹{priceData.stats.historicalAverage}
            </div>
            <span class="text-[10px] text-app-textMuted">across {priceData.stats.totalPurchases} orders</span>
          </div>

          <div class="p-3.5 bg-app-cardSubtle border border-app-border rounded-xl">
            <span class="text-[11px] text-app-textMuted block">Lowest Price</span>
            <div class="text-lg font-heading font-extrabold text-emerald-600 mt-0.5">
              ₹{priceData.stats.historicalLowest}
            </div>
            <span class="text-[10px] text-emerald-600 font-semibold">Best historical</span>
          </div>

          <div class="p-3.5 bg-app-cardSubtle border border-app-border rounded-xl">
            <span class="text-[11px] text-app-textMuted block">Highest Price</span>
            <div class="text-lg font-heading font-extrabold text-rose-600 mt-0.5">
              ₹{priceData.stats.historicalHighest}
            </div>
            <span class="text-[10px] text-app-textMuted">Peak market price</span>
          </div>

          <div class="p-3.5 bg-app-cardSubtle border border-app-border rounded-xl">
            <span class="text-[11px] text-app-textMuted block">Last Purchased</span>
            <div class="text-lg font-heading font-extrabold text-brand-orange mt-0.5">
              ₹{priceData.stats.recentPurchasePrice}
            </div>
            <span class="text-[10px] font-semibold text-app-textMuted">
              {priceData.stats.recentTrend}
            </span>
          </div>
        </div>

        <!-- Current Active Quotations Comparison (if available) -->
        {#if priceData.currentQuotations && priceData.currentQuotations.length > 0}
          <div>
            <h4 class="text-xs font-bold text-app-text uppercase tracking-wider mb-2.5">
              Current Quotations vs. Historical Benchmark
            </h4>

            <div class="space-y-2">
              {#each priceData.currentQuotations as q}
                {@const badge = getTrendBadge(q.trend)}
                <div class="p-3 bg-app-card border border-app-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span class="font-bold text-app-text text-xs">{q.wholesalerName}</span>
                    <span class="text-xs text-app-textMuted ml-2">Qty: {q.quantity}</span>
                  </div>

                  <div class="flex items-center gap-3">
                    <div class="text-right">
                      <span class="text-sm font-extrabold text-app-text">₹{q.price}</span>
                      <span class="text-[10px] block {q.percentageVsAverage < 0 ? 'text-emerald-600' : 'text-rose-600'}">
                        {q.percentageVsAverage > 0 ? `+${q.percentageVsAverage}%` : `${q.percentageVsAverage}%`} vs avg
                      </span>
                    </div>

                    <span class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border {badge.bg} {badge.text} {badge.border}">
                      {badge.label}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Chronological Price History Table -->
        <div>
          <h4 class="text-xs font-bold text-app-text uppercase tracking-wider mb-2.5">
            Historical Purchase Records ({priceData.history.length})
          </h4>

          <div class="border border-app-border rounded-xl overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-app-cardSubtle border-b border-app-border text-app-textMuted font-semibold">
                <tr>
                  <th class="p-3">Date</th>
                  <th class="p-3">Supplier</th>
                  <th class="p-3">Quantity</th>
                  <th class="p-3 text-right">Unit Price</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-app-border">
                {#each priceData.history as item}
                  <tr class="hover:bg-app-cardSubtle/50 transition-colors">
                    <td class="p-3 text-app-textMuted flex items-center gap-1.5">
                      <Calendar class="h-3.5 w-3.5 text-brand-orange" />
                      <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </td>
                    <td class="p-3 font-medium text-app-text">{item.wholesalerName}</td>
                    <td class="p-3 text-app-text">{item.quantity} {item.unit || ''}</td>
                    <td class="p-3 text-right font-extrabold text-brand-orange">₹{item.price}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
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
