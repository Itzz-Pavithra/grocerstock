<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { api } from '$lib/api.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import SupplierScorecardModal from '$lib/components/SupplierScorecardModal.svelte';

  let activeTab = $state('overview');
  let dashboardLoading = $state(true);

  // Scorecard inspection state
  let selectedWholesaler = $state(null);
  let showScorecardModal = $state(false);

  // Data State
  let stats = $state({ users: { total: 0, retailers: 0, wholesalers: 0 }, requests: { total: 0, pending: 0, responded: 0, accepted: 0, rejected: 0 }, bids: { total: 0 }, requestsByCategory: [] });
  let usersList = $state([]);
  let categoriesList = $state([]);
  let productsList = $state([]);

  // Form states for Category CRUD
  let showCategoryModal = $state(false);
  let categoryFormId = $state('');
  let categoryFormName = $state('');
  let categoryFormDesc = $state('');
  let categoryFormError = $state('');

  // Form states for Product CRUD
  let showProductModal = $state(false);
  let productFormId = $state('');
  let productFormName = $state('');
  let productFormCatId = $state('');
  let productFormBrand = $state('');
  let productFormUnit = $state('kg');
  let productFormError = $state('');

  // Custom Confirmation Dialog State
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

  // Load Admin Data
  async function loadOverview() {
    dashboardLoading = true;
    try {
      stats = await api.get('/admin/stats');
    } catch (err) {
      console.error(err);
      toasts.error('Failed to load stats');
    } finally {
      dashboardLoading = false;
    }
  }

  async function loadUsers() {
    dashboardLoading = true;
    try {
      usersList = await api.get('/admin/users');
    } catch (err) {
      console.error(err);
      toasts.error('Failed to fetch users');
    } finally {
      dashboardLoading = false;
    }
  }

  async function loadCategories() {
    try {
      categoriesList = await api.get('/admin/categories');
    } catch (err) {
      console.error(err);
    }
  }

  async function loadProducts() {
    dashboardLoading = true;
    try {
      productsList = await api.get('/admin/products');
    } catch (err) {
      console.error(err);
      toasts.error('Failed to fetch products');
    } finally {
      dashboardLoading = false;
    }
  }

  // Toggle user activation status
  async function toggleUserActive(userId) {
    try {
      await api.put(`/admin/users/${userId}/status`);
      toasts.success('User status updated successfully');
      await loadUsers();
    } catch (err) {
      toasts.error(err.message || 'Failed to toggle status');
    }
  }

  // Category Handlers
  function openCategoryModal(cat = null) {
    categoryFormError = '';
    if (cat) {
      categoryFormId = cat._id;
      categoryFormName = cat.name;
      categoryFormDesc = cat.description || '';
    } else {
      categoryFormId = '';
      categoryFormName = '';
      categoryFormDesc = '';
    }
    showCategoryModal = true;
  }

  async function handleSaveCategory(e) {
    e.preventDefault();
    categoryFormError = '';
    if (!categoryFormName) {
      categoryFormError = 'Category name is required';
      return;
    }

    try {
      if (categoryFormId) {
        await api.put(`/admin/categories/${categoryFormId}`, {
          name: categoryFormName,
          description: categoryFormDesc
        });
        toasts.success('Category updated successfully');
      } else {
        await api.post('/admin/categories', {
          name: categoryFormName,
          description: categoryFormDesc
        });
        toasts.success('Category created successfully');
      }
      showCategoryModal = false;
      await loadCategories();
    } catch (err) {
      categoryFormError = err.message || 'Failed to save category';
      toasts.error(categoryFormError);
    }
  }

  async function handleDeleteCategory(id) {
    triggerConfirm('Are you sure you want to delete this category?', async () => {
      try {
        await api.delete(`/admin/categories/${id}`);
        toasts.success('Category deleted');
        await loadCategories();
      } catch (err) {
        toasts.error(err.message || 'Failed to delete category');
      }
    });
  }

  // Product Handlers
  function openProductModal(prod = null) {
    productFormError = '';
    if (prod) {
      productFormId = prod._id;
      productFormName = prod.name;
      productFormCatId = prod.category?._id || prod.category || '';
      productFormBrand = prod.brand || '';
      productFormUnit = prod.defaultUnit || 'kg';
    } else {
      productFormId = '';
      productFormName = '';
      productFormCatId = categoriesList[0]?._id || '';
      productFormBrand = '';
      productFormUnit = 'kg';
    }
    showProductModal = true;
  }

  async function handleSaveProduct(e) {
    e.preventDefault();
    productFormError = '';
    if (!productFormName || !productFormCatId || !productFormBrand) {
      productFormError = 'Product name, category, and brand are required';
      return;
    }

    try {
      if (productFormId) {
        await api.put(`/admin/products/${productFormId}`, {
          name: productFormName,
          category: productFormCatId,
          brand: productFormBrand,
          defaultUnit: productFormUnit
        });
        toasts.success('Product updated successfully');
      } else {
        await api.post('/admin/products', {
          name: productFormName,
          category: productFormCatId,
          brand: productFormBrand,
          defaultUnit: productFormUnit
        });
        toasts.success('Product added successfully');
      }
      showProductModal = false;
      await loadProducts();
    } catch (err) {
      productFormError = err.message || 'Failed to save product';
      toasts.error(productFormError);
    }
  }

  async function handleDeleteProduct(id) {
    triggerConfirm('Are you sure you want to delete this product?', async () => {
      try {
        await api.delete(`/admin/products/${id}`);
        toasts.success('Product deleted');
        await loadProducts();
      } catch (err) {
        toasts.error(err.message || 'Failed to delete product');
      }
    });
  }

  onMount(() => {
    if (!auth.token) {
      goto('/auth');
      return;
    }
    if (auth.user && auth.user.role !== 'admin') {
      goto('/unauthorized');
      return;
    }

    loadOverview();
    loadCategories();
  });
</script>

<div class="min-h-screen bg-app-bg text-app-text p-4 sm:p-6 lg:p-8 transition-colors duration-200">
  <div class="max-w-7xl mx-auto space-y-8">
    
    <!-- Top Bar / Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm">
      <div>
        <div class="flex items-center space-x-2 text-xs font-bold text-brand-orange uppercase tracking-wider">
          <span>System Administration</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-1">
          {i18n.t('adminPanel')}
        </h1>
        <p class="text-xs text-app-muted mt-1">
          Platform oversight, account verification, global product catalog management, and usage metrics.
        </p>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex bg-app-cardSubtle p-1.5 rounded-2xl border border-app-border">
        <button 
          onclick={() => { activeTab = 'overview'; loadOverview(); }}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'overview' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          📊 System Overview
        </button>
        <button 
          onclick={() => { activeTab = 'users'; loadUsers(); }}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'users' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          👥 User Accounts
        </button>
        <button 
          onclick={() => { activeTab = 'catalog'; loadProducts(); }}
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all {activeTab === 'catalog' ? 'bg-brand-orange text-white shadow-md' : 'text-app-muted hover:text-app-text'}"
        >
          🏷️ Product Catalog
        </button>
      </div>
    </div>

    {#if activeTab === 'overview'}
      <!-- Overview Metrics Grid -->
      {#if dashboardLoading}
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {#each Array(4) as _}
            <div class="h-28 bg-app-card rounded-2xl border border-app-border animate-shimmer"></div>
          {/each}
        </div>
      {:else}
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
            <span class="text-xs font-bold text-app-muted uppercase">Registered Users</span>
            <div class="text-3xl font-extrabold font-heading text-app-text mt-2">{stats.users.total}</div>
            <span class="text-[10px] text-app-muted mt-1 block">Retailers: {stats.users.retailers} | Wholesalers: {stats.users.wholesalers}</span>
          </div>

          <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
            <span class="text-xs font-bold text-brand-orange uppercase">Total Stock Requests</span>
            <div class="text-3xl font-extrabold font-heading text-brand-orange mt-2">{stats.requests.total}</div>
            <span class="text-[10px] text-app-muted mt-1 block">Pending: {stats.requests.pending} | Accepted: {stats.requests.accepted}</span>
          </div>

          <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
            <span class="text-xs font-bold text-emerald-500 uppercase">Wholesaler Bids</span>
            <div class="text-3xl font-extrabold font-heading text-emerald-500 mt-2">{stats.bids.total}</div>
            <span class="text-[10px] text-app-muted mt-1 block">Submitted quotations</span>
          </div>

          <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
            <span class="text-xs font-bold text-app-muted uppercase">Categories Listed</span>
            <div class="text-3xl font-extrabold font-heading text-app-text mt-2">{categoriesList.length}</div>
            <span class="text-[10px] text-app-muted mt-1 block">Standardized categories</span>
          </div>
        </div>

        <!-- Requests by Category Breakdown -->
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
          <h2 class="text-lg font-bold font-heading text-app-text">Demand by Category Breakdown</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each stats.requestsByCategory as catStat}
              <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle flex justify-between items-center">
                <span class="text-xs font-bold text-app-text">{catStat._id || 'Uncategorized'}</span>
                <span class="text-sm font-extrabold text-brand-orange px-3 py-1 rounded-full bg-brand-orange/10">
                  {catStat.count} requests
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

    {:else if activeTab === 'users'}
      <!-- User Management Table -->
      <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
        <h2 class="text-lg font-bold font-heading text-app-text">Platform User Accounts ({usersList.length})</h2>

        {#if dashboardLoading}
          <div class="h-64 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-app-text">
              <thead class="bg-app-cardSubtle text-app-muted uppercase font-bold border-b border-app-border">
                <tr>
                  <th class="p-3.5">Email</th>
                  <th class="p-3.5">Role</th>
                  <th class="p-3.5">Details</th>
                  <th class="p-3.5">Verification</th>
                  <th class="p-3.5">Account Status</th>
                  <th class="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-app-border">
                {#each usersList as user (user._id)}
                  <tr class="hover:bg-app-cardSubtle/60 transition">
                    <td class="p-3.5 font-bold">{user.email}</td>
                    <td class="p-3.5 uppercase font-bold text-brand-orange">{user.role}</td>
                    <td class="p-3.5 text-app-muted">
                      {#if user.profile?.storeName}
                        Store: <strong>{user.profile.storeName}</strong>
                      {:else if user.profile?.companyName}
                        Company: <strong>{user.profile.companyName}</strong>
                      {:else}
                        -
                      {/if}
                    </td>
                    <td class="p-3.5">
                      <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px]
                        {user.isEmailVerified ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}"
                      >
                        {user.isEmailVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td class="p-3.5">
                      <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px]
                        {user.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}"
                      >
                        {user.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td class="p-3.5 text-right space-x-1.5">
                      {#if user.role === 'wholesaler'}
                        <button 
                          onclick={() => { selectedWholesaler = user; showScorecardModal = true; }}
                          class="px-2.5 py-1 text-xs font-bold rounded-lg bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 transition-all"
                          title="View verified supplier performance scorecard"
                        >
                          ⭐ Scorecard
                        </button>
                      {/if}
                      {#if user.role !== 'admin'}
                        <button 
                          onclick={() => toggleUserActive(user._id)}
                          class="px-3 py-1 text-xs font-bold rounded-lg transition-all
                            {user.isActive ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}"
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

    {:else if activeTab === 'catalog'}
      <!-- Product Catalog & Category CRUD -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- Categories Panel -->
        <div class="lg:col-span-1 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4 h-fit">
          <div class="flex justify-between items-center border-b border-app-border pb-3">
            <h2 class="text-base font-bold font-heading text-app-text">Categories ({categoriesList.length})</h2>
            <button 
              onclick={() => openCategoryModal()}
              class="px-3 py-1.5 text-xs font-bold bg-brand-orange text-white rounded-xl hover:bg-brand-orange/90"
            >
              + Add
            </button>
          </div>

          <div class="space-y-2">
            {#each categoriesList as cat (cat._id)}
              <div class="p-3 rounded-xl border border-app-border bg-app-cardSubtle flex justify-between items-center text-xs">
                <div>
                  <span class="font-bold text-app-text block">{cat.name}</span>
                  <span class="text-[10px] text-app-muted">{cat.description || 'No description'}</span>
                </div>
                <div class="flex space-x-1">
                  <button onclick={() => openCategoryModal(cat)} class="p-1 text-app-muted hover:text-app-text">✏️</button>
                  <button onclick={() => handleDeleteCategory(cat._id)} class="p-1 text-rose-500">🗑️</button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Products Panel -->
        <div class="lg:col-span-2 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
          <div class="flex justify-between items-center border-b border-app-border pb-3">
            <h2 class="text-base font-bold font-heading text-app-text">Global Products ({productsList.length})</h2>
            <button 
              onclick={() => openProductModal()}
              class="px-4 py-2 text-xs font-bold bg-brand-orange text-white rounded-xl hover:bg-brand-orange/90"
            >
              + Add Product
            </button>
          </div>

          {#if dashboardLoading}
            <div class="h-48 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
          {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {#each productsList as prod (prod._id)}
                <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle flex justify-between items-start text-xs">
                  <div class="space-y-1">
                    <span class="font-bold text-app-text text-sm block">{prod.name}</span>
                    <span class="text-app-muted block">Brand: <strong>{prod.brand}</strong></span>
                    <span class="text-brand-orange font-semibold block">Unit: {prod.defaultUnit}</span>
                  </div>
                  <div class="flex space-x-1">
                    <button onclick={() => openProductModal(prod)} class="p-1.5 text-app-muted hover:text-app-text">✏️</button>
                    <button onclick={() => handleDeleteProduct(prod._id)} class="p-1.5 text-rose-500">🗑️</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

  </div>
</div>

<!-- Category Form Modal -->
{#if showCategoryModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-sm rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <h3 class="text-base font-bold font-heading text-app-text">{categoryFormId ? 'Edit Category' : 'Create Category'}</h3>

      <form onsubmit={handleSaveCategory} class="space-y-4 text-xs">
        {#if categoryFormError}
          <div class="p-3 text-xs bg-rose-50 text-rose-600 rounded-xl font-semibold border border-rose-200">
            {categoryFormError}
          </div>
        {/if}

        <div>
          <label for="cat-name" class="block font-bold text-app-text uppercase mb-1">Category Name *</label>
          <input 
            id="cat-name"
            type="text" 
            bind:value={categoryFormName}
            placeholder="Edible Oils"
            class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
            required
          />
        </div>

        <div>
          <label for="cat-desc" class="block font-bold text-app-muted uppercase mb-1">Description</label>
          <input 
            id="cat-desc"
            type="text" 
            bind:value={categoryFormDesc}
            placeholder="Vegetable oil, sunflower oil..."
            class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
          />
        </div>

        <div class="flex space-x-3 pt-2">
          <button 
            type="button"
            onclick={() => showCategoryModal = false}
            class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-muted"
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="flex-1 py-2.5 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs"
          >
            Save Category
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Product Form Modal -->
{#if showProductModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-md rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <h3 class="text-base font-bold font-heading text-app-text">{productFormId ? 'Edit Product' : 'Create Global Product'}</h3>

      <form onsubmit={handleSaveProduct} class="space-y-4 text-xs">
        {#if productFormError}
          <div class="p-3 text-xs bg-rose-50 text-rose-600 rounded-xl font-semibold border border-rose-200">
            {productFormError}
          </div>
        {/if}

        <div>
          <label for="prod-form-name" class="block font-bold text-app-text uppercase mb-1">Product Name *</label>
          <input 
            id="prod-form-name"
            type="text" 
            bind:value={productFormName}
            placeholder="Sunflower Cooking Oil"
            class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
            required
          />
        </div>

        <div>
          <label for="prod-form-cat" class="block font-bold text-app-text uppercase mb-1">Category *</label>
          <select 
            id="prod-form-cat"
            bind:value={productFormCatId}
            class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
            required
          >
            {#each categoriesList as cat}
              <option value={cat._id}>{cat.name}</option>
            {/each}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="prod-form-brand" class="block font-bold text-app-text uppercase mb-1">Brand *</label>
            <input 
              id="prod-form-brand"
              type="text" 
              bind:value={productFormBrand}
              placeholder="Fortune"
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
              required
            />
          </div>

          <div>
            <label for="prod-form-unit" class="block font-bold text-app-text uppercase mb-1">Default Unit *</label>
            <input 
              id="prod-form-unit"
              type="text" 
              bind:value={productFormUnit}
              placeholder="liter, kg"
              class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-brand-orange"
              required
            />
          </div>
        </div>

        <div class="flex space-x-3 pt-2">
          <button 
            type="button"
            onclick={() => showProductModal = false}
            class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-muted"
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="flex-1 py-2.5 text-xs font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-xs"
          >
            Save Product
          </button>
        </div>
      </form>
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

<!-- Supplier Performance Scorecard Modal -->
<SupplierScorecardModal bind:show={showScorecardModal} wholesaler={selectedWholesaler} />
