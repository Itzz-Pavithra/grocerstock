<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { api } from '$lib/api.js';
  import { toasts } from '$lib/toasts.svelte.js';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import SupplierScorecardModal from '$lib/components/SupplierScorecardModal.svelte';
  import {
    LayoutDashboard,
    ShieldCheck,
    Users,
    Layers,
    Package,
    Settings,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    Edit2,
    Eye,
    Award
  } from 'lucide-svelte';

  // Active Tab: 'overview' | 'verification' | 'users' | 'categories' | 'products' | 'settings'
  let activeTab = $state('overview');
  let dashboardLoading = $state(true);

  // Scorecard inspection state
  let selectedScorecardWholesalerId = $state(null);

  // Data State
  let stats = $state({
    users: { total: 0, retailers: 0, wholesalers: 0 },
    requests: { total: 0, pending: 0, responded: 0, accepted: 0, rejected: 0 },
    bids: { total: 0 },
    requestsByCategory: []
  });
  let usersList = $state([]);
  let verificationsList = $state([]);
  let verificationsLoading = $state(false);
  let categoriesList = $state([]);
  let productsList = $state([]);

  // Search & Filter
  let userSearchQuery = $state('');

  // Rejection Modal State
  let showRejectModal = $state(false);
  let rejectingVerificationId = $state(null);
  let rejectionReasonInput = $state('');

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

  // Confirmation Dialog State
  let showConfirmModal = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state(null);

  let pendingVerificationsCount = $derived(
    verificationsList.filter(v => v.verificationStatus === 'pending').length
  );

  let filteredUsers = $derived(
    userSearchQuery
      ? usersList.filter(u => 
          u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          u.role?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          u.profile?.companyName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          u.profile?.storeName?.toLowerCase().includes(userSearchQuery.toLowerCase())
        )
      : usersList
  );

  let sidebarBadges = $derived({
    pendingVerifications: pendingVerificationsCount
  });

  function triggerConfirm(message, callback) {
    confirmMessage = message;
    confirmCallback = () => {
      callback();
      showConfirmModal = false;
    };
    showConfirmModal = true;
  }

  function handleTabChange(tab) {
    activeTab = tab;
    if (tab === 'overview') loadOverview();
    if (tab === 'verification') loadVerifications();
    if (tab === 'users') loadUsers();
    if (tab === 'categories') loadCategories();
    if (tab === 'products') loadProducts();
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

  async function loadVerifications() {
    verificationsLoading = true;
    try {
      const res = await api.get('/admin/verifications');
      verificationsList = res.verifications || [];
    } catch (err) {
      console.error(err);
      toasts.error('Failed to load business verifications');
    } finally {
      verificationsLoading = false;
    }
  }

  async function handleApproveVerification(wholesalerId, companyName) {
    try {
      await api.put(`/admin/verifications/${wholesalerId}/approve`);
      toasts.success(`Business verification approved for "${companyName}"!`);
      await loadVerifications();
    } catch (err) {
      toasts.error(err.message || 'Failed to approve verification');
    }
  }

  function openRejectModal(wholesalerId) {
    rejectingVerificationId = wholesalerId;
    rejectionReasonInput = '';
    showRejectModal = true;
  }

  async function handleConfirmReject() {
    if (!rejectingVerificationId) return;
    try {
      await api.put(`/admin/verifications/${rejectingVerificationId}/reject`, {
        reason: rejectionReasonInput.trim() || 'Missing or invalid business documentation'
      });
      toasts.success('Wholesaler verification rejected with reason notice sent.');
      showRejectModal = false;
      rejectingVerificationId = null;
      await loadVerifications();
    } catch (err) {
      toasts.error(err.message || 'Failed to reject verification');
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
    loadVerifications();
  });
</script>

<div class="min-h-screen bg-app-bg text-app-text flex">
  <!-- Admin Navigation Sidebar -->
  <Sidebar
    role="admin"
    activeTab={activeTab}
    onSelectTab={handleTabChange}
    badges={sidebarBadges}
  />

  <!-- Main Scrollable Content Area -->
  <div class="flex-1 overflow-y-auto max-h-screen p-4 sm:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto space-y-6">

      <!-- ===== DASHBOARD OVERVIEW ===== -->
      {#if activeTab === 'overview'}
        <div class="space-y-6">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-sm">
            <div>
              <div class="flex items-center space-x-2 text-xs font-bold text-[#D4A72C] uppercase tracking-wider">
                <span>System Administration & Operations</span>
              </div>
              <h1 class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-1">
                Platform Overview
              </h1>
              <p class="text-xs text-app-textMuted mt-1">
                Monitor live grocery procurement activity, account registrations, and supplier verification status.
              </p>
            </div>
            <div class="flex items-center gap-2">
              {#if pendingVerificationsCount > 0}
                <button
                  onclick={() => handleTabChange('verification')}
                  class="px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20 transition flex items-center gap-1.5"
                >
                  <ShieldCheck class="w-4 h-4" />
                  <span>{pendingVerificationsCount} Verification(s) Pending</span>
                </button>
              {:else}
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  <span>All Suppliers Verified</span>
                </span>
              {/if}
            </div>
          </div>

          <!-- Overview Metrics Grid -->
          {#if dashboardLoading}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {#each [1, 2, 3, 4] as _}
                <div class="h-28 bg-app-card rounded-2xl border border-app-border animate-shimmer"></div>
              {/each}
            </div>
          {:else}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
                <span class="text-xs font-bold text-app-textMuted uppercase">Registered Users</span>
                <div class="text-3xl font-extrabold font-heading text-app-text mt-2">{stats.users.total}</div>
                <span class="text-[10px] text-app-textMuted mt-1 block">Retailers: {stats.users.retailers} • Wholesalers: {stats.users.wholesalers}</span>
              </div>

              <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
                <span class="text-xs font-bold text-[#D4A72C] uppercase">Stock Requests</span>
                <div class="text-3xl font-extrabold font-heading text-[#D4A72C] mt-2">{stats.requests.total}</div>
                <span class="text-[10px] text-app-textMuted mt-1 block">Pending: {stats.requests.pending} • Accepted: {stats.requests.accepted}</span>
              </div>

              <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
                <span class="text-xs font-bold text-emerald-600 uppercase">Wholesaler Quotations</span>
                <div class="text-3xl font-extrabold font-heading text-emerald-600 mt-2">{stats.bids.total}</div>
                <span class="text-[10px] text-app-textMuted mt-1 block">Active supplier bids submitted</span>
              </div>

              <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-sm hover-lift">
                <span class="text-xs font-bold text-blue-500 uppercase">Product Catalog</span>
                <div class="text-3xl font-extrabold font-heading text-app-text mt-2">{categoriesList.length}</div>
                <span class="text-[10px] text-app-textMuted mt-1 block">Active product categories</span>
              </div>
            </div>

            <!-- Category Demand Breakdown -->
            {#if stats.requestsByCategory && stats.requestsByCategory.length > 0}
              <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
                <h2 class="text-base font-bold font-heading text-app-text">Procurement Demand by Category</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {#each stats.requestsByCategory as catStat}
                    <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle flex justify-between items-center">
                      <span class="text-xs font-bold text-app-text">{catStat._id || 'Uncategorized'}</span>
                      <span class="text-sm font-extrabold text-[#D4A72C] px-3 py-1 rounded-full bg-[#D4A72C]/10">
                        {catStat.count} requests
                      </span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/if}
        </div>

      <!-- ===== BUSINESS VERIFICATION TAB ===== -->
      {:else if activeTab === 'verification'}
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-6">
          <div class="flex justify-between items-center border-b border-app-border pb-4">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Supplier Compliance</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-0.5">Wholesaler Business Verification</h1>
              <p class="text-xs text-app-textMuted">Admin verification is independent of email OTP. Wholesalers cannot submit bids until approved.</p>
            </div>
            <button 
              onclick={loadVerifications}
              class="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-app-border hover:bg-app-cardSubtle flex items-center gap-1.5"
            >
              <RefreshCw class="w-3.5 h-3.5 {verificationsLoading ? 'animate-spin' : ''}" />
              <span>Refresh Queue</span>
            </button>
          </div>

          {#if verificationsLoading}
            <div class="space-y-3">
              {#each [1, 2, 3] as _}
                <div class="h-24 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
              {/each}
            </div>
          {:else if verificationsList.length === 0}
            <div class="text-center py-12 text-app-textMuted space-y-2">
              <ShieldCheck class="w-10 h-10 mx-auto text-[#D4A72C] opacity-50 mb-2" />
              <h3 class="text-sm font-bold text-app-text">No wholesaler accounts registered yet</h3>
            </div>
          {:else}
            <div class="space-y-3">
              {#each verificationsList as w (w._id)}
                <div class="p-5 rounded-2xl border border-app-border bg-app-cardSubtle flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover-lift">
                  <div class="space-y-1.5 flex-1">
                    <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span class="text-base font-bold text-app-text">{w.companyName || 'Wholesaler Supplier'}</span>
                      <span class="text-xs text-app-textMuted">({w.email})</span>
                      <span class="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider
                        {w.verificationStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                         w.verificationStatus === 'rejected' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                         'bg-amber-500/10 text-amber-600 border border-amber-500/20'}"
                      >
                        {w.verificationStatus}
                      </span>
                    </div>

                    <div class="text-xs text-app-textMuted grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <div>GST / Reg No: <strong class="text-app-text font-mono">{w.businessRegNo || 'Not Provided'}</strong></div>
                      <div>City / Area: <strong class="text-app-text">{w.city || 'Salem'}, {w.state || 'TN'}</strong></div>
                      <div>Service Radius: <strong class="text-[#D4A72C]">{w.deliveryRadiusKm || 25} km</strong></div>
                    </div>

                    {#if w.rejectionReason}
                      <p class="text-[11px] text-rose-500 font-medium">Rejection Reason: "{w.rejectionReason}"</p>
                    {/if}
                  </div>

                  <div class="flex items-center space-x-2 shrink-0">
                    {#if w.verificationStatus !== 'approved'}
                      <button 
                        onclick={() => handleApproveVerification(w._id, w.companyName)}
                        class="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center gap-1"
                      >
                        <CheckCircle2 class="w-3.5 h-3.5" />
                        <span>Approve Wholesaler</span>
                      </button>
                    {/if}

                    {#if w.verificationStatus !== 'rejected'}
                      <button 
                        onclick={() => openRejectModal(w._id)}
                        class="px-3.5 py-2 text-xs font-bold border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 rounded-xl transition"
                      >
                        Reject
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ===== USER ACCOUNTS TAB ===== -->
      {:else if activeTab === 'users'}
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-app-border pb-3">
            <div>
              <h2 class="text-lg font-bold font-heading text-app-text">Platform User Accounts ({usersList.length})</h2>
              <p class="text-xs text-app-textMuted">Inspect user roles, toggle account suspensions, or review delivery reliability.</p>
            </div>
            <div class="relative w-full sm:w-64">
              <input
                type="text"
                bind:value={userSearchQuery}
                placeholder="Search user, role, email..."
                class="w-full pl-8 pr-3 py-1.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-[#D4A72C]"
              />
              <Search class="w-3.5 h-3.5 text-app-textMuted absolute left-2.5 top-2.5" />
            </div>
          </div>

          {#if dashboardLoading}
            <div class="h-64 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-app-text">
                <thead class="bg-app-cardSubtle text-app-textMuted uppercase font-bold border-b border-app-border">
                  <tr>
                    <th class="p-3.5">User Email</th>
                    <th class="p-3.5">Role</th>
                    <th class="p-3.5">Business Name</th>
                    <th class="p-3.5">Email Status</th>
                    <th class="p-3.5">Account Status</th>
                    <th class="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-app-border/40">
                  {#each filteredUsers as user (user._id)}
                    <tr class="hover:bg-app-cardSubtle/60 transition">
                      <td class="p-3.5 font-bold">{user.email}</td>
                      <td class="p-3.5 uppercase font-bold text-[#D4A72C]">{user.role}</td>
                      <td class="p-3.5 text-app-textMuted">
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
                          {user.isEmailVerified ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}"
                        >
                          {user.isEmailVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td class="p-3.5">
                        <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px]
                          {user.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-500'}"
                        >
                          {user.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td class="p-3.5 text-right space-x-1.5">
                        {#if user.role === 'wholesaler' && user.profile?._id}
                          <button 
                            onclick={() => selectedScorecardWholesalerId = user.profile._id}
                            class="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#D4A72C]/10 text-[#D4A72C] hover:bg-[#D4A72C]/20 transition"
                            title="Inspect supplier delivery scorecard"
                          >
                            ⭐ Scorecard
                          </button>
                        {/if}
                        {#if user.role !== 'admin'}
                          <button 
                            onclick={() => toggleUserActive(user._id)}
                            class="px-3 py-1 text-xs font-bold rounded-lg transition
                              {user.isActive ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'}"
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

      <!-- ===== CATEGORIES MASTER TAB ===== -->
      {:else if activeTab === 'categories'}
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
          <div class="flex justify-between items-center border-b border-app-border pb-3">
            <div>
              <h2 class="text-base font-bold font-heading text-app-text">Categories Master ({categoriesList.length})</h2>
              <p class="text-xs text-app-textMuted">Standardized product categories used in procurement broadcasts.</p>
            </div>
            <button 
              onclick={() => openCategoryModal()}
              class="px-3.5 py-2 text-xs font-bold bg-[#D4A72C] text-[#202124] rounded-xl hover:bg-amber-600 transition flex items-center gap-1.5"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {#each categoriesList as cat (cat._id)}
              <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle flex justify-between items-center text-xs">
                <div>
                  <span class="font-bold text-app-text text-sm block">{cat.name}</span>
                  <span class="text-[11px] text-app-textMuted block">{cat.description || 'No description'}</span>
                </div>
                <div class="flex space-x-1">
                  <button onclick={() => openCategoryModal(cat)} class="p-1.5 text-app-textMuted hover:text-app-text">
                    <Edit2 class="w-3.5 h-3.5" />
                  </button>
                  <button onclick={() => handleDeleteCategory(cat._id)} class="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>

      <!-- ===== PRODUCT CATALOG TAB ===== -->
      {:else if activeTab === 'products'}
        <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4">
          <div class="flex justify-between items-center border-b border-app-border pb-3">
            <div>
              <h2 class="text-base font-bold font-heading text-app-text">Global Product Catalog ({productsList.length})</h2>
              <p class="text-xs text-app-textMuted">Master product definitions available for standard single-click retailer requests.</p>
            </div>
            <button 
              onclick={() => openProductModal()}
              class="px-4 py-2 text-xs font-bold bg-[#D4A72C] text-[#202124] rounded-xl hover:bg-amber-600 transition flex items-center gap-1.5"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add Global Product</span>
            </button>
          </div>

          {#if dashboardLoading}
            <div class="h-48 bg-app-cardSubtle rounded-2xl animate-shimmer"></div>
          {:else}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each productsList as prod (prod._id)}
                <div class="p-4 rounded-2xl border border-app-border bg-app-cardSubtle flex justify-between items-start text-xs">
                  <div class="space-y-1">
                    <span class="font-bold text-app-text text-sm block">{prod.name}</span>
                    <span class="text-app-textMuted block">Brand: <strong>{prod.brand}</strong></span>
                    <span class="text-[#D4A72C] font-semibold block">Unit: {prod.defaultUnit}</span>
                  </div>
                  <div class="flex space-x-1">
                    <button onclick={() => openProductModal(prod)} class="p-1.5 text-app-textMuted hover:text-app-text">
                      <Edit2 class="w-3.5 h-3.5" />
                    </button>
                    <button onclick={() => handleDeleteProduct(prod._id)} class="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg">
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ===== SYSTEM SETTINGS & PROFILE TAB ===== -->
      {:else if activeTab === 'settings'}
        <div>
          <div class="mb-4">
            <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-widest">Platform Admin</div>
            <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">System Settings & Profile</h1>
          </div>
          <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-sm space-y-4 max-w-xl">
            <div class="flex items-center space-x-4">
              <div class="w-16 h-16 rounded-2xl bg-[#B9DDE5]/30 flex items-center justify-center text-2xl font-black text-[#202124]">
                A
              </div>
              <div>
                <p class="font-bold text-app-text">{auth.user?.email}</p>
                <p class="text-xs text-app-textMuted capitalize">System Administrator</p>
                <span class="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">Platform Superuser</span>
              </div>
            </div>
            <div class="pt-3 border-t border-app-border text-xs space-y-2">
              <div class="flex justify-between py-1">
                <span class="text-app-textMuted">Environment</span>
                <span class="font-bold text-app-text">Production B2B Platform</span>
              </div>
              <div class="flex justify-between py-1">
                <span class="text-app-textMuted">Color Palette</span>
                <span class="font-bold text-app-text">Mustard / Charcoal / Pale Blue / Cream</span>
              </div>
            </div>
            <div class="pt-3 border-t border-app-border">
              <button onclick={() => auth.clearSession()} class="px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/30 rounded-xl transition">Sign Out</button>
            </div>
          </div>
        </div>
      {/if}

    </div>
  </div>
</div>

<!-- Rejection Modal -->
{#if showRejectModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-sm rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <h3 class="text-base font-bold font-heading text-app-text">Reject Wholesaler Verification</h3>
      <p class="text-xs text-app-textMuted">Provide an explanation for rejecting this business verification:</p>
      <textarea
        bind:value={rejectionReasonInput}
        rows="3"
        placeholder="e.g. GST number invalid or address proof not provided..."
        class="w-full p-3 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:border-rose-500 resize-none"
      ></textarea>
      <div class="flex space-x-3 pt-2">
        <button onclick={() => showRejectModal = false} class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-textMuted">Cancel</button>
        <button onclick={handleConfirmReject} class="flex-1 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs">Reject Account</button>
      </div>
    </div>
  </div>
{/if}

<!-- Category Form Modal -->
{#if showCategoryModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-app-card w-full max-w-sm rounded-3xl border border-app-border shadow-2xl p-6 space-y-4 animate-toast">
      <h3 class="text-base font-bold font-heading text-app-text">{categoryFormId ? 'Edit Category' : 'Create Category'}</h3>
      <form onsubmit={handleSaveCategory} class="space-y-4 text-xs">
        {#if categoryFormError}
          <div class="p-3 text-xs bg-rose-500/10 text-rose-600 rounded-xl font-semibold border border-rose-500/20">{categoryFormError}</div>
        {/if}
        <div>
          <label for="cat-name-input" class="block font-bold text-app-text uppercase mb-1">Category Name *</label>
          <input id="cat-name-input" type="text" bind:value={categoryFormName} placeholder="Edible Oils" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C]" required />
        </div>
        <div>
          <label for="cat-desc-input" class="block font-bold text-app-textMuted uppercase mb-1">Description</label>
          <input id="cat-desc-input" type="text" bind:value={categoryFormDesc} placeholder="Vegetable oil, sunflower oil..." class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" />
        </div>
        <div class="flex space-x-3 pt-2">
          <button type="button" onclick={() => showCategoryModal = false} class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-textMuted">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs">Save</button>
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
          <div class="p-3 text-xs bg-rose-500/10 text-rose-600 rounded-xl font-semibold border border-rose-500/20">{productFormError}</div>
        {/if}
        <div>
          <label for="prod-name-input" class="block font-bold text-app-text uppercase mb-1">Product Name *</label>
          <input id="prod-name-input" type="text" bind:value={productFormName} placeholder="Sunflower Cooking Oil" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text focus:ring-2 focus:ring-[#D4A72C]" required />
        </div>
        <div>
          <label for="prod-cat-select" class="block font-bold text-app-text uppercase mb-1">Category *</label>
          <select id="prod-cat-select" bind:value={productFormCatId} class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" required>
            {#each categoriesList as cat}
              <option value={cat._id}>{cat.name}</option>
            {/each}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="prod-brand-input" class="block font-bold text-app-text uppercase mb-1">Brand *</label>
            <input id="prod-brand-input" type="text" bind:value={productFormBrand} placeholder="Fortune" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" required />
          </div>
          <div>
            <label for="prod-unit-input" class="block font-bold text-app-text uppercase mb-1">Default Unit *</label>
            <input id="prod-unit-input" type="text" bind:value={productFormUnit} placeholder="liter, kg" class="w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-xs text-app-text" required />
          </div>
        </div>
        <div class="flex space-x-3 pt-2">
          <button type="button" onclick={() => showProductModal = false} class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-textMuted">Cancel</button>
          <button type="submit" class="flex-1 py-2.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs">Save</button>
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
      <p class="text-xs text-app-textMuted leading-relaxed">{confirmMessage}</p>
      <div class="flex space-x-3 pt-2">
        <button onclick={() => showConfirmModal = false} class="flex-1 py-2.5 text-xs font-bold border border-app-border rounded-xl text-app-textMuted">Cancel</button>
        <button onclick={confirmCallback} class="flex-1 py-2.5 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs">Confirm</button>
      </div>
    </div>
  </div>
{/if}

<!-- Supplier Performance Scorecard Modal -->
{#if selectedScorecardWholesalerId}
  <SupplierScorecardModal 
    wholesalerId={selectedScorecardWholesalerId} 
    onClose={() => selectedScorecardWholesalerId = null} 
  />
{/if}
