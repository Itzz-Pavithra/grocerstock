<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import { auth } from '$lib/auth.svelte.js';
  import {
    Layers,
    Plus,
    Users,
    Clock,
    Tag,
    ChevronRight,
    CheckCircle2,
    X,
    Send,
    AlertCircle,
    TrendingDown,
    Building2,
    Calendar
  } from 'lucide-svelte';

  let { role = 'retailer' } = $props();

  let loading = $state(true);
  let groupBuys = $state([]);
  let activeFilter = $state('all'); // 'all' | 'my' | 'open'

  // Create Modal State
  let showCreateModal = $state(false);
  let createTitle = $state('');
  let createProduct = $state('');
  let createCategory = $state('Pantry Staples');
  let createUnit = $state('kg');
  let createTarget = $state(200);
  let createDeadline = $state('');
  let createInitialCommitment = $state(50);
  let createLoading = $state(false);

  // Join Modal State
  let selectedGroupBuy = $state(null);
  let showJoinModal = $state(false);
  let joinQuantity = $state(25);
  let joinLoading = $state(false);

  // Wholesaler Bulk Offer Modal State
  let showOfferModal = $state(false);
  let offerPrice = $state(0);
  let offerMinQty = $state(100);
  let offerDelivery = $state('24-48 hours');
  let offerLoading = $state(false);

  async function loadGroupBuys() {
    loading = true;
    try {
      const res = await api.get('/group-buy');
      if (res.success) {
        groupBuys = res.groupBuys || [];
      }
    } catch (err) {
      toasts.error('Failed to load group buying pools');
    } finally {
      loading = false;
    }
  }

  async function handleCreateGroupBuy(e) {
    e.preventDefault();
    if (!createTitle || !createProduct || createTarget < 2 || !createDeadline) {
      toasts.error('Please complete all required fields.');
      return;
    }

    createLoading = true;
    try {
      await api.post('/group-buy', {
        title: createTitle,
        productName: createProduct,
        category: createCategory,
        unit: createUnit,
        targetMinQuantity: Number(createTarget),
        joiningDeadline: createDeadline,
        initialCommitment: Number(createInitialCommitment),
        discountTiers: [
          { minQuantity: Math.round(createTarget * 0.5), indicativeDiscountPercent: 5 },
          { minQuantity: Number(createTarget), indicativeDiscountPercent: 10 },
          { minQuantity: Math.round(createTarget * 2), indicativeDiscountPercent: 15 },
        ]
      });

      toasts.success('Group buying pool created successfully!');
      showCreateModal = false;
      createTitle = '';
      createProduct = '';
      loadGroupBuys();
    } catch (err) {
      toasts.error(err.message || 'Failed to create group buy');
    } finally {
      createLoading = false;
    }
  }

  async function handleJoinGroupBuy(e) {
    e.preventDefault();
    if (!selectedGroupBuy || joinQuantity < 1) return;

    joinLoading = true;
    try {
      await api.post(`/group-buy/${selectedGroupBuy._id}/join`, {
        committedQuantity: Number(joinQuantity)
      });
      toasts.success(`Committed ${joinQuantity} ${selectedGroupBuy.unit} to the pool!`);
      showJoinModal = false;
      loadGroupBuys();
    } catch (err) {
      toasts.error(err.message || 'Failed to join group buy');
    } finally {
      joinLoading = false;
    }
  }

  async function handleWithdraw(gbId) {
    try {
      await api.post(`/group-buy/${gbId}/withdraw`, {});
      toasts.info('Your commitment has been withdrawn.');
      loadGroupBuys();
    } catch (err) {
      toasts.error(err.message || 'Failed to withdraw commitment');
    }
  }

  async function handleSubmitBulkOffer(e) {
    e.preventDefault();
    if (!selectedGroupBuy || offerPrice <= 0) return;

    offerLoading = true;
    try {
      await api.post(`/group-buy/${selectedGroupBuy._id}/offer`, {
        offeredPricePerUnit: Number(offerPrice),
        minRequiredQuantity: Number(offerMinQty),
        deliveryEstimate: offerDelivery
      });
      toasts.success('Wholesale bulk offer submitted successfully!');
      showOfferModal = false;
      loadGroupBuys();
    } catch (err) {
      toasts.error(err.message || 'Failed to submit bulk offer');
    } finally {
      offerLoading = false;
    }
  }

  async function handleAwardOffer(gbId, offerId) {
    try {
      await api.post(`/group-buy/${gbId}/award/${offerId}`, {});
      toasts.success('Supplier offer awarded! Participating stores notified.');
      loadGroupBuys();
    } catch (err) {
      toasts.error(err.message || 'Failed to award offer');
    }
  }

  onMount(() => {
    // Default deadline to 5 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 5);
    createDeadline = targetDate.toISOString().slice(0, 16);

    loadGroupBuys();
  });
</script>

<div class="space-y-6">
  <!-- Top Banner & Controls -->
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border">
    <div>
      <div class="flex items-center space-x-2 text-xs font-bold text-[#D4A72C] uppercase tracking-wider">
        <Layers class="w-4 h-4" />
        <span>Hyperlocal Collective Procurement</span>
      </div>
      <h2 class="text-xl sm:text-2xl font-extrabold font-heading text-app-text mt-1">
        Group Buying Pools
      </h2>
      <p class="text-xs text-app-muted mt-1 max-w-xl">
        Collaborate with nearby grocery retailers to aggregate volume for key bulk staples, unlocking tier discounts directly from wholesale suppliers.
      </p>
    </div>

    {#if role === 'retailer'}
      <button
        onclick={() => showCreateModal = true}
        type="button"
        class="px-5 py-3 rounded-2xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] text-xs font-bold shadow-md glow-mustard flex items-center space-x-2 shrink-0 transition"
      >
        <Plus class="w-4 h-4" />
        <span>Create Group Pool</span>
      </button>
    {/if}
  </div>

  <!-- Cards Grid -->
  {#if loading}
    <div class="py-16 text-center space-y-3">
      <div class="w-10 h-10 mx-auto rounded-full border-3 border-[#D4A72C] border-t-transparent animate-spin"></div>
      <div class="text-xs text-app-muted font-medium">Loading hyperlocal group buying campaigns...</div>
    </div>
  {:else if groupBuys.length === 0}
    <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-3">
      <div class="w-14 h-14 mx-auto rounded-3xl bg-[#D4A72C]/15 text-[#D4A72C] flex items-center justify-center text-2xl font-black">
        <Layers class="w-7 h-7" />
      </div>
      <h3 class="text-base font-extrabold text-app-text">No Active Group Pools</h3>
      <p class="text-xs text-app-muted max-w-sm mx-auto">
        No active group pools in your area. Start the first campaign to pool orders with neighboring grocery stores!
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      {#each groupBuys as gb (gb._id)}
        {@const progressPct = Math.min(100, Math.round((gb.currentCommittedQuantity / gb.targetMinQuantity) * 100))}
        {@const isTargetReached = gb.currentCommittedQuantity >= gb.targetMinQuantity}
        {@const activeParticipantsCount = gb.participants.filter(p => p.status === 'committed').length}

        <div class="bg-app-card rounded-3xl p-6 border border-app-border shadow-sm flex flex-col justify-between space-y-5 hover:border-[#D4A72C]/40 transition-all">
          <div>
            <!-- Top Tag row -->
            <div class="flex items-center justify-between pb-3 border-b border-app-border/70">
              <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full {isTargetReached ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-[#D4A72C]/15 text-[#D4A72C]'}">
                {isTargetReached ? '✓ Target Reached' : 'Open for Joining'}
              </span>
              <span class="text-xs text-app-muted flex items-center gap-1">
                <Clock class="w-3.5 h-3.5" />
                <span class="text-[11px]">Ends {new Date(gb.joiningDeadline).toLocaleDateString()}</span>
              </span>
            </div>

            <!-- Title & Product -->
            <div class="mt-3">
              <h3 class="text-base font-extrabold text-app-text font-heading">{gb.title}</h3>
              <div class="text-xs text-[#D4A72C] font-bold mt-0.5">
                {gb.productName} ({gb.category})
              </div>
              <div class="text-[11px] text-app-muted mt-0.5">
                Created by {gb.creatorStoreName} • {gb.city || 'Local area'}
              </div>
            </div>

            <!-- Volume Progress Bar -->
            <div class="mt-4 p-3.5 rounded-2xl bg-app-cardSubtle border border-app-border space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-app-muted font-medium">Pool Progress:</span>
                <span class="font-extrabold text-app-text">{gb.currentCommittedQuantity} / {gb.targetMinQuantity} {gb.unit}</span>
              </div>
              <div class="w-full bg-app-border h-2 rounded-full overflow-hidden">
                <div class="bg-[#D4A72C] h-full rounded-full transition-all duration-500" style="width: {progressPct}%"></div>
              </div>
              <div class="flex justify-between text-[10px] text-app-muted">
                <span>{progressPct}% committed</span>
                <span>{activeParticipantsCount} stores joined</span>
              </div>
            </div>

            <!-- My Commitment Status (if retailer) -->
            {#if gb.myCommitment}
              <div class="mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs flex justify-between items-center">
                <div>
                  <span class="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Your Commitment:</span>
                  <div class="font-extrabold text-emerald-900 dark:text-emerald-100">{gb.myCommitment.committedQuantity} {gb.unit}</div>
                </div>
                {#if gb.status !== 'awarded'}
                  <button
                    onclick={() => handleWithdraw(gb._id)}
                    class="text-[11px] text-rose-500 hover:text-rose-600 font-bold hover:underline"
                  >
                    Withdraw
                  </button>
                {/if}
              </div>
            {/if}

            <!-- Supplier Offers Section -->
            {#if gb.supplierOffers && gb.supplierOffers.length > 0}
              <div class="mt-3 pt-3 border-t border-app-border/70 space-y-2">
                <div class="text-[10px] font-extrabold uppercase text-app-muted tracking-wider">
                  Supplier Bulk Offers ({gb.supplierOffers.length}):
                </div>
                {#each gb.supplierOffers as offer}
                  <div class="p-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-xs flex justify-between items-center">
                    <div>
                      <span class="font-bold text-app-text">{offer.companyName}</span>
                      <div class="text-[11px] text-app-muted">{offer.deliveryEstimate}</div>
                    </div>
                    <div class="text-right">
                      <div class="font-extrabold text-[#D4A72C]">₹{offer.offeredPricePerUnit}/{gb.unit}</div>
                      {#if gb.isCreator && gb.status !== 'awarded'}
                        <button
                          onclick={() => handleAwardOffer(gb._id, offer._id)}
                          class="text-[10px] font-bold text-emerald-600 hover:underline"
                        >
                          Award Pool
                        </button>
                      {:else if offer.status === 'accepted'}
                        <span class="text-[10px] font-bold text-emerald-600">✓ Awarded</span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Bottom Actions -->
          <div class="pt-2 flex items-center justify-end gap-2">
            {#if role === 'retailer'}
              {#if !gb.myCommitment && ['open', 'target_reached'].includes(gb.status)}
                <button
                  onclick={() => { selectedGroupBuy = gb; joinQuantity = 25; showJoinModal = true; }}
                  type="button"
                  class="px-5 py-2.5 rounded-xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] text-xs font-bold transition shadow-sm"
                >
                  Join Pool
                </button>
              {/if}
            {:else if role === 'wholesaler'}
              <button
                onclick={() => { selectedGroupBuy = gb; offerPrice = 50; showOfferModal = true; }}
                type="button"
                class="px-5 py-2.5 rounded-xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] text-xs font-bold transition shadow-sm"
              >
                Submit Bulk Offer
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Modal: Create Group Buy -->
{#if showCreateModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
    <div class="bg-app-card text-app-text rounded-3xl border border-app-border shadow-2xl max-w-lg w-full p-6 space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-app-border">
        <h3 class="text-base font-extrabold font-heading text-app-text">Create Group Buying Pool</h3>
        <button onclick={() => showCreateModal = false} class="text-app-muted hover:text-app-text">✕</button>
      </div>

      <form onsubmit={handleCreateGroupBuy} class="space-y-3.5 text-xs">
        <div>
          <label for="gb-title" class="block font-bold text-app-muted mb-1">Campaign Title *</label>
          <input
            id="gb-title"
            type="text"
            bind:value={createTitle}
            placeholder="e.g. Indiranagar Rice Bulk Procurement"
            class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none focus:border-[#D4A72C]"
            required
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="gb-product" class="block font-bold text-app-muted mb-1">Product Name *</label>
            <input
              id="gb-product"
              type="text"
              bind:value={createProduct}
              placeholder="e.g. Sona Masoori Rice"
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none focus:border-[#D4A72C]"
              required
            />
          </div>
          <div>
            <label for="gb-category" class="block font-bold text-app-muted mb-1">Category *</label>
            <select
              id="gb-category"
              bind:value={createCategory}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
            >
              <option value="Pantry Staples">Pantry Staples</option>
              <option value="Dairy & Eggs">Dairy & Eggs</option>
              <option value="Fruits & Vegetables">Fruits & Vegetables</option>
              <option value="Beverages">Beverages</option>
              <option value="Canned & Packaged Goods">Canned & Packaged Goods</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label for="gb-unit" class="block font-bold text-app-muted mb-1">Unit *</label>
            <input
              id="gb-unit"
              type="text"
              bind:value={createUnit}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
              required
            />
          </div>
          <div>
            <label for="gb-target" class="block font-bold text-app-muted mb-1">Target Qty *</label>
            <input
              id="gb-target"
              type="number"
              min="2"
              bind:value={createTarget}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
              required
            />
          </div>
          <div>
            <label for="gb-my-qty" class="block font-bold text-app-muted mb-1">My Initial Qty *</label>
            <input
              id="gb-my-qty"
              type="number"
              min="1"
              bind:value={createInitialCommitment}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
              required
            />
          </div>
        </div>

        <div>
          <label for="gb-deadline" class="block font-bold text-app-muted mb-1">Joining Deadline *</label>
          <input
            id="gb-deadline"
            type="datetime-local"
            bind:value={createDeadline}
            class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
            required
          />
        </div>

        <div class="pt-3 flex justify-end gap-2">
          <button
            type="button"
            onclick={() => showCreateModal = false}
            class="px-4 py-2 rounded-xl text-app-muted hover:text-app-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createLoading}
            class="px-5 py-2.5 rounded-xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] font-bold shadow-md transition disabled:opacity-50"
          >
            {createLoading ? 'Publishing...' : 'Launch Pool'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal: Join Group Buy -->
{#if showJoinModal && selectedGroupBuy}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
    <div class="bg-app-card text-app-text rounded-3xl border border-app-border shadow-2xl max-w-sm w-full p-6 space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-app-border">
        <h3 class="text-base font-extrabold font-heading text-app-text">Join Group Pool</h3>
        <button onclick={() => showJoinModal = false} class="text-app-muted hover:text-app-text">✕</button>
      </div>

      <div class="text-xs space-y-1">
        <div class="font-bold text-app-text">{selectedGroupBuy.title}</div>
        <div class="text-app-muted">Product: {selectedGroupBuy.productName}</div>
        <div class="text-app-muted">Target: {selectedGroupBuy.targetMinQuantity} {selectedGroupBuy.unit}</div>
      </div>

      <form onsubmit={handleJoinGroupBuy} class="space-y-4 text-xs">
        <div>
          <label for="join-qty-input" class="block font-bold text-app-muted mb-1">Your Committed Quantity ({selectedGroupBuy.unit}) *</label>
          <input
            id="join-qty-input"
            type="number"
            min="1"
            bind:value={joinQuantity}
            class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text text-sm font-extrabold focus:outline-none focus:border-[#D4A72C]"
            required
          />
        </div>

        <div class="pt-2 flex justify-end gap-2">
          <button type="button" onclick={() => showJoinModal = false} class="px-4 py-2 rounded-xl text-app-muted">Cancel</button>
          <button
            type="submit"
            disabled={joinLoading}
            class="px-5 py-2.5 rounded-xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] font-bold shadow-md transition disabled:opacity-50"
          >
            {joinLoading ? 'Joining...' : 'Confirm Commitment'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal: Wholesaler Submit Bulk Offer -->
{#if showOfferModal && selectedGroupBuy}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
    <div class="bg-app-card text-app-text rounded-3xl border border-app-border shadow-2xl max-w-sm w-full p-6 space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-app-border">
        <h3 class="text-base font-extrabold font-heading text-app-text">Submit Bulk Wholesale Offer</h3>
        <button onclick={() => showOfferModal = false} class="text-app-muted hover:text-app-text">✕</button>
      </div>

      <div class="text-xs space-y-1">
        <div class="font-bold text-app-text">{selectedGroupBuy.title}</div>
        <div class="text-app-muted">Pooled Volume: {selectedGroupBuy.currentCommittedQuantity} {selectedGroupBuy.unit}</div>
      </div>

      <form onsubmit={handleSubmitBulkOffer} class="space-y-3.5 text-xs">
        <div>
          <label for="offer-price-input" class="block font-bold text-app-muted mb-1">Bulk Price per {selectedGroupBuy.unit} (₹) *</label>
          <input
            id="offer-price-input"
            type="number"
            step="0.5"
            min="1"
            bind:value={offerPrice}
            class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text text-sm font-extrabold focus:outline-none focus:border-[#D4A72C]"
            required
          />
        </div>

        <div>
          <label for="offer-delivery-input" class="block font-bold text-app-muted mb-1">Delivery Estimate *</label>
          <input
            id="offer-delivery-input"
            type="text"
            bind:value={offerDelivery}
            placeholder="e.g. 24-48 hours"
            class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
            required
          />
        </div>

        <div class="pt-2 flex justify-end gap-2">
          <button type="button" onclick={() => showOfferModal = false} class="px-4 py-2 rounded-xl text-app-muted">Cancel</button>
          <button
            type="submit"
            disabled={offerLoading}
            class="px-5 py-2.5 rounded-xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] font-bold shadow-md transition disabled:opacity-50"
          >
            {offerLoading ? 'Submitting...' : 'Submit Offer'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
