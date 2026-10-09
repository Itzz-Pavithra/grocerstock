<script>
  import { auth } from '$lib/auth.svelte.js';
  import { i18n } from '$lib/i18n.svelte.js';
</script>

<div class="relative bg-app-bg text-app-text transition-colors duration-200 animate-page-fade overflow-hidden">
  
  <!-- Ambient Moving Floating Orbs & Blurred Grocery Produce Photo -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden z-0">
    <!-- Blurred Grocery Background Image (Visible in both Light and Dark mode) -->
    <div
      class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-25 dark:opacity-20 filter blur-[3px] scale-105 transition-opacity duration-300"
      style="background-image: url('/grocery_produce_bg.jpg')"
      aria-hidden="true"
    ></div>
    <!-- Cream / Charcoal gradient overlay ensuring sharp text contrast -->
    <div class="absolute inset-0 bg-gradient-to-b from-[#F7F5EF]/80 via-[#F7F5EF]/90 to-[#F7F5EF] dark:from-[#202124]/85 dark:via-[#18191B]/90 dark:to-[#18191B]"></div>

    <div class="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-[#D4A72C]/15 blur-3xl animate-orb-1"></div>
    <div class="absolute top-1/3 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#B9DDE5]/25 blur-3xl animate-orb-2"></div>
    <div class="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-[#202124]/10 dark:bg-[#D4A72C]/10 blur-3xl animate-orb-1"></div>
    <!-- Subtle grid backdrop -->
    <div class="absolute inset-0 bg-[radial-gradient(#202124_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.035] dark:opacity-[0.06]"></div>
  </div>

  <!-- Hero Section -->
  <section class="relative z-10 border-b border-app-border/70 overflow-hidden">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center flex flex-col items-center">
      
      <!-- Floating Pill Tag -->
      <div class="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-app-card border border-app-border shadow-xs mb-6">
        <span class="flex h-2.5 w-2.5 rounded-full bg-[#D4A72C] animate-pulse"></span>
        <span class="text-xs font-bold text-[#202124] dark:text-[#F7F5EF] tracking-wide uppercase">Hyperlocal B2B Procurement</span>
        <span class="text-[11px] font-semibold text-[#5F6368] dark:text-[#B9DDE5]">• Live</span>
      </div>

      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#202124] dark:text-[#F7F5EF] font-heading tracking-tight leading-[1.12] max-w-4xl mx-auto">
        {i18n.t('heroTitle1')} 
        <span class="relative inline-block text-[#D4A72C]">
          {i18n.t('heroTitle2')}
          <svg class="absolute -bottom-2 left-0 w-full h-3 text-[#B9DDE5] -z-10" viewBox="0 0 100 12" preserveAspectRatio="none" fill="currentColor">
            <path d="M0,8 Q50,0 100,8 L100,12 L0,12 Z"></path>
          </svg>
        </span>
      </h1>

      <p class="mt-6 text-base sm:text-xl text-app-muted font-body font-normal leading-relaxed max-w-3xl mx-auto">
        {i18n.t('heroSub')}
      </p>

      <!-- CTA Buttons -->
      <div class="mt-10 flex flex-wrap gap-4 justify-center items-center">
        {#if auth.user}
          {#if auth.user.role === 'retailer'}
            <a href="/retailer" class="px-7 py-4 text-sm font-bold bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] rounded-2xl shadow-lg glow-mustard hover-lift transition-all flex items-center gap-2">
              <span>{i18n.t('retailerDashboard')}</span>
              <span class="text-base font-bold">→</span>
            </a>
          {:else if auth.user.role === 'wholesaler'}
            <a href="/wholesaler" class="px-7 py-4 text-sm font-bold bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] rounded-2xl shadow-lg glow-mustard hover-lift transition-all flex items-center gap-2">
              <span>{i18n.t('wholesalerDashboard')}</span>
              <span class="text-base font-bold">→</span>
            </a>
          {:else if auth.user.role === 'admin'}
            <a href="/admin" class="px-7 py-4 text-sm font-bold bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] rounded-2xl shadow-lg glow-mustard hover-lift transition-all flex items-center gap-2">
              <span>{i18n.t('adminPanel')}</span>
              <span class="text-base font-bold">→</span>
            </a>
          {/if}
        {:else}
          <a href="/auth?register=true" class="px-7 py-4 text-sm font-bold bg-[#D4A72C] hover:bg-[#B88E1E] text-[#202124] rounded-2xl shadow-lg glow-mustard hover-lift transition-all flex items-center gap-2">
            <span>{i18n.t('getStartedBtn')}</span>
            <span class="text-base font-bold">→</span>
          </a>
          <a href="/auth" class="px-7 py-4 text-sm font-bold border-2 border-app-border bg-app-card hover:bg-app-cardSubtle text-[#202124] dark:text-[#F7F5EF] rounded-2xl shadow-xs hover-lift transition-all">
            {i18n.t('signInBtn')}
          </a>
        {/if}
      </div>

      <!-- Trust Badges Under Buttons -->
      <div class="mt-12 pt-8 border-t border-app-border/70 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-app-muted font-medium">
        <div class="flex items-center space-x-2">
          <span class="h-5 w-5 rounded-full bg-[#D4A72C]/20 text-[#D4A72C] flex items-center justify-center font-bold text-xs">✓</span>
          <span>Verified Local Suppliers</span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="h-5 w-5 rounded-full bg-[#B9DDE5]/30 text-[#202124] dark:text-[#B9DDE5] flex items-center justify-center font-bold text-xs">⚡</span>
          <span>Real-time Bidding</span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="h-5 w-5 rounded-full bg-[#202124]/10 dark:bg-white/10 text-app-text flex items-center justify-center font-bold text-xs">📍</span>
          <span>Map Discovery</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Grid Section -->
  <section id="features" class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
    <div class="text-center max-w-3xl mx-auto">
      <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#D4A72C]/10 border border-[#D4A72C]/30 text-xs font-bold text-[#D4A72C] uppercase tracking-wider mb-3">
        Core Platform Capabilities
      </div>
      <h2 class="text-3xl sm:text-4xl font-extrabold text-[#202124] dark:text-[#F7F5EF] font-heading tracking-tight">
        {i18n.t('featuresHeading')}
      </h2>
      <p class="mt-4 text-base sm:text-lg text-app-muted">
        {i18n.t('featuresSub')}
      </p>
    </div>

    <div class="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">
      
      <!-- Feature Card 1 -->
      <div class="bg-app-card p-7 rounded-3xl border border-app-border shadow-sm hover:shadow-xl hover:border-[#D4A72C]/40 hover:-translate-y-2 transition-all duration-300 group">
        <div class="h-14 w-14 rounded-2xl bg-[#D4A72C]/15 text-[#D4A72C] flex items-center justify-center font-bold text-2xl group-hover:scale-110 group-hover:bg-[#D4A72C] group-hover:text-[#202124] transition-all">
          📝
        </div>
        <h3 class="mt-6 text-lg font-bold font-heading text-app-text">{i18n.t('feature1Title')}</h3>
        <p class="mt-2.5 text-xs sm:text-sm text-app-muted leading-relaxed">
          {i18n.t('feature1Desc')}
        </p>
        <div class="mt-5 pt-4 border-t border-app-border/60 flex items-center text-xs font-bold text-[#D4A72C]">
          <span>Multi-Item Carts</span>
          <span class="ml-1">→</span>
        </div>
      </div>

      <!-- Feature Card 2 -->
      <div class="bg-app-card p-7 rounded-3xl border border-app-border shadow-sm hover:shadow-xl hover:border-[#D4A72C]/40 hover:-translate-y-2 transition-all duration-300 group">
        <div class="h-14 w-14 rounded-2xl bg-[#B9DDE5]/30 text-[#202124] dark:text-[#B9DDE5] flex items-center justify-center font-bold text-2xl group-hover:scale-110 group-hover:bg-[#B9DDE5] group-hover:text-[#202124] transition-all">
          ⚡
        </div>
        <h3 class="mt-6 text-lg font-bold font-heading text-app-text">{i18n.t('feature2Title')}</h3>
        <p class="mt-2.5 text-xs sm:text-sm text-app-muted leading-relaxed">
          {i18n.t('feature2Desc')}
        </p>
        <div class="mt-5 pt-4 border-t border-app-border/60 flex items-center text-xs font-bold text-[#202124] dark:text-[#B9DDE5]">
          <span>Transparent Bidding</span>
          <span class="ml-1">→</span>
        </div>
      </div>

      <!-- Feature Card 3 -->
      <div class="bg-app-card p-7 rounded-3xl border border-app-border shadow-sm hover:shadow-xl hover:border-[#D4A72C]/40 hover:-translate-y-2 transition-all duration-300 group">
        <div class="h-14 w-14 rounded-2xl bg-[#202124]/10 dark:bg-white/10 text-[#202124] dark:text-[#F7F5EF] flex items-center justify-center font-bold text-2xl group-hover:scale-110 group-hover:bg-[#202124] group-hover:text-[#D4A72C] transition-all">
          ⚖️
        </div>
        <h3 class="mt-6 text-lg font-bold font-heading text-app-text">{i18n.t('feature3Title')}</h3>
        <p class="mt-2.5 text-xs sm:text-sm text-app-muted leading-relaxed">
          {i18n.t('feature3Desc')}
        </p>
        <div class="mt-5 pt-4 border-t border-app-border/60 flex items-center text-xs font-bold text-[#D4A72C]">
          <span>Historical Analytics</span>
          <span class="ml-1">→</span>
        </div>
      </div>

      <!-- Feature Card 4 -->
      <div class="bg-app-card p-7 rounded-3xl border border-app-border shadow-sm hover:shadow-xl hover:border-[#D4A72C]/40 hover:-translate-y-2 transition-all duration-300 group">
        <div class="h-14 w-14 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold text-2xl group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all">
          🔔
        </div>
        <h3 class="mt-6 text-lg font-bold font-heading text-app-text">{i18n.t('feature4Title')}</h3>
        <p class="mt-2.5 text-xs sm:text-sm text-app-muted leading-relaxed">
          {i18n.t('feature4Desc')}
        </p>
        <div class="mt-5 pt-4 border-t border-app-border/60 flex items-center text-xs font-bold text-amber-600">
          <span>Zero Stockouts</span>
          <span class="ml-1">→</span>
        </div>
      </div>

    </div>
  </section>

  <!-- How It Works Section (Connected Workflow Timeline) -->
  <section id="how-it-works" class="relative z-10 bg-app-cardSubtle border-y border-app-border/70 py-20 sm:py-28">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto">
        <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#B9DDE5]/30 border border-[#B9DDE5] text-xs font-bold text-[#202124] dark:text-[#B9DDE5] uppercase tracking-wider mb-3">
          Seamless Workflow
        </div>
        <h2 class="text-3xl sm:text-4xl font-extrabold text-[#202124] dark:text-[#F7F5EF] font-heading tracking-tight">
          {i18n.t('howItWorksHeading')}
        </h2>
        <p class="mt-4 text-base sm:text-lg text-app-muted">
          {i18n.t('howItWorksSub')}
        </p>
      </div>

      <div class="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-10">
        
        <!-- Step 1 -->
        <div class="bg-app-card p-8 rounded-3xl border border-app-border shadow-sm text-center relative group hover:border-[#D4A72C] transition-all">
          <div class="mx-auto h-14 w-14 rounded-2xl bg-[#D4A72C] text-[#202124] flex items-center justify-center font-extrabold text-xl shadow-lg glow-mustard group-hover:scale-110 transition-transform">
            1
          </div>
          <h3 class="mt-6 text-xl font-bold font-heading text-app-text">{i18n.t('step1Title')}</h3>
          <p class="mt-3 text-xs sm:text-sm text-app-muted max-w-xs mx-auto leading-relaxed">
            {i18n.t('step1Desc')}
          </p>
          <div class="mt-6 inline-block px-3 py-1 bg-app-cardSubtle rounded-full text-[11px] font-bold text-[#5F6368] dark:text-[#B9DDE5]">
            Urgency & Quantity Controls
          </div>
        </div>

        <!-- Step 2 -->
        <div class="bg-app-card p-8 rounded-3xl border border-app-border shadow-sm text-center relative group hover:border-[#B9DDE5] transition-all">
          <div class="mx-auto h-14 w-14 rounded-2xl bg-[#B9DDE5] text-[#202124] flex items-center justify-center font-extrabold text-xl shadow-lg group-hover:scale-110 transition-transform">
            2
          </div>
          <h3 class="mt-6 text-xl font-bold font-heading text-app-text">{i18n.t('step2Title')}</h3>
          <p class="mt-3 text-xs sm:text-sm text-app-muted max-w-xs mx-auto leading-relaxed">
            {i18n.t('step2Desc')}
          </p>
          <div class="mt-6 inline-block px-3 py-1 bg-app-cardSubtle rounded-full text-[11px] font-bold text-[#5F6368] dark:text-[#B9DDE5]">
            Competitive Bidding Engine
          </div>
        </div>

        <!-- Step 3 -->
        <div class="bg-app-card p-8 rounded-3xl border border-app-border shadow-sm text-center relative group hover:border-[#202124] dark:hover:border-[#D4A72C] transition-all">
          <div class="mx-auto h-14 w-14 rounded-2xl bg-[#202124] dark:bg-[#D4A72C] text-[#D4A72C] dark:text-[#202124] flex items-center justify-center font-extrabold text-xl shadow-lg group-hover:scale-110 transition-transform">
            3
          </div>
          <h3 class="mt-6 text-xl font-bold font-heading text-app-text">{i18n.t('step3Title')}</h3>
          <p class="mt-3 text-xs sm:text-sm text-app-muted max-w-xs mx-auto leading-relaxed">
            {i18n.t('step3Desc')}
          </p>
          <div class="mt-6 inline-block px-3 py-1 bg-app-cardSubtle rounded-full text-[11px] font-bold text-[#5F6368] dark:text-[#B9DDE5]">
            Live Transit & Inventory Restock
          </div>
        </div>

      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="relative z-10 bg-app-card border-t border-app-border py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
      <div class="flex items-center space-x-3">
        <div class="h-9 w-9 rounded-xl bg-[#D4A72C] flex items-center justify-center text-[#202124] font-bold font-heading text-lg shadow-sm">
          G
        </div>
        <span class="text-app-text font-heading font-bold text-lg">{i18n.t('brandName')}</span>
      </div>
      
      <p class="text-xs text-app-muted font-medium text-center md:text-left">
        &copy; {new Date().getFullYear()} {i18n.t('brandName')} Inc. {i18n.t('footerInfo')}
      </p>
      
      <div class="flex space-x-6 text-xs text-app-muted font-semibold">
        <a href="#features" class="hover:text-[#D4A72C] transition">Features</a>
        <a href="#how-it-works" class="hover:text-[#D4A72C] transition">How it Works</a>
        <a href="/auth" class="hover:text-[#D4A72C] transition">Sign In</a>
      </div>
    </div>
  </footer>

</div>
