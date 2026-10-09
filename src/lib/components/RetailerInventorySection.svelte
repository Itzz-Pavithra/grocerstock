<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import {
    Store,
    Plus,
    SlidersHorizontal,
    ShoppingCart,
    AlertTriangle,
    Coins,
    TrendingDown,
    TrendingUp,
    Search,
    RefreshCw,
    X,
    FileText,
    History
  } from 'lucide-svelte';

  let { onQuickRestock = () => {} } = $props();

  let activeSubTab = $state('stock'); // 'stock' | 'sale' | 'sales_history'
  let loading = $state(true);
  let inventoryItems = $state([]);
  let salesHistory = $state([]);
  let totalValuation = $state(0);
  let lowStockCount = $state(0);
  let searchQuery = $state('');

  // Add Item Modal
  let showAddModal = $state(false);
  let addName = $state('');
  let addCategory = $state('Pantry Staples');
  let addBrand = $state('');
  let addUnit = $state('kg');
  let addQty = $state(50);
  let addThreshold = $state(15);
  let addCostPrice = $state(0);
  let addSellingPrice = $state(0);
  let addLoading = $state(false);

  // Adjustment Modal
  let showAdjustModal = $state(false);
  let selectedItem = $state(null);
  let adjustType = $state('add'); // 'add' | 'deduct' | 'set'
  let adjustQuantity = $state(10);
  let adjustNotes = $state('');
  let adjustLoading = $state(false);

  // Record Sale Form State
  let saleLines = $state([
    { productName: '', quantity: 1, unitSellingPrice: 0 }
  ]);
  let salePaymentMethod = $state('cash');
  let saleNote = $state('');
  let saleLoading = $state(false);

  // Movements History Modal
  let showMovementsModal = $state(false);
  let selectedMovementItem = $state(null);

  async function loadInventory() {
    loading = true;
    try {
      const res = await api.get('/retailer-inventory');
      if (res.success) {
        inventoryItems = res.inventory || [];
        totalValuation = res.totalValuation || 0;
        lowStockCount = res.lowStockCount || 0;
      }
    } catch (err) {
      toasts.error('Failed to load store inventory');
    } finally {
      loading = false;
    }
  }

  async function loadSalesHistory() {
    try {
      const res = await api.get('/retailer-inventory/sales');
      if (res.success) {
        salesHistory = res.sales || [];
      }
    } catch (err) {
      console.warn('Failed to load sales history', err);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!addName || !addCategory || !addUnit) return;

    addLoading = true;
    try {
      await api.post('/retailer-inventory', {
        productName: addName,
        category: addCategory,
        brand: addBrand,
        unit: addUnit,
        stockQuantity: Number(addQty),
        minStockThreshold: Number(addThreshold),
        averageCostPrice: Number(addCostPrice),
        sellingPrice: Number(addSellingPrice)
      });
      toasts.success(`"${addName}" added to inventory!`);
      showAddModal = false;
      addName = '';
      loadInventory();
    } catch (err) {
      toasts.error(err.message || 'Failed to add item');
    } finally {
      addLoading = false;
    }
  }

  async function handleAdjustStock(e) {
    e.preventDefault();
    if (!selectedItem) return;

    adjustLoading = true;
    try {
      await api.put(`/retailer-inventory/${selectedItem._id}/adjust`, {
        adjustmentType: adjustType,
        quantity: Number(adjustQuantity),
        notes: adjustNotes
      });
      toasts.success('Inventory adjusted successfully!');
      showAdjustModal = false;
      loadInventory();
    } catch (err) {
      toasts.error(err.message || 'Failed to adjust stock');
    } finally {
      adjustLoading = false;
    }
  }

  function addSaleLine() {
    saleLines = [...saleLines, { productName: '', quantity: 1, unitSellingPrice: 0 }];
  }

  function removeSaleLine(idx) {
    if (saleLines.length <= 1) return;
    saleLines = saleLines.filter((_, i) => i !== idx);
  }

  function handleProductSelect(idx, pName) {
    const item = inventoryItems.find(i => i.productName.toLowerCase() === pName.toLowerCase());
    if (item) {
      saleLines[idx].productName = item.productName;
      saleLines[idx].unitSellingPrice = item.sellingPrice || Number((item.averageCostPrice * 1.2).toFixed(2));
    }
  }

  async function handleRecordSale(e) {
    e.preventDefault();
    saleLoading = true;
    try {
      const payload = {
        items: saleLines.map(line => ({
          productName: line.productName,
          quantity: Number(line.quantity),
          unitSellingPrice: Number(line.unitSellingPrice)
        })),
        paymentMethod: salePaymentMethod,
        customerNote: saleNote
      };

      const res = await api.post('/retailer-inventory/sales', payload);
      toasts.success(`Sale recorded! Gross profit: ₹${res.sale?.totalGrossProfit || 0}`);
      saleLines = [{ productName: '', quantity: 1, unitSellingPrice: 0 }];
      saleNote = '';
      activeSubTab = 'sales_history';
      loadInventory();
      loadSalesHistory();
    } catch (err) {
      toasts.error(err.message || 'Failed to record sale');
    } finally {
      saleLoading = false;
    }
  }

  let filteredItems = $derived(
    inventoryItems.filter(item => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.productName.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    })
  );

  onMount(() => {
    loadInventory();
    loadSalesHistory();
  });
</script>

<div class="space-y-6">
  <!-- Top Banner & Metrics -->
  <div class="bg-app-card p-6 rounded-3xl border border-app-border space-y-4">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div class="flex items-center space-x-2 text-xs font-bold text-[#D4A72C] uppercase tracking-wider">
          <Store class="w-4 h-4" />
          <span>Independent Store Inventory</span>
        </div>
        <h2 class="text-xl sm:text-2xl font-extrabold font-heading text-app-text mt-1">
          Store Inventory & Sales Tracking
        </h2>
        <p class="text-xs text-app-muted mt-1 max-w-xl">
          Track store stock levels, adjust stock movements, record retail counter sales, and calculate true realized profits.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          onclick={() => showAddModal = true}
          type="button"
          class="px-4 py-2.5 rounded-xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] text-xs font-bold shadow-sm glow-mustard flex items-center space-x-2 transition"
        >
          <Plus class="w-4 h-4" />
          <span>Add Product SKU</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Metric Tiles -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
      <div class="p-3.5 rounded-2xl bg-app-cardSubtle border border-app-border">
        <span class="text-[10px] font-bold text-app-muted uppercase">Total Stock SKUs</span>
        <div class="text-lg font-black text-app-text mt-0.5">{inventoryItems.length} items</div>
      </div>
      <div class="p-3.5 rounded-2xl bg-app-cardSubtle border border-app-border">
        <span class="text-[10px] font-bold text-app-muted uppercase">Inventory Valuation</span>
        <div class="text-lg font-black text-[#D4A72C] mt-0.5">₹{totalValuation}</div>
      </div>
      <div class="p-3.5 rounded-2xl bg-app-cardSubtle border border-app-border">
        <span class="text-[10px] font-bold text-app-muted uppercase">Low Stock SKUs</span>
        <div class="text-lg font-black {lowStockCount > 0 ? 'text-amber-500' : 'text-emerald-500'} mt-0.5">
          {lowStockCount} {lowStockCount === 1 ? 'item' : 'items'}
        </div>
      </div>
      <div class="p-3.5 rounded-2xl bg-app-cardSubtle border border-app-border">
        <span class="text-[10px] font-bold text-app-muted uppercase">Recorded Sales</span>
        <div class="text-lg font-black text-[#B9DDE5] mt-0.5">{salesHistory.length} transactions</div>
      </div>
    </div>

    <!-- Sub-tab Navigation -->
    <div class="flex border-b border-app-border pt-2 gap-4">
      <button
        onclick={() => activeSubTab = 'stock'}
        class="pb-2.5 text-xs font-bold transition-all relative {activeSubTab === 'stock' ? 'text-[#D4A72C]' : 'text-app-muted hover:text-app-text'}"
      >
        <span>Stock Levels ({inventoryItems.length})</span>
        {#if activeSubTab === 'stock'}
          <span class="absolute bottom-0 left-0 w-full h-0.5 bg-[#D4A72C] rounded-full"></span>
        {/if}
      </button>

      <button
        onclick={() => activeSubTab = 'sale'}
        class="pb-2.5 text-xs font-bold transition-all relative {activeSubTab === 'sale' ? 'text-[#D4A72C]' : 'text-app-muted hover:text-app-text'}"
      >
        <span>Record Retail Sale</span>
        {#if activeSubTab === 'sale'}
          <span class="absolute bottom-0 left-0 w-full h-0.5 bg-[#D4A72C] rounded-full"></span>
        {/if}
      </button>

      <button
        onclick={() => activeSubTab = 'sales_history'}
        class="pb-2.5 text-xs font-bold transition-all relative {activeSubTab === 'sales_history' ? 'text-[#D4A72C]' : 'text-app-muted hover:text-app-text'}"
      >
        <span>Sales & Profit History ({salesHistory.length})</span>
        {#if activeSubTab === 'sales_history'}
          <span class="absolute bottom-0 left-0 w-full h-0.5 bg-[#D4A72C] rounded-full"></span>
        {/if}
      </button>
    </div>
  </div>

  <!-- Sub-tab: Stock Levels View -->
  {#if activeSubTab === 'stock'}
    <div class="space-y-4">
      <!-- Search filter -->
      <div class="flex items-center gap-3 bg-app-card p-3 rounded-2xl border border-app-border">
        <Search class="w-4 h-4 text-app-muted ml-1" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search products by name, category, or brand..."
          class="w-full bg-transparent text-xs text-app-text focus:outline-none"
        />
      </div>

      {#if loading}
        <div class="py-16 text-center space-y-3">
          <div class="w-10 h-10 mx-auto rounded-full border-3 border-[#D4A72C] border-t-transparent animate-spin"></div>
          <div class="text-xs text-app-muted">Loading inventory items...</div>
        </div>
      {:else if filteredItems.length === 0}
        <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-3">
          <div class="text-3xl">📦</div>
          <h4 class="text-sm font-bold text-app-text">No Products in Inventory</h4>
          <p class="text-xs text-app-muted max-w-sm mx-auto">
            Add products to your store stock or procure them via Wholesale Requests. Delivered orders will automatically add to stock!
          </p>
        </div>
      {:else}
        <div class="bg-app-card rounded-3xl border border-app-border overflow-hidden shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-app-cardSubtle border-b border-app-border text-[10px] uppercase font-bold text-app-muted">
                <tr>
                  <th class="p-4">Product Name</th>
                  <th class="p-4">Category</th>
                  <th class="p-4">Available Stock</th>
                  <th class="p-4">Avg Cost Price</th>
                  <th class="p-4">Selling Price</th>
                  <th class="p-4">Status</th>
                  <th class="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-app-border/70">
                {#each filteredItems as item (item._id)}
                  {@const isLow = item.stockQuantity <= item.minStockThreshold}
                  {@const isOut = item.stockQuantity === 0}
                  <tr class="hover:bg-app-cardSubtle/60 transition">
                    <td class="p-4">
                      <div class="font-bold text-app-text">{item.productName}</div>
                      {#if item.brand}
                        <div class="text-[10px] text-app-muted">{item.brand}</div>
                      {/if}
                    </td>
                    <td class="p-4 text-app-muted">{item.category}</td>
                    <td class="p-4 font-extrabold text-app-text">
                      {item.stockQuantity} {item.unit}
                    </td>
                    <td class="p-4 text-app-muted">₹{item.averageCostPrice}/{item.unit}</td>
                    <td class="p-4 font-bold text-[#D4A72C]">
                      {item.sellingPrice > 0 ? `₹${item.sellingPrice}/${item.unit}` : 'Not set'}
                    </td>
                    <td class="p-4">
                      {#if isOut}
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                          Out of Stock
                        </span>
                      {:else if isLow}
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          Low Stock
                        </span>
                      {:else}
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          Healthy
                        </span>
                      {/if}
                    </td>
                    <td class="p-4 text-right space-x-1.5 whitespace-nowrap">
                      {#if isLow || isOut}
                        <button
                          onclick={() => onQuickRestock(item)}
                          class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] shadow-xs"
                          title="Create Restock Request"
                        >
                          Restock
                        </button>
                      {/if}
                      <button
                        onclick={() => { selectedItem = item; adjustQuantity = 10; adjustType = 'add'; adjustNotes = ''; showAdjustModal = true; }}
                        class="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-app-cardSubtle border border-app-border hover:bg-app-card text-app-text"
                      >
                        Adjust
                      </button>
                      <button
                        onclick={() => { selectedMovementItem = item; showMovementsModal = true; }}
                        class="px-2 py-1 text-[11px] rounded-lg text-app-muted hover:text-app-text"
                        title="View Stock Movement Audit Log"
                      >
                        <History class="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>

  <!-- Sub-tab: Record Retail Sale -->
  {:else if activeSubTab === 'sale'}
    <div class="bg-app-card p-6 rounded-3xl border border-app-border max-w-2xl space-y-5">
      <div>
        <h3 class="text-base font-extrabold font-heading text-app-text">Record Store Counter Sale</h3>
        <p class="text-xs text-app-muted mt-0.5">
          Records walk-in retail sales, automatically deducts inventory stock, and logs true Cost of Goods Sold (COGS).
        </p>
      </div>

      <form onsubmit={handleRecordRetailSale} class="space-y-4 text-xs">
        <!-- Line Items -->
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="font-bold text-app-muted uppercase text-[10px]">Sale Line Items ({saleLines.length})</span>
            <button
              type="button"
              onclick={addSaleLine}
              class="text-xs font-bold text-[#D4A72C] hover:underline flex items-center gap-1"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add Line</span>
            </button>
          </div>

          {#each saleLines as line, idx}
            <div class="p-3.5 rounded-2xl bg-app-cardSubtle border border-app-border space-y-2.5 relative">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold text-[#D4A72C]">Item #{idx + 1}</span>
                {#if saleLines.length > 1}
                  <button
                    type="button"
                    onclick={() => removeSaleLine(idx)}
                    class="text-rose-500 hover:text-rose-600 text-xs font-bold"
                  >
                    Remove
                  </button>
                {/if}
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div class="sm:col-span-1">
                  <label for="sale-select-{idx}" class="block text-[10px] font-bold text-app-muted mb-1">Select Product *</label>
                  <select
                    id="sale-select-{idx}"
                    bind:value={line.productName}
                    onchange={(e) => handleProductSelect(idx, e.target.value)}
                    class="w-full px-3 py-2 rounded-xl bg-app-card border border-app-border text-app-text text-xs focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Stock SKU --</option>
                    {#each inventoryItems as inv}
                      <option value={inv.productName} disabled={inv.stockQuantity <= 0}>
                        {inv.productName} ({inv.stockQuantity} {inv.unit} avail)
                      </option>
                    {/each}
                  </select>
                </div>

                <div>
                  <label for="sale-qty-{idx}" class="block text-[10px] font-bold text-app-muted mb-1">Quantity Sold *</label>
                  <input
                    id="sale-qty-{idx}"
                    type="number"
                    step="0.5"
                    min="0.1"
                    bind:value={line.quantity}
                    class="w-full px-3 py-2 rounded-xl bg-app-card border border-app-border text-app-text text-xs focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label for="sale-price-{idx}" class="block text-[10px] font-bold text-app-muted mb-1">Selling Price / Unit (₹) *</label>
                  <input
                    id="sale-price-{idx}"
                    type="number"
                    step="0.5"
                    min="0"
                    bind:value={line.unitSellingPrice}
                    class="w-full px-3 py-2 rounded-xl bg-app-card border border-app-border text-app-text text-xs focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          {/each}
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label for="sale-payment-method" class="block font-bold text-app-muted mb-1 text-[10px]">Payment Method</label>
            <select
              id="sale-payment-method"
              bind:value={salePaymentMethod}
              class="w-full px-3 py-2 rounded-xl bg-app-cardSubtle border border-app-border text-app-text text-xs focus:outline-none"
            >
              <option value="cash">Cash Counter</option>
              <option value="upi">UPI / QR Code</option>
              <option value="card">Debit / Credit Card</option>
              <option value="credit">Store Credit / Khata</option>
            </select>
          </div>
          <div>
            <label for="sale-notes" class="block font-bold text-app-muted mb-1 text-[10px]">Customer / Transaction Notes</label>
            <input
              id="sale-notes"
              type="text"
              bind:value={saleNote}
              placeholder="e.g. Regular customer, receipt #42"
              class="w-full px-3 py-2 rounded-xl bg-app-cardSubtle border border-app-border text-app-text text-xs focus:outline-none"
            />
          </div>
        </div>

        <div class="pt-3 flex justify-end">
          <button
            type="submit"
            disabled={saleLoading}
            class="px-6 py-2.5 rounded-xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] text-xs font-bold shadow-md glow-mustard transition disabled:opacity-50"
          >
            {saleLoading ? 'Recording Sale...' : 'Submit Sale & Deduct Stock'}
          </button>
        </div>
      </form>
    </div>

  <!-- Sub-tab: Sales & Profit History -->
  {:else if activeSubTab === 'sales_history'}
    <div class="space-y-4">
      {#if salesHistory.length === 0}
        <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-2">
          <div class="text-3xl">🧾</div>
          <h4 class="text-sm font-bold text-app-text">No Store Sales Recorded Yet</h4>
          <p class="text-xs text-app-muted max-w-sm mx-auto">
            Record retail counter sales using the "Record Retail Sale" tab to begin tracking store revenue and realized gross margins.
          </p>
        </div>
      {:else}
        <div class="bg-app-card rounded-3xl border border-app-border overflow-hidden shadow-xs">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-app-cardSubtle border-b border-app-border text-[10px] uppercase font-bold text-app-muted">
                <tr>
                  <th class="p-4">Date & Time</th>
                  <th class="p-4">Items Sold</th>
                  <th class="p-4">Payment</th>
                  <th class="p-4">Total Revenue</th>
                  <th class="p-4">Cost of Goods (COGS)</th>
                  <th class="p-4">Realized Gross Profit</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-app-border/70">
                {#each salesHistory as sale (sale._id)}
                  <tr class="hover:bg-app-cardSubtle/60 transition">
                    <td class="p-4 text-app-muted text-[11px]">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td class="p-4">
                      {#each sale.items as it}
                        <div class="font-medium text-app-text">
                          {it.quantity} {it.unit} of {it.productName} @ ₹{it.unitSellingPrice}
                        </div>
                      {/each}
                    </td>
                    <td class="p-4 capitalize text-app-muted">{sale.paymentMethod}</td>
                    <td class="p-4 font-bold text-app-text">₹{sale.totalRevenue}</td>
                    <td class="p-4 text-app-muted">₹{sale.totalCost}</td>
                    <td class="p-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                      +₹{sale.totalGrossProfit}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Modal: Add Inventory SKU -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
    <div class="bg-app-card text-app-text rounded-3xl border border-app-border shadow-2xl max-w-md w-full p-6 space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-app-border">
        <h3 class="text-base font-extrabold font-heading text-app-text">Add Product to Store Stock</h3>
        <button onclick={() => showAddModal = false} class="text-app-muted hover:text-app-text">✕</button>
      </div>

      <form onsubmit={handleAddItem} class="space-y-3.5 text-xs">
        <div>
          <label for="add-prod-name" class="block font-bold text-app-muted mb-1">Product Name *</label>
          <input
            id="add-prod-name"
            type="text"
            bind:value={addName}
            placeholder="e.g. Sona Masoori Rice 25kg"
            class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none focus:border-[#D4A72C]"
            required
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="add-prod-cat" class="block font-bold text-app-muted mb-1">Category *</label>
            <input
              id="add-prod-cat"
              type="text"
              bind:value={addCategory}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
              required
            />
          </div>
          <div>
            <label for="add-prod-brand" class="block font-bold text-app-muted mb-1">Brand</label>
            <input
              id="add-prod-brand"
              type="text"
              bind:value={addBrand}
              placeholder="e.g. Royal Harvest"
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
            />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label for="add-prod-unit" class="block font-bold text-app-muted mb-1">Unit *</label>
            <input
              id="add-prod-unit"
              type="text"
              bind:value={addUnit}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
              required
            />
          </div>
          <div>
            <label for="add-prod-qty" class="block font-bold text-app-muted mb-1">Stock Qty *</label>
            <input
              id="add-prod-qty"
              type="number"
              min="0"
              bind:value={addQty}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
              required
            />
          </div>
          <div>
            <label for="add-prod-thresh" class="block font-bold text-app-muted mb-1">Low Alert *</label>
            <input
              id="add-prod-thresh"
              type="number"
              min="0"
              bind:value={addThreshold}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
              required
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="add-prod-cost" class="block font-bold text-app-muted mb-1">Cost Price / Unit (₹)</label>
            <input
              id="add-prod-cost"
              type="number"
              step="0.5"
              min="0"
              bind:value={addCostPrice}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
            />
          </div>
          <div>
            <label for="add-prod-selling" class="block font-bold text-app-muted mb-1">Selling Price / Unit (₹)</label>
            <input
              id="add-prod-selling"
              type="number"
              step="0.5"
              min="0"
              bind:value={addSellingPrice}
              class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
            />
          </div>
        </div>

        <div class="pt-3 flex justify-end gap-2">
          <button type="button" onclick={() => showAddModal = false} class="px-4 py-2 rounded-xl text-app-muted">Cancel</button>
          <button
            type="submit"
            disabled={addLoading}
            class="px-5 py-2.5 rounded-xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] font-bold shadow-md transition disabled:opacity-50"
          >
            {addLoading ? 'Saving...' : 'Add Product SKU'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal: Adjust Stock Quantity -->
{#if showAdjustModal && selectedItem}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
    <div class="bg-app-card text-app-text rounded-3xl border border-app-border shadow-2xl max-w-sm w-full p-6 space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-app-border">
        <h3 class="text-base font-extrabold font-heading text-app-text">Adjust Stock Quantity</h3>
        <button onclick={() => showAdjustModal = false} class="text-app-muted hover:text-app-text">✕</button>
      </div>

      <div class="text-xs space-y-1">
        <div class="font-bold text-app-text">{selectedItem.productName}</div>
        <div class="text-app-muted">Current Stock: <span class="font-bold text-app-text">{selectedItem.stockQuantity} {selectedItem.unit}</span></div>
      </div>

      <form onsubmit={handleAdjustStock} class="space-y-3.5 text-xs">
        <div>
          <label for="adj-type" class="block font-bold text-app-muted mb-1">Adjustment Action</label>
          <select
            id="adj-type"
            bind:value={adjustType}
            class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
          >
            <option value="add">Add Stock (New shipment / found stock)</option>
            <option value="deduct">Deduct Stock (Wastage / spoilage / damage)</option>
            <option value="set">Set Exact Count (Physical audit correction)</option>
          </select>
        </div>

        <div>
          <label for="adj-qty" class="block font-bold text-app-muted mb-1">Quantity ({selectedItem.unit}) *</label>
          <input
            id="adj-qty"
            type="number"
            min="0"
            step="0.5"
            bind:value={adjustQuantity}
            class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text text-sm font-extrabold focus:outline-none focus:border-[#D4A72C]"
            required
          />
        </div>

        <div>
          <label for="adj-notes" class="block font-bold text-app-muted mb-1">Reason / Audit Notes</label>
          <input
            id="adj-notes"
            type="text"
            bind:value={adjustNotes}
            placeholder="e.g. Monthly stock count audit"
            class="w-full px-3.5 py-2.5 rounded-xl bg-app-cardSubtle border border-app-border text-app-text focus:outline-none"
          />
        </div>

        <div class="pt-2 flex justify-end gap-2">
          <button type="button" onclick={() => showAdjustModal = false} class="px-4 py-2 rounded-xl text-app-muted">Cancel</button>
          <button
            type="submit"
            disabled={adjustLoading}
            class="px-5 py-2.5 rounded-xl bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] font-bold shadow-md transition disabled:opacity-50"
          >
            {adjustLoading ? 'Updating...' : 'Save Adjustment'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Modal: Stock Movement Audit Log -->
{#if showMovementsModal && selectedMovementItem}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
    <div class="bg-app-card text-app-text rounded-3xl border border-app-border shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col p-6 space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-app-border">
        <div>
          <h3 class="text-base font-extrabold font-heading text-app-text">Stock Movement Audit Log</h3>
          <div class="text-xs text-app-muted">{selectedMovementItem.productName}</div>
        </div>
        <button onclick={() => showMovementsModal = false} class="text-app-muted hover:text-app-text">✕</button>
      </div>

      <div class="overflow-y-auto space-y-2 flex-1 custom-scrollbar text-xs">
        {#if !selectedMovementItem.stockMovements || selectedMovementItem.stockMovements.length === 0}
          <div class="text-center py-8 text-app-muted">No movement records logged for this item yet.</div>
        {:else}
          {#each selectedMovementItem.stockMovements as mov}
            <div class="p-3 rounded-xl bg-app-cardSubtle border border-app-border flex justify-between items-center">
              <div>
                <span class="font-bold text-app-text capitalize">
                  {mov.movementType.replace(/_/g, ' ')}
                </span>
                <div class="text-[10px] text-app-muted">{mov.notes || 'Routine stock movement'}</div>
                <div class="text-[9px] text-app-muted">{new Date(mov.createdAt).toLocaleString()}</div>
              </div>
              <div class="text-right">
                <div class="font-extrabold {mov.quantityChange > 0 ? 'text-emerald-500' : 'text-rose-500'}">
                  {mov.quantityChange > 0 ? `+${mov.quantityChange}` : mov.quantityChange} {selectedMovementItem.unit}
                </div>
                <div class="text-[10px] text-app-muted">Bal: {mov.balanceAfter} {selectedMovementItem.unit}</div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
