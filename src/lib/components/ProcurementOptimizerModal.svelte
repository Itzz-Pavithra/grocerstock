<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import {
    Sparkles,
    CheckCircle2,
    Truck,
    Clock,
    TrendingDown,
    ShieldCheck,
    AlertCircle,
    X,
    ChevronRight,
    Coins,
    Layers
  } from 'lucide-svelte';

  let { requestId = null, onClose = () => {}, onAcceptQuotation = () => {} } = $props();

  let loading = $state(true);
  let optimizerData = $state(null);
  let errorMsg = $state('');

  async function loadOptimization() {
    if (!requestId) return;
    loading = true;
    errorMsg = '';
    try {
      const res = await api.get(`/responses/request/${requestId}/optimizer`);
      if (res.success) {
        optimizerData = res;
      } else {
        errorMsg = res.message || 'Unable to optimize procurement strategy.';
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to load procurement optimization.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadOptimization();
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
  <div class="bg-app-card text-app-text rounded-3xl border border-app-border shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
    
    <!-- Header -->
    <div class="p-6 border-b border-app-border flex items-center justify-between bg-app-cardSubtle">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-2xl bg-[#D4A72C]/20 text-[#D4A72C] flex items-center justify-center font-bold">
          <Sparkles class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-lg font-extrabold font-heading text-app-text flex items-center gap-2">
            Smart Procurement Optimizer
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4A72C] text-[#202124] uppercase tracking-wider">
              Decision Support
            </span>
          </h3>
          <p class="text-xs text-app-muted">
            Evaluating single-supplier vs multi-supplier combinations for optimal cost, speed, and logistics.
          </p>
        </div>
      </div>

      <button
        onclick={onClose}
        class="p-2 rounded-xl text-app-muted hover:text-app-text hover:bg-app-card transition-colors"
        aria-label="Close modal"
      >
        <X class="w-5 h-5" />
      </button>
    </div>

    <!-- Body -->
    <div class="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
      {#if loading}
        <div class="py-16 text-center space-y-3">
          <div class="w-10 h-10 mx-auto rounded-full border-3 border-[#D4A72C] border-t-transparent animate-spin"></div>
          <div class="text-xs text-app-muted font-medium">Evaluating wholesale quotations and logistics combinations...</div>
        </div>
      {:else if errorMsg}
        <div class="p-5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-center space-y-2">
          <AlertCircle class="w-6 h-6 text-rose-500 mx-auto" />
          <p class="text-xs font-semibold text-rose-700 dark:text-rose-400">{errorMsg}</p>
        </div>
      {:else if !optimizerData || !optimizerData.hasQuotations}
        <div class="py-12 text-center space-y-2">
          <div class="text-3xl">📦</div>
          <h4 class="text-sm font-bold text-app-text">No Open Quotations Available</h4>
          <p class="text-xs text-app-muted max-w-sm mx-auto">
            Wholesale suppliers have not submitted eligible bids for this request yet. Strategy optimization will activate once bids arrive.
          </p>
        </div>
      {:else}
        <!-- Baseline Reference Banner -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#202124] text-[#F7F5EF] border border-white/10">
          <div>
            <span class="text-[10px] text-[#B9DDE5] uppercase font-bold tracking-wider">Target Procurement</span>
            <div class="text-base font-extrabold mt-0.5">{optimizerData.stockRequest.quantity} {optimizerData.stockRequest.unit}</div>
            <div class="text-[11px] text-[#F7F5EF]/70 truncate">{optimizerData.stockRequest.productName}</div>
          </div>
          <div>
            <span class="text-[10px] text-[#B9DDE5] uppercase font-bold tracking-wider">Market Baseline Cost</span>
            <div class="text-base font-extrabold mt-0.5 text-[#D4A72C]">₹{optimizerData.baselineCost}</div>
            <div class="text-[11px] text-[#F7F5EF]/70">Average of all received bids</div>
          </div>
          <div>
            <span class="text-[10px] text-[#B9DDE5] uppercase font-bold tracking-wider">Recommended Strategy</span>
            <div class="text-base font-extrabold mt-0.5 text-[#B9DDE5] capitalize">
              {optimizerData.recommendedStrategy === 'single' ? 'Single Supplier' : 'Multi-Supplier Split'}
            </div>
            <div class="text-[11px] text-[#F7F5EF]/70">Balanced cost & delivery</div>
          </div>
        </div>

        <!-- Strategy Recommendation Notice -->
        <div class="p-4 rounded-2xl bg-[#D4A72C]/10 border border-[#D4A72C]/30 flex items-start space-x-3">
          <Sparkles class="w-5 h-5 text-[#D4A72C] shrink-0 mt-0.5" />
          <div class="text-xs text-app-text">
            <span class="font-bold text-[#D4A72C]">Recommendation Rationale: </span>
            {optimizerData.recommendationReason}
          </div>
        </div>

        <!-- Comparison Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Option A: Single Supplier -->
          {#if optimizerData.options.singleSupplier}
            {@const opt = optimizerData.options.singleSupplier}
            <div class="p-5 rounded-2xl border-2 {optimizerData.recommendedStrategy === 'single' ? 'border-[#D4A72C] bg-[#D4A72C]/5' : 'border-app-border bg-app-cardSubtle'} space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-app-muted">Option A</span>
                  <h4 class="text-sm font-extrabold text-app-text">{opt.type}</h4>
                </div>
                {#if optimizerData.recommendedStrategy === 'single'}
                  <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-[#D4A72C] text-[#202124]">
                    Recommended
                  </span>
                {/if}
              </div>

              <div class="space-y-2 py-2 border-y border-app-border/70 text-xs">
                <div class="flex justify-between">
                  <span class="text-app-muted">Total Cost:</span>
                  <span class="font-bold text-app-text text-sm">₹{opt.totalCost}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-app-muted">Savings vs Baseline:</span>
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">
                    {opt.savingsVsBaseline > 0 ? `+₹${opt.savingsVsBaseline}` : 'Standard Price'}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-app-muted">Fulfillment:</span>
                  <span class="font-bold text-app-text">{opt.fulfillmentPercent}% (1 shipment)</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-app-muted">Supplier:</span>
                  <span class="font-semibold text-app-text truncate max-w-[160px]">{opt.suppliers[0].companyName}</span>
                </div>
              </div>

              <p class="text-[11px] text-app-muted leading-relaxed">
                {opt.rationale}
              </p>
            </div>
          {/if}

          <!-- Option B: Multi-Supplier Split -->
          {#if optimizerData.options.splitCombination}
            {@const opt = optimizerData.options.splitCombination}
            <div class="p-5 rounded-2xl border-2 {optimizerData.recommendedStrategy === 'split' ? 'border-[#D4A72C] bg-[#D4A72C]/5' : 'border-app-border bg-app-cardSubtle'} space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-app-muted">Option B</span>
                  <h4 class="text-sm font-extrabold text-app-text">{opt.type}</h4>
                </div>
                {#if optimizerData.recommendedStrategy === 'split'}
                  <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-[#D4A72C] text-[#202124]">
                    Recommended
                  </span>
                {/if}
              </div>

              <div class="space-y-2 py-2 border-y border-app-border/70 text-xs">
                <div class="flex justify-between">
                  <span class="text-app-muted">Net Total Cost:</span>
                  <span class="font-bold text-app-text text-sm">₹{opt.netTotalCost}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-app-muted">Product Cost:</span>
                  <span class="font-bold text-app-text">₹{opt.totalProductCost}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-app-muted">Delivery Overhead:</span>
                  <span class="font-bold text-amber-600 dark:text-amber-400">₹{opt.logisticsOverheadEstimate}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-app-muted">Net Savings:</span>
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">
                    {opt.savingsVsBaseline > 0 ? `+₹${opt.savingsVsBaseline}` : '₹0'}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-app-muted">Suppliers Required:</span>
                  <span class="font-bold text-app-text">{opt.suppliersCount} suppliers</span>
                </div>
              </div>

              <!-- Supplier allocation breakdown -->
              <div class="space-y-1.5 pt-1">
                <span class="text-[10px] font-bold text-app-muted uppercase">Allocations:</span>
                {#each opt.suppliers as sup}
                  <div class="p-2 rounded-xl bg-app-card border border-app-border text-[11px] flex justify-between items-center">
                    <span class="font-bold truncate max-w-[140px]">{sup.companyName}</span>
                    <span class="text-app-muted">{sup.assignedQuantity} units @ ₹{sup.unitPrice}</span>
                    <span class="font-extrabold text-[#D4A72C]">₹{sup.subtotal}</span>
                  </div>
                {/each}
              </div>

              <p class="text-[11px] text-app-muted leading-relaxed">
                {opt.rationale}
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="p-4 border-t border-app-border bg-app-cardSubtle flex items-center justify-between">
      <span class="text-[11px] text-app-muted">
        ℹ️ The optimizer provides decision support. Retailers retain 100% control over quotation acceptance.
      </span>
      <button
        onclick={onClose}
        class="px-5 py-2.5 rounded-xl text-xs font-bold bg-app-card border border-app-border hover:bg-app-cardSubtle transition"
      >
        Close
      </button>
    </div>
  </div>
</div>
