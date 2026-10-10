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
    Settings,
    Truck,
    FileText,
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
    Award,
    Filter,
    ShieldAlert,
    Activity,
    Server,
    Database,
    Mail,
    Lock,
    ExternalLink
  } from 'lucide-svelte';

  // Active Tab: 'overview' | 'verification' | 'users' | 'categories' | 'settings' | 'orders' | 'audit'
  let activeTab = $state('overview');
  let dashboardLoading = $state(true);
  let errorState = $state(null);

  // Scorecard inspection state
  let selectedScorecardWholesalerId = $state(null);

  // Data State: Overview Stats
  let stats = $state({
    users: { total: 0, retailers: 0, wholesalers: 0, admins: 0 },
    verifications: { verified: 0, pending: 0, rejected: 0 },
    requests: { total: 0, active: 0, accepted: 0, rejected: 0 },
    bids: { total: 0, open: 0 },
    orders: { total: 0, active: 0, completed: 0, cancelled: 0, totalValue: 0 },
    disputes: { open: 0 },
    pendingVerifications: 0,
    orderStatusDistribution: [],
    requestsByCategory: [],
    recentActivity: []
  });

  // Data State: Users
  let usersList = $state([]);
  let userSearchQuery = $state('');
  let userRoleFilter = $state('all');
  let userStatusFilter = $state('all');

  // Data State: Business Verifications
  let verificationsList = $state([]);
  let verificationsLoading = $state(false);
  let showRejectModal = $state(false);
  let rejectingVerificationId = $state(null);
  let rejectionReasonInput = $state('');

  // Data State: Categories Master
  let categoriesList = $state([]);
  let categoriesLoading = $state(false);
  let showCategoryModal = $state(false);
  let categoryFormId = $state('');
  let categoryFormName = $state('');
  let categoryFormDesc = $state('');
  let categoryFormError = $state('');

  // Data State: Orders & Disputes
  let ordersList = $state([]);
  let disputesList = $state([]);
  let ordersLoading = $state(false);
  let orderStatusFilter = $state('all');
  let orderSearchQuery = $state('');
  let disputeTabMode = $state('orders'); // 'orders' | 'disputes'

  // Dispute Modals
  let showCreateDisputeModal = $state(false);
  let selectedOrderForDispute = $state(null);
  let disputeReasonInput = $state('');
  let disputeDescriptionInput = $state('');
  let disputeFormLoading = $state(false);

  let showResolveDisputeModal = $state(false);
  let selectedDisputeForResolve = $state(null);
  let disputeResolveStatus = $state('resolved');
  let disputeInvestigationNotes = $state('');
  let disputeResolutionOutcome = $state('');
  let disputeResolveLoading = $state(false);

  // Data State: System Settings
  let systemSettings = $state(null);
  let settingsLoading = $state(false);
  let purgeLoading = $state(false);
  let purgeResult = $state(null);

  // Data State: Audit Logs
  let auditLogsList = $state([]);
  let auditLogsLoading = $state(false);
  let auditActionFilter = $state('all');
  let auditSearchQuery = $state('');

  // Confirmation Modal
  let showConfirmModal = $state(false);
  let confirmTitle = $state('Confirm Action');
  let confirmMessage = $state('');
  let confirmCallback = $state(null);

  let pendingVerificationsCount = $derived(
    verificationsList.filter(v => v.verificationStatus === 'pending').length
  );

  let openDisputesCount = $derived(
    disputesList.filter(d => ['open', 'under_investigation'].includes(d.status)).length
  );

  let sidebarBadges = $derived({
    pendingVerifications: pendingVerificationsCount,
    activeDisputes: openDisputesCount
  });

  let filteredUsers = $derived(
    usersList.filter(u => {
      const matchesSearch = !userSearchQuery ||
        u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.role?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.profile?.companyName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.profile?.storeName?.toLowerCase().includes(userSearchQuery.toLowerCase());

      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      const matchesStatus = userStatusFilter === 'all' ||
        (userStatusFilter === 'active' && u.isActive) ||
        (userStatusFilter === 'suspended' && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    })
  );

  let filteredOrders = $derived(
    ordersList.filter(o => {
      const matchesStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
      const matchesSearch = !orderSearchQuery ||
        o.productName?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        o._id?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        o.retailerProfile?.storeName?.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        o.wholesalerProfile?.companyName?.toLowerCase().includes(orderSearchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    })
  );

  let filteredAuditLogs = $derived(
    auditLogsList.filter(log => {
      const matchesAction = auditActionFilter === 'all' || log.action === auditActionFilter;
      const matchesSearch = !auditSearchQuery ||
        log.details?.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        log.adminEmail?.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
        log.action?.toLowerCase().includes(auditSearchQuery.toLowerCase());
      return matchesAction && matchesSearch;
    })
  );

  function triggerConfirm(title, message, callback) {
    confirmTitle = title;
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
    if (tab === 'settings') loadSettings();
    if (tab === 'orders') {
      loadOrders();
      loadDisputes();
    }
    if (tab === 'audit') loadAuditLogs();
  }

  // --- API LOADERS ---

  async function loadOverview() {
    dashboardLoading = true;
    errorState = null;
    try {
      const res = await api.get('/admin/stats');
      if (res.success || res.users) {
        stats = res;
      }
    } catch (err) {
      console.error(err);
      errorState = 'Unable to fetch real-time dashboard statistics from database.';
      toasts.error(errorState);
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
    triggerConfirm(
      'Approve Business Verification',
      `Are you sure you want to approve "${companyName}" for wholesale trading on GrocerStock?`,
      async () => {
        try {
          await api.put(`/admin/verifications/${wholesalerId}/approve`);
          toasts.success(`Business verification approved for "${companyName}"!`);
          await loadVerifications();
          loadOverview();
        } catch (err) {
          toasts.error(err.message || 'Failed to approve verification');
        }
      }
    );
  }

  function openRejectModal(wholesalerId) {
    rejectingVerificationId = wholesalerId;
    rejectionReasonInput = '';
    showRejectModal = true;
  }

  async function handleConfirmReject() {
    if (!rejectingVerificationId) return;
    if (!rejectionReasonInput.trim()) {
      toasts.error('Please enter a clear reason for rejecting the application.');
      return;
    }
    try {
      await api.put(`/admin/verifications/${rejectingVerificationId}/reject`, {
        reason: rejectionReasonInput.trim()
      });
      toasts.success('Wholesaler application rejected with reason notice recorded.');
      showRejectModal = false;
      rejectingVerificationId = null;
      await loadVerifications();
      loadOverview();
    } catch (err) {
      toasts.error(err.message || 'Failed to reject verification');
    }
  }

  async function loadUsers() {
    dashboardLoading = true;
    try {
      const res = await api.get('/admin/users');
      usersList = res.users || [];
    } catch (err) {
      console.error(err);
      toasts.error('Failed to fetch user accounts');
    } finally {
      dashboardLoading = false;
    }
  }

  async function handleToggleUserStatus(user) {
    const actionLabel = user.isActive ? 'suspend' : 'activate';
    triggerConfirm(
      `${actionLabel.toUpperCase()} User Account`,
      `Are you sure you want to ${actionLabel} account "${user.email}" (${user.role})? ${user.isActive ? 'They will be prevented from logging in or conducting transactions.' : 'Their account access will be restored.'}`,
      async () => {
        try {
          const res = await api.put(`/admin/users/${user._id}/status`);
          toasts.success(res.message || `Account updated successfully`);
          await loadUsers();
          loadOverview();
        } catch (err) {
          toasts.error(err.message || 'Failed to update user status');
        }
      }
    );
  }

  async function loadCategories() {
    categoriesLoading = true;
    try {
      const res = await api.get('/admin/categories');
      categoriesList = res.categories || [];
    } catch (err) {
      console.error(err);
      toasts.error('Failed to fetch categories');
    } finally {
      categoriesLoading = false;
    }
  }

  function openCreateCategoryModal() {
    categoryFormId = '';
    categoryFormName = '';
    categoryFormDesc = '';
    categoryFormError = '';
    showCategoryModal = true;
  }

  function openEditCategoryModal(cat) {
    categoryFormId = cat._id;
    categoryFormName = cat.name;
    categoryFormDesc = cat.description || '';
    categoryFormError = '';
    showCategoryModal = true;
  }

  async function handleSaveCategory(e) {
    e.preventDefault();
    categoryFormError = '';
    if (!categoryFormName.trim()) {
      categoryFormError = 'Category name is required';
      return;
    }
    try {
      if (categoryFormId) {
        await api.put(`/admin/categories/${categoryFormId}`, {
          name: categoryFormName.trim(),
          description: categoryFormDesc.trim()
        });
        toasts.success('Category updated successfully');
      } else {
        await api.post('/admin/categories', {
          name: categoryFormName.trim(),
          description: categoryFormDesc.trim()
        });
        toasts.success('Category created successfully');
      }
      showCategoryModal = false;
      await loadCategories();
    } catch (err) {
      categoryFormError = err.message || 'Failed to save category';
    }
  }

  async function handleDeleteCategory(cat) {
    triggerConfirm(
      'Remove Category',
      `Delete category "${cat.name}"? The system will check if any stock or order records are currently using this category.`,
      async () => {
        try {
          const res = await api.delete(`/admin/categories/${cat._id}`);
          toasts.success(res.message || 'Category deleted');
          await loadCategories();
        } catch (err) {
          toasts.error(err.message || 'Failed to remove category');
        }
      }
    );
  }

  async function loadOrders() {
    ordersLoading = true;
    try {
      const res = await api.get('/admin/orders');
      ordersList = res.orders || [];
    } catch (err) {
      console.error(err);
      toasts.error('Failed to fetch platform orders');
    } finally {
      ordersLoading = false;
    }
  }

  async function loadDisputes() {
    try {
      const res = await api.get('/admin/disputes');
      disputesList = res.disputes || [];
    } catch (err) {
      console.error(err);
    }
  }

  function openCreateDispute(ord) {
    selectedOrderForDispute = ord;
    disputeReasonInput = 'Delivery SLA Delay / Quality Mismatch';
    disputeDescriptionInput = '';
    showCreateDisputeModal = true;
  }

  async function handleCreateDispute(e) {
    e.preventDefault();
    if (!selectedOrderForDispute) return;
    if (!disputeReasonInput.trim() || !disputeDescriptionInput.trim()) {
      toasts.error('Please specify dispute reason and details');
      return;
    }
    disputeFormLoading = true;
    try {
      const res = await api.post(`/admin/orders/${selectedOrderForDispute._id}/dispute`, {
        reason: disputeReasonInput.trim(),
        description: disputeDescriptionInput.trim()
      });
      toasts.success(`Dispute ${res.dispute.disputeId} logged successfully`);
      showCreateDisputeModal = false;
      await loadOrders();
      await loadDisputes();
      loadOverview();
    } catch (err) {
      toasts.error(err.message || 'Failed to create dispute');
    } finally {
      disputeFormLoading = false;
    }
  }

  function openResolveDispute(disp) {
    selectedDisputeForResolve = disp;
    disputeResolveStatus = disp.status === 'open' ? 'under_investigation' : 'resolved';
    disputeInvestigationNotes = disp.investigationNotes || '';
    disputeResolutionOutcome = disp.resolutionOutcome || '';
    showResolveDisputeModal = true;
  }

  async function handleResolveDispute(e) {
    e.preventDefault();
    if (!selectedDisputeForResolve) return;
    disputeResolveLoading = true;
    try {
      await api.put(`/admin/disputes/${selectedDisputeForResolve._id}/resolve`, {
        status: disputeResolveStatus,
        investigationNotes: disputeInvestigationNotes.trim(),
        resolutionOutcome: disputeResolutionOutcome.trim()
      });
      toasts.success(`Dispute marked as ${disputeResolveStatus.toUpperCase().replace(/_/g, ' ')}`);
      showResolveDisputeModal = false;
      await loadDisputes();
      await loadOrders();
      loadOverview();
    } catch (err) {
      toasts.error(err.message || 'Failed to update dispute');
    } finally {
      disputeResolveLoading = false;
    }
  }

  async function loadSettings() {
    settingsLoading = true;
    try {
      const res = await api.get('/admin/settings');
      systemSettings = res.settings;
    } catch (err) {
      console.error(err);
      toasts.error('Failed to load system settings');
    } finally {
      settingsLoading = false;
    }
  }

  async function handlePurgeDemoInventory() {
    triggerConfirm(
      'Purge Demo Inventory',
      'This will permanently remove all auto-seeded demo catalogue items (stock qty=100) from ALL wholesaler inventories. User-modified records will be preserved. This action is logged in the Audit Log.',
      async () => {
        purgeLoading = true;
        purgeResult = null;
        try {
          const res = await api.delete('/admin/purge-demo-inventory');
          purgeResult = res;
          toasts.success(res.message || 'Demo inventory purged successfully');
          loadOverview();
        } catch (err) {
          toasts.error(err.message || 'Failed to purge demo inventory');
        } finally {
          purgeLoading = false;
        }
      }
    );
  }

  async function loadAuditLogs() {
    auditLogsLoading = true;
    try {
      const res = await api.get('/admin/audit-logs');
      auditLogsList = res.logs || [];
    } catch (err) {
      console.error(err);
      toasts.error('Failed to load administrative audit logs');
    } finally {
      auditLogsLoading = false;
    }
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
    loadVerifications();
    loadDisputes();
  });
</script>

<div class="min-h-screen bg-app-bg text-app-text flex transition-colors duration-200">
  <!-- System Sidebar -->
  <Sidebar
    role="admin"
    activeTab={activeTab}
    onSelectTab={handleTabChange}
    badges={sidebarBadges}
  />

  <!-- Main Administrative Content -->
  <div class="flex-1 overflow-y-auto max-h-screen p-4 sm:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto space-y-6">

      <!-- ========================================================================= -->
      <!-- MODULE 1: DASHBOARD OVERVIEW -->
      <!-- ========================================================================= -->
      {#if activeTab === 'overview'}
        <div class="space-y-6 animate-page-fade">
          <!-- Top Header -->
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-xs">
            <div>
              <div class="flex items-center space-x-2 text-xs font-bold text-[#D4A72C] uppercase tracking-wider">
                <ShieldCheck class="w-4 h-4 text-[#D4A72C]" />
                <span>Command & Control Center</span>
              </div>
              <h1 class="text-2xl sm:text-3xl font-extrabold font-heading text-app-text mt-1">
                Platform Overview
              </h1>
              <p class="text-xs text-app-textMuted mt-1">
                Real-time operational metrics across registered retailers, wholesale suppliers, and fulfilled procurement orders.
              </p>
            </div>
            <button
              onclick={loadOverview}
              class="px-4 py-2 text-xs font-bold border border-app-border bg-app-cardSubtle hover:bg-app-card text-app-text rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw class="w-3.5 h-3.5 {dashboardLoading ? 'animate-spin' : ''}" />
              <span>Refresh Metrics</span>
            </button>
          </div>

          {#if errorState}
            <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center gap-3">
              <AlertTriangle class="w-4 h-4" />
              <span>{errorState}</span>
            </div>
          {/if}

          <!-- Metric Cards Grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <!-- Retailers -->
            <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-xs">
              <span class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider block">Retailers</span>
              <div class="text-3xl font-extrabold font-heading text-app-text mt-2">{stats.users?.retailers ?? 0}</div>
              <span class="text-[11px] text-app-textMuted mt-1 block">Active grocery shops</span>
            </div>

            <!-- Wholesalers -->
            <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-xs">
              <div class="flex justify-between items-start">
                <span class="text-xs font-bold text-amber-500 uppercase tracking-wider block">Wholesalers</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600">
                  {stats.verifications?.verified ?? 0} Verified
                </span>
              </div>
              <div class="text-3xl font-extrabold font-heading text-app-text mt-2">{stats.users?.wholesalers ?? 0}</div>
              <span class="text-[11px] text-app-textMuted mt-1 block">
                {stats.verifications?.pending ?? 0} pending KYC review
              </span>
            </div>

            <!-- Active RFQs -->
            <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-xs">
              <span class="text-xs font-bold text-blue-500 uppercase tracking-wider block">Stock Requests</span>
              <div class="text-3xl font-extrabold font-heading text-app-text mt-2">{stats.requests?.active ?? 0}</div>
              <span class="text-[11px] text-app-textMuted mt-1 block">
                {stats.requests?.total ?? 0} total requests ({stats.bids?.total ?? 0} bids submitted)
              </span>
            </div>

            <!-- Orders & Revenue -->
            <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-xs">
              <span class="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Procurement Orders</span>
              <div class="text-3xl font-extrabold font-heading text-emerald-600 mt-2">{stats.orders?.total ?? 0}</div>
              <span class="text-[11px] text-app-textMuted mt-1 block">
                ₹{(stats.orders?.totalValue ?? 0).toLocaleString('en-IN')} total fulfilled
              </span>
            </div>
          </div>

          <!-- Secondary Metrics Row -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Order Status Pipeline -->
            <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-xs space-y-4">
              <h3 class="text-sm font-bold font-heading text-app-text flex items-center justify-between">
                <span>Order Pipeline Distribution</span>
                <span class="text-xs text-app-textMuted font-normal">{stats.orders?.total ?? 0} total</span>
              </h3>
              {#if stats.orderStatusDistribution && stats.orderStatusDistribution.length > 0}
                <div class="space-y-2.5">
                  {#each stats.orderStatusDistribution as st}
                    <div class="flex items-center justify-between text-xs">
                      <span class="capitalize text-app-textMuted font-medium">{st.status.replace(/_/g, ' ')}</span>
                      <span class="font-extrabold font-mono text-app-text bg-app-cardSubtle px-2 py-0.5 rounded-lg border border-app-border">{st.count}</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-app-textMuted py-4 text-center">No orders recorded in system yet.</p>
              {/if}
            </div>

            <!-- Category Distribution -->
            <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-xs space-y-4">
              <h3 class="text-sm font-bold font-heading text-app-text flex items-center justify-between">
                <span>Procurement by Category</span>
                <span class="text-xs text-app-textMuted font-normal">{stats.requestsByCategory?.length ?? 0} categories</span>
              </h3>
              {#if stats.requestsByCategory && stats.requestsByCategory.length > 0}
                <div class="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {#each stats.requestsByCategory as cat}
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-app-textMuted font-medium truncate max-w-[160px]">{cat.name}</span>
                      <span class="font-bold font-mono text-app-text bg-app-cardSubtle px-2 py-0.5 rounded-lg border border-app-border">{cat.count} requests</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-app-textMuted py-4 text-center">No category distribution data available.</p>
              {/if}
            </div>

            <!-- Verification & Disputes Health -->
            <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-xs space-y-4">
              <h3 class="text-sm font-bold font-heading text-app-text">System Attention Items</h3>
              <div class="space-y-3">
                <button
                  onclick={() => handleTabChange('verification')}
                  class="w-full text-left p-3 rounded-2xl bg-app-cardSubtle border border-app-border hover:border-amber-500/50 transition flex items-center justify-between"
                >
                  <div class="flex items-center space-x-2.5 text-xs">
                    <Clock class="w-4 h-4 text-amber-500" />
                    <span>Pending Wholesaler KYC</span>
                  </div>
                  <strong class="text-sm text-amber-500 font-extrabold">{stats.verifications?.pending ?? 0}</strong>
                </button>

                <button
                  onclick={() => handleTabChange('orders')}
                  class="w-full text-left p-3 rounded-2xl bg-app-cardSubtle border border-app-border hover:border-rose-500/50 transition flex items-center justify-between"
                >
                  <div class="flex items-center space-x-2.5 text-xs">
                    <ShieldAlert class="w-4 h-4 text-rose-500" />
                    <span>Open Order Disputes</span>
                  </div>
                  <strong class="text-sm text-rose-500 font-extrabold">{stats.disputes?.open ?? 0}</strong>
                </button>

                <button
                  onclick={() => handleTabChange('users')}
                  class="w-full text-left p-3 rounded-2xl bg-app-cardSubtle border border-app-border hover:border-blue-500/50 transition flex items-center justify-between"
                >
                  <div class="flex items-center space-x-2.5 text-xs">
                    <Users class="w-4 h-4 text-blue-500" />
                    <span>Total Registered Users</span>
                  </div>
                  <strong class="text-sm text-app-text font-extrabold">{stats.users?.total ?? 0}</strong>
                </button>
              </div>
            </div>
          </div>

          <!-- Recent Activity Log -->
          <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-xs space-y-4">
            <h3 class="text-sm font-bold font-heading text-app-text">Recent Platform Transactions</h3>
            {#if stats.recentActivity && stats.recentActivity.length > 0}
              <div class="divide-y divide-app-border">
                {#each stats.recentActivity as act}
                  <div class="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                    <div class="flex items-center space-x-3">
                      <span class="w-2 h-2 rounded-full {act.type === 'order' ? 'bg-emerald-500' : 'bg-[#D4A72C]'}"></span>
                      <span class="font-bold text-app-text">{act.title}</span>
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-app-cardSubtle border border-app-border text-app-textMuted">
                        {act.status}
                      </span>
                    </div>
                    <span class="text-app-textMuted text-[11px] font-mono">
                      {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-app-textMuted py-4 text-center">No platform transactions logged yet.</p>
            {/if}
          </div>
        </div>

      <!-- ========================================================================= -->
      <!-- MODULE 2: BUSINESS VERIFICATION -->
      <!-- ========================================================================= -->
      {:else if activeTab === 'verification'}
        <div class="space-y-6 animate-page-fade">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-xs">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Wholesaler Trust & Safety</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Business Verification Desk</h1>
              <p class="text-xs text-app-textMuted mt-1">Review trade registration numbers, warehouse addresses, and approve or reject wholesaler trading access.</p>
            </div>
            <button
              onclick={loadVerifications}
              class="px-4 py-2 text-xs font-bold border border-app-border bg-app-cardSubtle hover:bg-app-card rounded-xl text-app-text transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw class="w-3.5 h-3.5 {verificationsLoading ? 'animate-spin' : ''}" />
              <span>Refresh Applications</span>
            </button>
          </div>

          {#if verificationsLoading}
            <div class="space-y-3">
              {#each [1, 2, 3] as _}
                <div class="h-28 bg-app-card rounded-2xl animate-shimmer border border-app-border"></div>
              {/each}
            </div>
          {:else if verificationsList.length === 0}
            <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-2">
              <ShieldCheck class="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 class="text-base font-bold text-app-text">No wholesaler verification applications</h3>
              <p class="text-xs text-app-textMuted max-w-sm mx-auto">When new wholesale suppliers register with business credentials, their applications will appear here for review.</p>
            </div>
          {:else}
            <div class="space-y-4">
              {#each verificationsList as app}
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover-lift">
                  <div class="space-y-2 flex-1">
                    <div class="flex items-center space-x-3 flex-wrap gap-y-1">
                      <span class="text-base font-bold text-app-text">{app.companyName || 'Wholesale Supplier'}</span>
                      <span class="text-xs text-app-textMuted">({app.email})</span>

                      <!-- Status Badge -->
                      {#if app.verificationStatus === 'approved'}
                        <span class="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 class="w-3 h-3" />
                          <span>Approved</span>
                        </span>
                      {:else if app.verificationStatus === 'rejected'}
                        <span class="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-600 border border-rose-500/30 flex items-center gap-1">
                          <XCircle class="w-3 h-3" />
                          <span>Rejected</span>
                        </span>
                      {:else}
                        <span class="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30 flex items-center gap-1">
                          <Clock class="w-3 h-3" />
                          <span>Pending KYC Review</span>
                        </span>
                      {/if}
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-app-textMuted pt-1">
                      <div><strong class="text-app-text">Trade Reg No:</strong> {app.businessRegNo || 'Not specified'}</div>
                      <div><strong class="text-app-text">Phone:</strong> {app.phone || 'N/A'}</div>
                      <div><strong class="text-app-text">City:</strong> {app.city || 'N/A'}, {app.state || ''}</div>
                      <div><strong class="text-app-text">Delivery Radius:</strong> {app.deliveryRadiusKm ?? 25} km</div>
                    </div>

                    {#if app.address}
                      <p class="text-[11px] text-app-textMuted">Warehouse Address: {app.address}</p>
                    {/if}

                    {#if app.verificationStatus === 'rejected' && app.rejectionReason}
                      <p class="text-[11px] text-rose-500 font-semibold italic bg-rose-500/5 p-2 rounded-xl border border-rose-500/20">
                        Rejection Reason: "{app.rejectionReason}"
                      </p>
                    {/if}
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center space-x-2 shrink-0">
                    {#if app.verificationStatus !== 'approved'}
                      <button
                        onclick={() => handleApproveVerification(app._id, app.companyName)}
                        class="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition cursor-pointer"
                      >
                        Approve
                      </button>
                    {/if}
                    {#if app.verificationStatus !== 'rejected'}
                      <button
                        onclick={() => openRejectModal(app._id)}
                        class="px-4 py-2 text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30 rounded-xl transition cursor-pointer"
                      >
                        Reject
                      </button>
                    {/if}
                    {#if app.userId}
                      <button
                        onclick={() => selectedScorecardWholesalerId = app.userId}
                        class="p-2 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text rounded-xl hover:bg-app-card transition cursor-pointer"
                        title="View Scorecard"
                      >
                        <Award class="w-4 h-4 text-[#D4A72C]" />
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ========================================================================= -->
      <!-- MODULE 3: USER MANAGEMENT -->
      <!-- ========================================================================= -->
      {:else if activeTab === 'users'}
        <div class="space-y-6 animate-page-fade">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-xs">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Account Administration</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">User Directory ({filteredUsers.length})</h1>
              <p class="text-xs text-app-textMuted mt-1">Search, inspect credentials, and manage active status of retailers, wholesalers, and system administrators.</p>
            </div>
            <button
              onclick={loadUsers}
              class="px-4 py-2 text-xs font-bold border border-app-border bg-app-cardSubtle hover:bg-app-card rounded-xl text-app-text transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw class="w-3.5 h-3.5 {dashboardLoading ? 'animate-spin' : ''}" />
              <span>Refresh Users</span>
            </button>
          </div>

          <!-- Filters Row -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-app-card p-4 rounded-2xl border border-app-border shadow-xs">
            <!-- Search Input -->
            <div class="relative flex-1">
              <Search class="w-4 h-4 text-app-textMuted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                bind:value={userSearchQuery}
                placeholder="Search by email, name, store, or role..."
                class="w-full pl-10 pr-4 py-2 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
              />
            </div>

            <!-- Role Tabs -->
            <div class="flex items-center space-x-1.5 bg-app-cardSubtle p-1 rounded-xl border border-app-border text-xs">
              <button
                onclick={() => userRoleFilter = 'all'}
                class="px-3 py-1 rounded-lg font-bold transition {userRoleFilter === 'all' ? 'bg-[#D4A72C] text-[#202124]' : 'text-app-textMuted hover:text-app-text'}"
              >All</button>
              <button
                onclick={() => userRoleFilter = 'retailer'}
                class="px-3 py-1 rounded-lg font-bold transition {userRoleFilter === 'retailer' ? 'bg-[#D4A72C] text-[#202124]' : 'text-app-textMuted hover:text-app-text'}"
              >Retailers</button>
              <button
                onclick={() => userRoleFilter = 'wholesaler'}
                class="px-3 py-1 rounded-lg font-bold transition {userRoleFilter === 'wholesaler' ? 'bg-[#D4A72C] text-[#202124]' : 'text-app-textMuted hover:text-app-text'}"
              >Wholesalers</button>
              <button
                onclick={() => userRoleFilter = 'admin'}
                class="px-3 py-1 rounded-lg font-bold transition {userRoleFilter === 'admin' ? 'bg-[#D4A72C] text-[#202124]' : 'text-app-textMuted hover:text-app-text'}"
              >Admins</button>
            </div>
          </div>

          <!-- Users Table -->
          <div class="bg-app-card rounded-3xl border border-app-border overflow-hidden shadow-xs">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-app-cardSubtle border-b border-app-border text-app-textMuted uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    <th class="p-4">User / Organization</th>
                    <th class="p-4">System Role</th>
                    <th class="p-4">Email Status</th>
                    <th class="p-4">KYC / Verification</th>
                    <th class="p-4">Registered</th>
                    <th class="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-app-border">
                  {#each filteredUsers as u}
                    <tr class="hover:bg-app-cardSubtle/50 transition">
                      <td class="p-4">
                        <div class="font-bold text-app-text">{u.email}</div>
                        {#if u.profile?.companyName || u.profile?.storeName}
                          <div class="text-[11px] text-app-textMuted">
                            {u.profile?.companyName || u.profile?.storeName}
                            {#if u.profile?.city} • {u.profile?.city}{/if}
                          </div>
                        {/if}
                      </td>
                      <td class="p-4">
                        <span class="inline-block px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px]
                          {u.role === 'admin' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : u.role === 'wholesaler' ? 'bg-[#D4A72C]/10 text-[#D4A72C] border border-[#D4A72C]/30' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}">
                          {u.role}
                        </span>
                      </td>
                      <td class="p-4">
                        {#if u.isEmailVerified}
                          <span class="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 class="w-3.5 h-3.5" /> Verified
                          </span>
                        {:else}
                          <span class="text-amber-500 font-semibold flex items-center gap-1">
                            <Clock class="w-3.5 h-3.5" /> Unverified
                          </span>
                        {/if}
                      </td>
                      <td class="p-4">
                        {#if u.role === 'wholesaler'}
                          {#if u.profile?.businessVerification?.status === 'approved'}
                            <span class="text-emerald-600 font-bold">Approved</span>
                          {:else if u.profile?.businessVerification?.status === 'rejected'}
                            <span class="text-rose-500 font-bold">Rejected</span>
                          {:else}
                            <span class="text-amber-500 font-bold">Pending KYC</span>
                          {/if}
                        {:else}
                          <span class="text-app-textMuted">N/A</span>
                        {/if}
                      </td>
                      <td class="p-4 font-mono text-app-textMuted text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td class="p-4 text-right">
                        {#if u.role !== 'admin' || (u.role === 'admin' && u._id !== auth.user?._id)}
                          <button
                            onclick={() => handleToggleUserStatus(u)}
                            class="px-3 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer
                              {u.isActive ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/30' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'}"
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        {:else}
                          <span class="text-[11px] text-app-textMuted italic">Current Admin</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      <!-- ========================================================================= -->
      <!-- MODULE 4: CATEGORIES MASTER -->
      <!-- ========================================================================= -->
      {:else if activeTab === 'categories'}
        <div class="space-y-6 animate-page-fade">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-xs">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Product Taxonomy</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Categories Master</h1>
              <p class="text-xs text-app-textMuted mt-1">Manage standardized product categories referenced by retailer requests and wholesale inventories.</p>
            </div>
            <button
              onclick={openCreateCategoryModal}
              class="px-4 py-2 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus class="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          {#if categoriesLoading}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              {#each [1, 2, 3] as _}
                <div class="h-24 bg-app-card rounded-2xl animate-shimmer border border-app-border"></div>
              {/each}
            </div>
          {:else if categoriesList.length === 0}
            <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-2">
              <Layers class="w-10 h-10 text-[#D4A72C] mx-auto" />
              <h3 class="text-base font-bold text-app-text">No Categories Defined</h3>
              <p class="text-xs text-app-textMuted max-w-sm mx-auto">Create your first grocery category (e.g. Pantry Staples, Dairy & Eggs, Produce) to organize products.</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {#each categoriesList as cat (cat._id)}
                <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-xs flex flex-col justify-between space-y-3 transition hover-lift">
                  <div>
                    <div class="flex justify-between items-start">
                      <h4 class="text-base font-bold text-app-text">{cat.name}</h4>
                      <div class="flex items-center space-x-1">
                        <button
                          onclick={() => openEditCategoryModal(cat)}
                          class="p-1.5 rounded-lg text-app-textMuted hover:text-app-text hover:bg-app-cardSubtle transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 class="w-3.5 h-3.5" />
                        </button>
                        <button
                          onclick={() => handleDeleteCategory(cat)}
                          class="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {#if cat.description}
                      <p class="text-xs text-app-textMuted mt-1">{cat.description}</p>
                    {/if}
                  </div>
                  <div class="pt-2 border-t border-app-border text-[11px] text-app-textMuted flex justify-between items-center font-mono">
                    <span>ID: {cat._id.slice(-6)}</span>
                    <span>Created: {new Date(cat.createdAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- ========================================================================= -->
      <!-- MODULE 5: SYSTEM SETTINGS -->
      <!-- ========================================================================= -->
      {:else if activeTab === 'settings'}
        <div class="space-y-6 animate-page-fade">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-xs">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Infrastructure & Configuration</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">System Health & Settings</h1>
              <p class="text-xs text-app-textMuted mt-1">Inspect live service connections, runtime environment parameters, and security policies.</p>
            </div>
            <button
              onclick={loadSettings}
              class="px-4 py-2 text-xs font-bold border border-app-border bg-app-cardSubtle hover:bg-app-card rounded-xl text-app-text transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw class="w-3.5 h-3.5 {settingsLoading ? 'animate-spin' : ''}" />
              <span>Verify Health</span>
            </button>
          </div>

          {#if settingsLoading && !systemSettings}
            <div class="h-48 bg-app-card rounded-3xl animate-shimmer border border-app-border"></div>
          {:else if systemSettings}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <!-- Database Status -->
              <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-xs space-y-4">
                <div class="flex items-center space-x-3">
                  <Database class="w-6 h-6 text-emerald-500" />
                  <div>
                    <h3 class="text-sm font-bold text-app-text">Database Service</h3>
                    <span class="text-[10px] text-app-textMuted uppercase font-bold tracking-wider">MongoDB Atlas</span>
                  </div>
                </div>
                <div class="space-y-2 text-xs border-t border-app-border pt-3">
                  <div class="flex justify-between">
                    <span class="text-app-textMuted">Status:</span>
                    <strong class="text-emerald-500 font-bold flex items-center gap-1">
                      <CheckCircle2 class="w-3.5 h-3.5" /> {systemSettings.database.status}
                    </strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-app-textMuted">Cluster Host:</span>
                    <strong class="font-mono text-app-text">{systemSettings.database.host}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-app-textMuted">Database Name:</span>
                    <strong class="font-mono text-app-text">{systemSettings.database.name}</strong>
                  </div>
                </div>
              </div>

              <!-- Email Service -->
              <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-xs space-y-4">
                <div class="flex items-center space-x-3">
                  <Mail class="w-6 h-6 text-[#D4A72C]" />
                  <div>
                    <h3 class="text-sm font-bold text-app-text">SMTP Email Gateway</h3>
                    <span class="text-[10px] text-app-textMuted uppercase font-bold tracking-wider">OTP & Notifications</span>
                  </div>
                </div>
                <div class="space-y-2 text-xs border-t border-app-border pt-3">
                  <div class="flex justify-between">
                    <span class="text-app-textMuted">Status:</span>
                    <strong class={systemSettings.emailService.configured ? 'text-emerald-500' : 'text-amber-500'}>
                      {systemSettings.emailService.status}
                    </strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-app-textMuted">SMTP Host:</span>
                    <strong class="font-mono text-app-text">{systemSettings.emailService.host}</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-app-textMuted">Sender Address:</span>
                    <strong class="font-mono text-app-text">{systemSettings.emailService.fromAddress}</strong>
                  </div>
                </div>
              </div>

              <!-- Security Parameters -->
              <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-xs space-y-4">
                <div class="flex items-center space-x-3">
                  <Lock class="w-6 h-6 text-blue-500" />
                  <div>
                    <h3 class="text-sm font-bold text-app-text">Security Engine</h3>
                    <span class="text-[10px] text-app-textMuted uppercase font-bold tracking-wider">JWT & Cryptography</span>
                  </div>
                </div>
                <div class="space-y-2 text-xs border-t border-app-border pt-3">
                  <div class="flex justify-between">
                    <span class="text-app-textMuted">JWT Signing Key:</span>
                    <strong class="text-emerald-500 font-bold">Configured & Enforced</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-app-textMuted">OTP Expiry Window:</span>
                    <strong class="font-mono text-app-text">{systemSettings.security.otpExpiryMinutes} minutes</strong>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-app-textMuted">CORS Validation:</span>
                    <strong class="text-app-text">{systemSettings.security.originPolicy}</strong>
                  </div>
                </div>
              </div>
            </div>

            <!-- Runtime Environment Box -->
            <div class="bg-app-card p-6 rounded-3xl border border-app-border shadow-xs space-y-3">
              <h3 class="text-sm font-bold font-heading text-app-text flex items-center gap-2">
                <Server class="w-4 h-4 text-[#D4A72C]" />
                <span>Runtime Environment</span>
              </h3>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2">
                <div><span class="text-app-textMuted block">Deployment Mode</span><strong class="text-app-text uppercase">{systemSettings.environment}</strong></div>
                <div><span class="text-app-textMuted block">Node Runtime</span><strong class="text-app-text font-mono">{systemSettings.nodeVersion}</strong></div>
                <div><span class="text-app-textMuted block">Server Uptime</span><strong class="text-app-text font-mono">{systemSettings.serverUptime}</strong></div>
                <div><span class="text-app-textMuted block">Heap Memory Used</span><strong class="text-app-text font-mono">{systemSettings.memoryUsageMB} MB</strong></div>
              </div>
            </div>

            <!-- Data Maintenance Card -->
            <div class="bg-app-card p-6 rounded-3xl border border-rose-500/20 shadow-xs space-y-4">
              <h3 class="text-sm font-bold font-heading text-app-text flex items-center gap-2">
                <Trash2 class="w-4 h-4 text-rose-500" />
                <span>Data Maintenance</span>
              </h3>
              <p class="text-xs text-app-textMuted leading-relaxed">
                Remove auto-seeded demo catalogue items (qty=100) from wholesaler inventories. Real user-entered and modified inventory records are strictly preserved.
              </p>
              <div class="pt-1">
                <button
                  onclick={handlePurgeDemoInventory}
                  disabled={purgeLoading}
                  class="px-4 py-2.5 text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 class="w-3.5 h-3.5 {purgeLoading ? 'animate-spin' : ''}" />
                  {purgeLoading ? 'Purging Demo Inventory...' : 'Purge Demo Inventory'}
                </button>
              </div>
              {#if purgeResult}
                <div class="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-3.5 rounded-xl space-y-1">
                  <div class="font-bold flex items-center gap-1.5">
                    <CheckCircle2 class="w-4 h-4" /> {purgeResult.message}
                  </div>
                  <div class="text-[11px] opacity-90 pl-5">
                    Deleted records: <strong>{purgeResult.deletedCount ?? 0}</strong> | Preserved records: <strong>{purgeResult.preservedCount ?? 0}</strong> | Remaining total: <strong>{purgeResult.totalAfter ?? 0}</strong>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>

      <!-- ========================================================================= -->
      <!-- MODULE 6: ORDERS & DISPUTES -->
      <!-- ========================================================================= -->
      {:else if activeTab === 'orders'}
        <div class="space-y-6 animate-page-fade">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-xs">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Fulfillment & Dispute Resolution</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Orders & Disputes Center</h1>
              <p class="text-xs text-app-textMuted mt-1">Monitor real-time grocery orders, inspect delivery milestones, and adjudicate fulfillment disputes.</p>
            </div>
            <div class="flex items-center space-x-2">
              <div class="flex items-center space-x-1 bg-app-cardSubtle p-1 rounded-xl border border-app-border text-xs">
                <button
                  onclick={() => disputeTabMode = 'orders'}
                  class="px-3 py-1 rounded-lg font-bold transition {disputeTabMode === 'orders' ? 'bg-[#D4A72C] text-[#202124]' : 'text-app-textMuted hover:text-app-text'}"
                >All Orders ({ordersList.length})</button>
                <button
                  onclick={() => disputeTabMode = 'disputes'}
                  class="px-3 py-1 rounded-lg font-bold transition {disputeTabMode === 'disputes' ? 'bg-[#D4A72C] text-[#202124]' : 'text-app-textMuted hover:text-app-text'}"
                >Disputes ({disputesList.length})</button>
              </div>
              <button
                onclick={() => { loadOrders(); loadDisputes(); }}
                class="px-3 py-2 text-xs font-bold border border-app-border bg-app-cardSubtle hover:bg-app-card rounded-xl text-app-text transition cursor-pointer"
                title="Refresh"
              >
                <RefreshCw class="w-3.5 h-3.5 {ordersLoading ? 'animate-spin' : ''}" />
              </button>
            </div>
          </div>

          {#if disputeTabMode === 'orders'}
            <!-- Orders Filter Bar -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-app-card p-4 rounded-2xl border border-app-border shadow-xs">
              <div class="relative flex-1">
                <Search class="w-4 h-4 text-app-textMuted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  bind:value={orderSearchQuery}
                  placeholder="Filter by product name, order ID, or parties..."
                  class="w-full pl-10 pr-4 py-2 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
                />
              </div>

              <!-- Status Filters -->
              <div class="flex items-center space-x-1.5 overflow-x-auto text-xs">
                {#each ['all', 'accepted', 'processing', 'shipped', 'delivered', 'cancelled'] as st}
                  <button
                    onclick={() => orderStatusFilter = st}
                    class="px-3 py-1 rounded-lg font-bold capitalize transition whitespace-nowrap {orderStatusFilter === st ? 'bg-[#D4A72C] text-[#202124]' : 'bg-app-cardSubtle text-app-textMuted border border-app-border'}"
                  >
                    {st}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Orders List -->
            {#if ordersLoading}
              <div class="space-y-3">
                {#each [1, 2, 3] as _}
                  <div class="h-24 bg-app-card rounded-2xl animate-shimmer border border-app-border"></div>
                {/each}
              </div>
            {:else if filteredOrders.length === 0}
              <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-2">
                <Truck class="w-10 h-10 text-[#D4A72C] mx-auto" />
                <h3 class="text-base font-bold text-app-text">No Orders Found</h3>
                <p class="text-xs text-app-textMuted max-w-sm mx-auto">When retailers accept quotations, active procurement orders will appear here for management.</p>
              </div>
            {:else}
              <div class="space-y-3">
                {#each filteredOrders as ord (ord._id)}
                  <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover-lift">
                    <div class="space-y-1.5 flex-1">
                      <div class="flex items-center space-x-3 flex-wrap gap-y-1">
                        <span class="font-mono text-xs font-bold text-[#D4A72C]">#{ord._id.slice(-6)}</span>
                        <span class="font-bold text-app-text text-sm">{ord.productName}</span>
                        <span class="font-bold text-emerald-600 text-xs">₹{ord.totalAmount?.toLocaleString('en-IN')}</span>

                        <!-- Order Status Badge -->
                        <span class="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase
                          {ord.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : ord.status === 'cancelled' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}">
                          {ord.status.replace(/_/g, ' ')}
                        </span>

                        {#if ord.dispute}
                          <span class="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase bg-rose-500 text-white flex items-center gap-1 animate-pulse">
                            <ShieldAlert class="w-3 h-3" /> Dispute: {ord.dispute.status}
                          </span>
                        {/if}
                      </div>

                      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-textMuted">
                        <span>Quantity: <strong class="text-app-text">{ord.quantity} {ord.unit}</strong></span>
                        <span>Retailer: <strong class="text-app-text">{ord.retailerProfile?.storeName || 'Store'}</strong></span>
                        <span>Wholesaler: <strong class="text-app-text">{ord.wholesalerProfile?.companyName || 'Supplier'}</strong></span>
                        <span>Date: <strong class="text-app-text">{new Date(ord.createdAt).toLocaleDateString()}</strong></span>
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center space-x-2 shrink-0">
                      {#if ord.dispute}
                        <button
                          onclick={() => openResolveDispute(ord.dispute)}
                          class="px-3.5 py-1.5 text-xs font-bold bg-rose-500 text-white rounded-xl shadow-xs transition hover:bg-rose-600 cursor-pointer flex items-center gap-1.5"
                        >
                          <ShieldAlert class="w-3.5 h-3.5" />
                          <span>Adjudicate Dispute</span>
                        </button>
                      {:else}
                        <button
                          onclick={() => openCreateDispute(ord)}
                          class="px-3 py-1.5 text-xs font-bold bg-app-cardSubtle border border-app-border text-app-text hover:border-rose-500/40 rounded-xl transition cursor-pointer"
                        >
                          Log Dispute
                        </button>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {:else}
            <!-- Disputes List -->
            {#if disputesList.length === 0}
              <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-2">
                <CheckCircle2 class="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 class="text-base font-bold text-app-text">Zero Active Disputes</h3>
                <p class="text-xs text-app-textMuted max-w-sm mx-auto">No procurement disputes are currently reported between retailers and wholesalers.</p>
              </div>
            {:else}
              <div class="space-y-4">
                {#each disputesList as disp (disp._id)}
                  <div class="bg-app-card p-5 rounded-2xl border border-app-border shadow-xs space-y-3 transition hover-lift">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-app-border pb-3">
                      <div class="flex items-center space-x-3">
                        <span class="font-mono font-bold text-rose-500 text-xs">{disp.disputeId}</span>
                        <h4 class="font-bold text-app-text text-sm">{disp.reason}</h4>
                        <span class="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase
                          {disp.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : disp.status === 'dismissed' ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20 animate-pulse'}">
                          {disp.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span class="text-[11px] text-app-textMuted font-mono">
                        Logged: {new Date(disp.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p class="text-xs text-app-textMuted bg-app-cardSubtle p-3 rounded-xl border border-app-border">
                      "{disp.description}"
                    </p>

                    {#if disp.investigationNotes || disp.resolutionOutcome}
                      <div class="text-xs space-y-1 bg-[#D4A72C]/5 p-3 rounded-xl border border-[#D4A72C]/20">
                        {#if disp.investigationNotes}<div><strong class="text-app-text">Investigation Notes:</strong> {disp.investigationNotes}</div>{/if}
                        {#if disp.resolutionOutcome}<div><strong class="text-app-text">Outcome:</strong> {disp.resolutionOutcome}</div>{/if}
                      </div>
                    {/if}

                    <div class="flex justify-between items-center pt-1 text-xs">
                      <span class="text-[11px] text-app-textMuted">
                        Order #{disp.order?._id ? disp.order._id.slice(-6) : 'N/A'} • {disp.order?.productName || ''}
                      </span>
                      <button
                        onclick={() => openResolveDispute(disp)}
                        class="px-3.5 py-1.5 rounded-xl font-bold bg-[#D4A72C] text-[#202124] hover:bg-amber-600 transition cursor-pointer"
                      >
                        Update Investigation
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/if}
        </div>

      <!-- ========================================================================= -->
      <!-- MODULE 7: AUDIT LOGS -->
      <!-- ========================================================================= -->
      {:else if activeTab === 'audit'}
        <div class="space-y-6 animate-page-fade">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-app-card p-6 rounded-3xl border border-app-border shadow-xs">
            <div>
              <div class="text-xs font-bold text-[#D4A72C] uppercase tracking-wider">Immutable Security Ledger</div>
              <h1 class="text-2xl font-extrabold font-heading text-app-text mt-1">Administrative Audit Logs</h1>
              <p class="text-xs text-app-textMuted mt-1">Tamper-evident record of consequential administrative actions, user state changes, and verification decisions.</p>
            </div>
            <button
              onclick={loadAuditLogs}
              class="px-4 py-2 text-xs font-bold border border-app-border bg-app-cardSubtle hover:bg-app-card rounded-xl text-app-text transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw class="w-3.5 h-3.5 {auditLogsLoading ? 'animate-spin' : ''}" />
              <span>Refresh Ledger</span>
            </button>
          </div>

          <!-- Filters -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-app-card p-4 rounded-2xl border border-app-border shadow-xs">
            <div class="relative flex-1">
              <Search class="w-4 h-4 text-app-textMuted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                bind:value={auditSearchQuery}
                placeholder="Search audit trail by administrator, event details, or action..."
                class="w-full pl-10 pr-4 py-2 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
              />
            </div>

            <div class="flex items-center space-x-2 text-xs">
              <span class="text-app-textMuted">Action:</span>
              <select
                bind:value={auditActionFilter}
                class="bg-app-cardSubtle border border-app-border rounded-xl px-3 py-2 text-app-text focus:outline-none focus:border-[#D4A72C]"
              >
                <option value="all">All Actions</option>
                <option value="BUSINESS_VERIFICATION_APPROVED">Verification Approved</option>
                <option value="BUSINESS_VERIFICATION_REJECTED">Verification Rejected</option>
                <option value="USER_ACTIVATION">User Activation</option>
                <option value="USER_SUSPENSION">User Suspension</option>
                <option value="CATEGORY_CREATE">Category Created</option>
                <option value="CATEGORY_DELETE">Category Deleted</option>
                <option value="DISPUTE_OPENED">Dispute Opened</option>
                <option value="DISPUTE_RESOLVED">Dispute Resolved</option>
              </select>
            </div>
          </div>

          <!-- Audit Ledger Table -->
          {#if auditLogsLoading}
            <div class="h-48 bg-app-card rounded-3xl animate-shimmer border border-app-border"></div>
          {:else if filteredAuditLogs.length === 0}
            <div class="bg-app-card p-12 rounded-3xl border border-app-border text-center space-y-2">
              <FileText class="w-10 h-10 text-[#D4A72C] mx-auto" />
              <h3 class="text-base font-bold text-app-text">No Audit Entries Recorded</h3>
              <p class="text-xs text-app-textMuted max-w-sm mx-auto">When administrative events occur (approving suppliers, suspending users, resolving disputes), they are permanently logged here.</p>
            </div>
          {:else}
            <div class="bg-app-card rounded-3xl border border-app-border overflow-hidden shadow-xs">
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-app-cardSubtle border-b border-app-border text-app-textMuted uppercase font-bold text-[10px] tracking-wider">
                    <tr>
                      <th class="p-4">Timestamp</th>
                      <th class="p-4">Administrator</th>
                      <th class="p-4">Action Type</th>
                      <th class="p-4">Event Details</th>
                      <th class="p-4 text-right">Outcome</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-app-border">
                    {#each filteredAuditLogs as log}
                      <tr class="hover:bg-app-cardSubtle/50 transition">
                        <td class="p-4 font-mono text-app-textMuted text-[11px] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td class="p-4 font-bold text-app-text">
                          {log.adminEmail}
                        </td>
                        <td class="p-4">
                          <span class="inline-block px-2 py-0.5 rounded-full font-bold font-mono text-[9px] uppercase bg-app-cardSubtle border border-app-border text-app-text">
                            {log.action}
                          </span>
                        </td>
                        <td class="p-4 text-app-text max-w-md">
                          {log.details}
                        </td>
                        <td class="p-4 text-right">
                          <span class="text-emerald-500 font-bold uppercase text-[10px]">
                            ✓ {log.outcome}
                          </span>
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
  </div>
</div>

<!-- ========================================================================= -->
<!-- MODALS -->
<!-- ========================================================================= -->

<!-- 1. Wholesaler Rejection Reason Modal -->
{#if showRejectModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
    <div class="bg-app-card border border-app-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
      <div class="flex items-center space-x-2 text-rose-500">
        <XCircle class="w-5 h-5" />
        <h3 class="text-base font-bold font-heading">Reject Wholesaler Application</h3>
      </div>
      <p class="text-xs text-app-textMuted">
        Provide a clear explanation for rejecting this business verification. This will be sent directly to the wholesaler and recorded in the audit log.
      </p>
      <div>
        <label for="reject-reason-input" class="text-[11px] font-bold text-app-textMuted uppercase tracking-wider block mb-1">
          Rejection Reason
        </label>
        <textarea
          id="reject-reason-input"
          bind:value={rejectionReasonInput}
          rows="3"
          placeholder="e.g. Invalid trade license number, blurred registration certificate..."
          class="w-full p-3 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-rose-500"
        ></textarea>
      </div>
      <div class="flex justify-end space-x-2 pt-2">
        <button
          onclick={() => showRejectModal = false}
          class="px-4 py-2 text-xs font-bold border border-app-border rounded-xl hover:bg-app-cardSubtle transition"
        >
          Cancel
        </button>
        <button
          onclick={handleConfirmReject}
          class="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition"
        >
          Confirm Rejection
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 2. Category Create / Edit Modal -->
{#if showCategoryModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
    <div class="bg-app-card border border-app-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
      <div class="flex items-center space-x-2 text-[#D4A72C]">
        <Layers class="w-5 h-5" />
        <h3 class="text-base font-bold font-heading text-app-text">
          {categoryFormId ? 'Edit Category' : 'Create New Category'}
        </h3>
      </div>
      {#if categoryFormError}
        <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 text-xs font-semibold">
          {categoryFormError}
        </div>
      {/if}
      <form onsubmit={handleSaveCategory} class="space-y-3">
        <div>
          <label for="cat-name-input" class="text-[11px] font-bold text-app-textMuted uppercase tracking-wider block mb-1">Category Name</label>
          <input
            id="cat-name-input"
            type="text"
            bind:value={categoryFormName}
            placeholder="e.g. Pantry Staples, Spices & Seasonings..."
            class="w-full p-3 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
            required
          />
        </div>
        <div>
          <label for="cat-desc-input" class="text-[11px] font-bold text-app-textMuted uppercase tracking-wider block mb-1">Description (Optional)</label>
          <textarea
            id="cat-desc-input"
            bind:value={categoryFormDesc}
            rows="2"
            placeholder="Brief scope of products in this category..."
            class="w-full p-3 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
          ></textarea>
        </div>
        <div class="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onclick={() => showCategoryModal = false}
            class="px-4 py-2 text-xs font-bold border border-app-border rounded-xl hover:bg-app-cardSubtle transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-5 py-2 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs transition"
          >
            Save Category
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 3. Create Dispute Modal -->
{#if showCreateDisputeModal && selectedOrderForDispute}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
    <div class="bg-app-card border border-app-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
      <div class="flex items-center space-x-2 text-rose-500">
        <ShieldAlert class="w-5 h-5" />
        <h3 class="text-base font-bold font-heading text-app-text">Log Dispute on Order #{selectedOrderForDispute._id.slice(-6)}</h3>
      </div>
      <form onsubmit={handleCreateDispute} class="space-y-3">
        <div>
          <label for="disp-reason-select" class="text-[11px] font-bold text-app-textMuted uppercase tracking-wider block mb-1">Primary Reason</label>
          <select
            id="disp-reason-select"
            bind:value={disputeReasonInput}
            class="w-full p-3 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
          >
            <option value="Delivery SLA Delay">Delivery SLA Delay</option>
            <option value="Damaged Goods / Quality Issue">Damaged Goods / Quality Issue</option>
            <option value="Missing Items / Short Delivery">Missing Items / Short Delivery</option>
            <option value="Billing / Pricing Discrepancy">Billing / Pricing Discrepancy</option>
            <option value="Other Non-Compliance">Other Non-Compliance</option>
          </select>
        </div>
        <div>
          <label for="disp-desc-textarea" class="text-[11px] font-bold text-app-textMuted uppercase tracking-wider block mb-1">Investigation Details</label>
          <textarea
            id="disp-desc-textarea"
            bind:value={disputeDescriptionInput}
            rows="3"
            placeholder="Describe the complaint reported by retailer or supplier..."
            class="w-full p-3 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
            required
          ></textarea>
        </div>
        <div class="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onclick={() => showCreateDisputeModal = false}
            class="px-4 py-2 text-xs font-bold border border-app-border rounded-xl hover:bg-app-cardSubtle transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={disputeFormLoading}
            class="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition"
          >
            {disputeFormLoading ? 'Logging...' : 'Log Dispute'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 4. Resolve Dispute Modal -->
{#if showResolveDisputeModal && selectedDisputeForResolve}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
    <div class="bg-app-card border border-app-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
      <div class="flex items-center space-x-2 text-emerald-500">
        <CheckCircle2 class="w-5 h-5" />
        <h3 class="text-base font-bold font-heading text-app-text">Adjudicate Dispute {selectedDisputeForResolve.disputeId}</h3>
      </div>
      <form onsubmit={handleResolveDispute} class="space-y-3">
        <div>
          <label for="disp-status-select" class="text-[11px] font-bold text-app-textMuted uppercase tracking-wider block mb-1">Resolution Status</label>
          <select
            id="disp-status-select"
            bind:value={disputeResolveStatus}
            class="w-full p-3 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
          >
            <option value="under_investigation">Keep Under Investigation</option>
            <option value="resolved">Mark as Resolved</option>
            <option value="dismissed">Dismiss Complaint</option>
          </select>
        </div>
        <div>
          <label for="disp-inv-textarea" class="text-[11px] font-bold text-app-textMuted uppercase tracking-wider block mb-1">Investigation Notes</label>
          <textarea
            id="disp-inv-textarea"
            bind:value={disputeInvestigationNotes}
            rows="2"
            placeholder="Administrative findings and checks..."
            class="w-full p-3 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
          ></textarea>
        </div>
        <div>
          <label for="disp-out-textarea" class="text-[11px] font-bold text-app-textMuted uppercase tracking-wider block mb-1">Resolution Outcome & Instructions</label>
          <textarea
            id="disp-out-textarea"
            bind:value={disputeResolutionOutcome}
            rows="2"
            placeholder="e.g. Supplier agreed to replacement delivery on next cycle..."
            class="w-full p-3 text-xs bg-app-cardSubtle border border-app-border rounded-xl text-app-text focus:outline-none focus:border-[#D4A72C]"
          ></textarea>
        </div>
        <div class="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onclick={() => showResolveDisputeModal = false}
            class="px-4 py-2 text-xs font-bold border border-app-border rounded-xl hover:bg-app-cardSubtle transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={disputeResolveLoading}
            class="px-5 py-2 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs transition"
          >
            {disputeResolveLoading ? 'Saving...' : 'Save Resolution'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 5. General Confirmation Modal -->
{#if showConfirmModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
    <div class="bg-app-card border border-app-border rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
      <div class="flex items-center space-x-2 text-[#D4A72C]">
        <AlertTriangle class="w-5 h-5" />
        <h3 class="text-base font-bold font-heading text-app-text">{confirmTitle}</h3>
      </div>
      <p class="text-xs text-app-textMuted leading-relaxed">
        {confirmMessage}
      </p>
      <div class="flex justify-end space-x-2 pt-2">
        <button
          onclick={() => showConfirmModal = false}
          class="px-4 py-2 text-xs font-bold border border-app-border rounded-xl hover:bg-app-cardSubtle transition"
        >
          Cancel
        </button>
        <button
          onclick={confirmCallback}
          class="px-4 py-2 text-xs font-bold bg-[#D4A72C] hover:bg-amber-600 text-[#202124] rounded-xl shadow-xs transition"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 6. Scorecard Modal -->
{#if selectedScorecardWholesalerId}
  <SupplierScorecardModal
    wholesalerId={selectedScorecardWholesalerId}
    onClose={() => selectedScorecardWholesalerId = null}
  />
{/if}
