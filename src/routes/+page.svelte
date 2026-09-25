<script>
  import { auth } from '$lib/auth.svelte.js';
  import { i18n } from '$lib/i18n.svelte.js';
</script>

<div class="bg-app-bg text-app-text transition-colors duration-200 animate-page-fade">
  <!-- Hero Section -->
  <div class="relative overflow-hidden bg-app-cardSubtle border-b border-app-border">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 flex flex-col lg:flex-row items-center justify-between gap-12">
      <!-- Left Side text -->
      <div class="flex-1 max-w-xl text-center lg:text-left">
        <h1 class="text-4xl sm:text-5xl font-extrabold text-app-text font-heading tracking-tight leading-tight">
          {i18n.t('heroTitle1')} <span class="text-brand-orange">{i18n.t('heroTitle2')}</span>
        </h1>
        <p class="mt-6 text-lg text-app-muted font-body font-normal leading-relaxed">
          {i18n.t('heroSub')}
        </p>
        <div class="mt-10 flex flex-wrap gap-4 justify-center lg:justify-start">
          {#if auth.user}
            {#if auth.user.role === 'retailer'}
              <a href="/retailer" class="px-6 py-3.5 text-base font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-md hover-lift transition-all">
                {i18n.t('retailerDashboard')}
              </a>
            {:else if auth.user.role === 'wholesaler'}
              <a href="/wholesaler" class="px-6 py-3.5 text-base font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-md hover-lift transition-all">
                {i18n.t('wholesalerDashboard')}
              </a>
            {:else if auth.user.role === 'admin'}
              <a href="/admin" class="px-6 py-3.5 text-base font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-md hover-lift transition-all">
                {i18n.t('adminPanel')}
              </a>
            {/if}
          {:else}
            <a href="/auth?register=true" class="px-6 py-3.5 text-base font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl shadow-md hover-lift transition-all">
              {i18n.t('getStartedBtn')}
            </a>
            <a href="/auth" class="px-6 py-3.5 text-base font-bold border border-app-border bg-app-card hover:bg-app-cardSubtle text-app-text rounded-xl transition-all">
              {i18n.t('signInBtn')}
            </a>
          {/if}
        </div>
      </div>

      <!-- Right Side Supply Chain Visual -->
      <div class="flex-grow w-full max-w-md lg:max-w-lg">
        <svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto drop-shadow-lg">
          <!-- Background Grid Rings -->
          <circle cx="250" cy="200" r="160" stroke="#FD6F2F" stroke-opacity="0.2" stroke-width="2" stroke-dasharray="6 6" />
          <circle cx="250" cy="200" r="100" stroke="#515739" stroke-opacity="0.15" stroke-width="2" />
          
          <!-- Connective path lines -->
          <path d="M120 280 Q250 200 380 280" stroke="#FD6F2F" stroke-width="3" stroke-dasharray="4 4" class="animate-wave" />
          <path d="M120 280 C200 160 300 160 380 280" stroke="#515739" stroke-width="2" />
          
          <!-- Wholesale Group -->
          <g class="animate-float">
            <rect x="80" y="240" width="80" height="80" rx="14" fill="#515739" />
            <rect x="90" y="250" width="60" height="20" rx="4" fill="#DCE4B8" fill-opacity="0.8" />
            <circle cx="105" cy="285" r="8" fill="#FD6F2F" />
            <circle cx="135" cy="285" r="8" fill="#FFEAD1" />
            <text x="120" y="310" font-family="Poppins" font-size="9" font-weight="bold" fill="#FFEAD1" text-anchor="middle">
              WHOLESALE
            </text>
          </g>
          
          <!-- Retailer Group -->
          <g class="animate-slow-float">
            <rect x="340" y="240" width="80" height="80" rx="14" fill="#FD6F2F" />
            <path d="M335 240 L425 240 L415 220 L345 220 Z" fill="#515739" />
            <rect x="360" y="260" width="40" height="35" rx="4" fill="#FFEAD1" />
            <rect x="370" y="260" width="20" height="35" fill="#DCE4B8" />
            <text x="380" y="310" font-family="Poppins" font-size="9" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
              RETAILER
            </text>
          </g>

          <!-- Central HUB Ring -->
          <g class="animate-wave">
            <circle cx="250" cy="160" r="38" fill="#FFEAD1" stroke="#FD6F2F" stroke-width="3" />
            <path d="M242 152 L258 152 M242 160 L258 160 M242 168 L250 168" stroke="#515739" stroke-width="2.5" stroke-linecap="round" />
            <circle cx="250" cy="160" r="28" fill="#FD6F2F" fill-opacity="0.1" />
            <text x="250" y="195" font-family="Poppins" font-size="11" font-weight="bold" fill="#FD6F2F" text-anchor="middle">HUB</text>
          </g>
          
          <!-- Floating stock icons -->
          <g transform="translate(180, 230)" class="animate-float">
            <rect width="26" height="26" rx="8" fill="#FD6F2F" />
            <path d="M9 13 L12 16 L17 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </g>
          <g transform="translate(290, 230)" class="animate-slow-float">
            <rect width="26" height="26" rx="8" fill="#515739" />
            <text x="13" y="18" fill="#FFEAD1" font-size="13" font-weight="bold" text-anchor="middle">₹</text>
          </g>
        </svg>
      </div>
    </div>
  </div>

  <!-- Features Section -->
  <div id="features" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
    <div class="text-center max-w-3xl mx-auto">
      <h2 class="text-3xl font-extrabold text-app-text font-heading tracking-tight">
        {i18n.t('featuresHeading')}
      </h2>
      <p class="mt-4 text-lg text-app-muted">
        {i18n.t('featuresSub')}
      </p>
    </div>

    <div class="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
      <!-- Card 1 -->
      <div class="bg-app-card p-6 rounded-2xl border border-app-border shadow-sm hover-lift">
        <div class="h-12 w-12 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center font-bold text-xl">
          📝
        </div>
        <h3 class="mt-5 text-lg font-bold text-app-text">{i18n.t('feature1Title')}</h3>
        <p class="mt-2 text-sm text-app-muted leading-relaxed">
          {i18n.t('feature1Desc')}
        </p>
      </div>

      <!-- Card 2 -->
      <div class="bg-app-card p-6 rounded-2xl border border-app-border shadow-sm hover-lift">
        <div class="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xl">
          ⚡
        </div>
        <h3 class="mt-5 text-lg font-bold text-app-text">{i18n.t('feature2Title')}</h3>
        <p class="mt-2 text-sm text-app-muted leading-relaxed">
          {i18n.t('feature2Desc')}
        </p>
      </div>

      <!-- Card 3 -->
      <div class="bg-app-card p-6 rounded-2xl border border-app-border shadow-sm hover-lift">
        <div class="h-12 w-12 rounded-xl bg-brand-sage/30 text-brand-olive dark:text-brand-sage flex items-center justify-center font-bold text-xl">
          ⚖️
        </div>
        <h3 class="mt-5 text-lg font-bold text-app-text">{i18n.t('feature3Title')}</h3>
        <p class="mt-2 text-sm text-app-muted leading-relaxed">
          {i18n.t('feature3Desc')}
        </p>
      </div>

      <!-- Card 4 -->
      <div class="bg-app-card p-6 rounded-2xl border border-app-border shadow-sm hover-lift">
        <div class="h-12 w-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xl">
          🔔
        </div>
        <h3 class="mt-5 text-lg font-bold text-app-text">{i18n.t('feature4Title')}</h3>
        <p class="mt-2 text-sm text-app-muted leading-relaxed">
          {i18n.t('feature4Desc')}
        </p>
      </div>
    </div>
  </div>

  <!-- How It Works Section -->
  <div id="how-it-works" class="bg-app-cardSubtle border-y border-app-border py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto">
        <h2 class="text-3xl font-extrabold text-app-text font-heading tracking-tight">
          {i18n.t('howItWorksHeading')}
        </h2>
        <p class="mt-4 text-lg text-app-muted">
          {i18n.t('howItWorksSub')}
        </p>
      </div>

      <div class="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <!-- Step 1 -->
        <div class="text-center">
          <div class="mx-auto h-12 w-12 rounded-2xl bg-brand-orange text-white flex items-center justify-center font-bold text-lg shadow-md">
            1
          </div>
          <h3 class="mt-6 text-lg font-bold text-app-text">{i18n.t('step1Title')}</h3>
          <p class="mt-3 text-sm text-app-muted max-w-xs mx-auto leading-relaxed">
            {i18n.t('step1Desc')}
          </p>
        </div>

        <!-- Step 2 -->
        <div class="text-center">
          <div class="mx-auto h-12 w-12 rounded-2xl bg-brand-orange text-white flex items-center justify-center font-bold text-lg shadow-md">
            2
          </div>
          <h3 class="mt-6 text-lg font-bold text-app-text">{i18n.t('step2Title')}</h3>
          <p class="mt-3 text-sm text-app-muted max-w-xs mx-auto leading-relaxed">
            {i18n.t('step2Desc')}
          </p>
        </div>

        <!-- Step 3 -->
        <div class="text-center">
          <div class="mx-auto h-12 w-12 rounded-2xl bg-brand-orange text-white flex items-center justify-center font-bold text-lg shadow-md">
            3
          </div>
          <h3 class="mt-6 text-lg font-bold text-app-text">{i18n.t('step3Title')}</h3>
          <p class="mt-3 text-sm text-app-muted max-w-xs mx-auto leading-relaxed">
            {i18n.t('step3Desc')}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="bg-app-card border-t border-app-border py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
      <div class="flex items-center space-x-2.5">
        <div class="h-8 w-8 rounded-lg bg-brand-orange flex items-center justify-center text-white font-bold text-base">
          G
        </div>
        <span class="text-app-text font-heading font-bold">{i18n.t('brandName')}</span>
      </div>
      
      <p class="text-xs text-app-muted font-medium">
        &copy; {new Date().getFullYear()} {i18n.t('brandName')} Inc. {i18n.t('footerInfo')}
      </p>
      
      <div class="flex space-x-6 text-xs text-app-muted font-medium">
        <a href="#features" class="hover:text-brand-orange transition">Features</a>
        <a href="#how-it-works" class="hover:text-brand-orange transition">How it Works</a>
        <a href="/auth" class="hover:text-brand-orange transition">Sign In</a>
      </div>
    </div>
  </footer>
</div>
