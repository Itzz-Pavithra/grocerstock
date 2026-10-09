<script>
  import { auth } from '$lib/auth.svelte.js';
  import { i18n } from '$lib/i18n.svelte.js';

  // Interactive 3D tilt tracking for hero dashboard
  let tiltX = $state(4);
  let tiltY = $state(-6);
  let isHovering3D = $state(false);

  function handleMouseMove(e) {
    const card = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - card.left;
    const y = e.clientY - card.top;
    const centerX = card.width / 2;
    const centerY = card.height / 2;

    // Calculate rotation limits (-12deg to +12deg)
    tiltX = -((y - centerY) / centerY) * 10;
    tiltY = ((x - centerX) / centerX) * 12;
    isHovering3D = true;
  }

  function handleMouseLeave() {
    isHovering3D = false;
    tiltX = 4;
    tiltY = -6;
  }
</script>

<div class="relative bg-app-bg text-app-text transition-colors duration-200 animate-page-fade overflow-hidden">
  
  <!-- Ambient Moving Floating Orbs (Background 3D Ambiance) -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden z-0">
    <div class="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-[#D4A72C]/15 blur-3xl animate-orb-1"></div>
    <div class="absolute top-1/3 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#B9DDE5]/25 blur-3xl animate-orb-2"></div>
    <div class="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-[#202124]/10 dark:bg-[#D4A72C]/10 blur-3xl animate-orb-1"></div>
    <!-- Subtle grid backdrop -->
    <div class="absolute inset-0 bg-[radial-gradient(#202124_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.035] dark:opacity-[0.06]"></div>
  </div>

  <!-- Hero Section -->
  <section class="relative z-10 border-b border-app-border/70 overflow-hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 sm:pt-24 sm:pb-32 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
      
      <!-- Left Side text & CTAs -->
      <div class="flex-1 max-w-xl text-center lg:text-left">
        <!-- Floating Pill Tag -->
        <div class="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-app-card border border-app-border shadow-sm mb-6 animate-float">
          <span class="flex h-2.5 w-2.5 rounded-full bg-[#D4A72C] animate-pulse"></span>
          <span class="text-xs font-bold text-[#202124] dark:text-[#F7F5EF] tracking-wide uppercase">Hyperlocal B2B Procurement</span>
          <span class="text-[11px] font-semibold text-[#5F6368] dark:text-[#B9DDE5]">• Live Live</span>
        </div>

        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#202124] dark:text-[#F7F5EF] font-heading tracking-tight leading-[1.12]">
          {i18n.t('heroTitle1')} 
          <span class="relative inline-block text-[#D4A72C]">
            {i18n.t('heroTitle2')}
            <svg class="absolute -bottom-2 left-0 w-full h-3 text-[#B9DDE5] -z-10" viewBox="0 0 100 12" preserveAspectRatio="none" fill="currentColor">
              <path d="M0,8 Q50,0 100,8 L100,12 L0,12 Z"></path>
            </svg>
          </span>
        </h1>

        <p class="mt-6 text-base sm:text-lg text-app-muted font-body font-normal leading-relaxed">
          {i18n.t('heroSub')}
        </p>

        <!-- CTA Buttons -->
        <div class="mt-10 flex flex-wrap gap-4 justify-center lg:justify-start">
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
            <a href="/auth" class="px-7 py-4 text-sm font-bold border-2 border-app-border bg-app-card hover:bg-app-cardSubtle text-[#202124] dark:text-[#F7F5EF] rounded-2xl shadow-sm hover-lift transition-all">
              {i18n.t('signInBtn')}
            </a>
          {/if}
        </div>

        <!-- Trust Badges Under Buttons -->
        <div class="mt-10 pt-8 border-t border-app-border/70 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-app-muted font-medium">
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

      <!-- Right Side: 3D Floating Dashboard Showcase (Interactive Perspective) -->
      <div 
        class="flex-grow w-full max-w-lg lg:max-w-xl perspective-container"
        onmousemove={handleMouseMove}
        onmouseleave={handleMouseLeave}
        role="region"
        aria-label="3D Interactive Platform Preview"
      >
        <div 
          class="relative preserve-3d transition-transform duration-200 ease-out"
          style="transform: rotateX({tiltX}deg) rotateY({tiltY}deg);"
        >
          <!-- Main 3D Dashboard Canvas (Deep Charcoal Surface with Golden Mustard accents, matching reference) -->
          <div class="bg-[#202124] text-[#F7F5EF] rounded-3xl p-6 sm:p-7 shadow-2xl border border-white/10 relative overflow-hidden glow-charcoal">
            
            <!-- Window Bar -->
            <div class="flex items-center justify-between pb-5 border-b border-white/10">
              <div class="flex items-center space-x-2">
                <div class="w-3 h-3 rounded-full bg-[#D4A72C]"></div>
                <div class="w-3 h-3 rounded-full bg-[#B9DDE5]"></div>
                <div class="w-3 h-3 rounded-full bg-white/20"></div>
                <span class="text-xs font-bold text-[#F7F5EF]/80 font-heading tracking-wider ml-2">NEXUS • GROCERSTOCK</span>
              </div>
              <div class="flex items-center space-x-1.5 bg-black/40 px-3 py-1 rounded-full text-[10px] font-bold border border-white/10">
                <span class="w-2 h-2 rounded-full bg-[#D4A72C] animate-ping"></span>
                <span class="text-[#D4A72C]">LIVE MARKET</span>
              </div>
            </div>

            <!-- Top Metric Cards Row (Inspired by User's Reference Image 1) -->
            <div class="grid grid-cols-3 gap-3 pt-5 pb-4">
              <div class="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-[#B9DDE5] uppercase">Active Bids</span>
                  <span class="text-xs text-[#D4A72C]">📊</span>
                </div>
                <div class="text-lg font-extrabold text-white mt-1">11F2328</div>
                <div class="w-full bg-white/10 h-1 rounded-full mt-2 overflow-hidden">
                  <div class="bg-[#D4A72C] h-full w-3/4 rounded-full"></div>
                </div>
              </div>

              <div class="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-[#B9DDE5] uppercase">Dispatched</span>
                  <span class="text-xs text-[#B9DDE5]">🚚</span>
                </div>
                <div class="text-lg font-extrabold text-white mt-1">1,014</div>
                <div class="w-full bg-white/10 h-1 rounded-full mt-2 overflow-hidden">
                  <div class="bg-[#B9DDE5] h-full w-4/5 rounded-full"></div>
                </div>
              </div>

              <div class="bg-white/5 rounded-2xl p-3 border border-white/5 backdrop-blur-sm">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-[#B9DDE5] uppercase">Fulfillment</span>
                  <span class="text-xs text-[#D4A72C]">⚡</span>
                </div>
                <div class="text-lg font-extrabold text-white mt-1">99.4%</div>
                <div class="w-full bg-white/10 h-1 rounded-full mt-2 overflow-hidden">
                  <div class="bg-[#D4A72C] h-full w-11/12 rounded-full"></div>
                </div>
              </div>
            </div>

            <!-- Glowing Mustard Spline Chart Canvas (Inspired by Reference Images 1, 2, and 3) -->
            <div class="mt-2 bg-black/40 rounded-2xl p-4 border border-white/5 relative">
              <div class="flex items-center justify-between mb-2">
                <div>
                  <div class="text-xs font-bold text-white tracking-wide">Procurement Volume Curve</div>
                  <div class="text-[10px] text-[#B9DDE5]">Live quotation rate vs average wholesale pricing</div>
                </div>
                <!-- Toggle buttons -->
                <div class="flex items-center space-x-1 bg-white/10 p-1 rounded-xl text-[10px] font-bold">
                  <span class="px-2.5 py-1 bg-[#D4A72C] text-[#202124] rounded-lg">Today</span>
                  <span class="px-2.5 py-1 text-white/70">Compare</span>
                </div>
              </div>

              <!-- Interactive Chart SVG -->
              <div class="relative w-full h-36">
                <svg viewBox="0 0 400 130" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full overflow-visible">
                  <!-- Gradient Definition -->
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#D4A72C" stop-opacity="0.38" />
                      <stop offset="100%" stop-color="#D4A72C" stop-opacity="0.0" />
                    </linearGradient>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#B9DDE5" stop-opacity="0.4" />
                      <stop offset="100%" stop-color="#B9DDE5" stop-opacity="0.05" />
                    </linearGradient>
                  </defs>

                  <!-- Background Grid Lines -->
                  <line x1="0" y1="20" x2="400" y2="20" stroke="white" stroke-opacity="0.05" stroke-dasharray="3 3" />
                  <line x1="0" y1="60" x2="400" y2="60" stroke="white" stroke-opacity="0.05" stroke-dasharray="3 3" />
                  <line x1="0" y1="100" x2="400" y2="100" stroke="white" stroke-opacity="0.05" stroke-dasharray="3 3" />

                  <!-- Secondary Pale Blue Bars in background -->
                  <rect x="35" y="70" width="10" height="40" rx="3" fill="url(#barGradient)" />
                  <rect x="95" y="55" width="10" height="55" rx="3" fill="url(#barGradient)" />
                  <rect x="155" y="40" width="10" height="70" rx="3" fill="url(#barGradient)" />
                  <rect x="215" y="30" width="10" height="80" rx="3" fill="url(#barGradient)" />
                  <rect x="275" y="50" width="10" height="60" rx="3" fill="url(#barGradient)" />
                  <rect x="335" y="20" width="10" height="90" rx="3" fill="url(#barGradient)" />

                  <!-- Area Fill for Spline -->
                  <path d="M10 100 C 50 90, 80 40, 120 55 C 160 70, 190 25, 230 45 C 270 65, 300 20, 340 35 C 370 45, 385 15, 390 10 L 390 115 L 10 115 Z" fill="url(#chartGradient)" />

                  <!-- Primary Glowing Spline Curve (Mustard Yellow #D4A72C) -->
                  <path 
                    d="M10 100 C 50 90, 80 40, 120 55 C 160 70, 190 25, 230 45 C 270 65, 300 20, 340 35 C 370 45, 385 15, 390 10" 
                    stroke="#D4A72C" 
                    stroke-width="3.5" 
                    stroke-linecap="round" 
                    class="drop-shadow-[0_4px_12px_rgba(212,167,44,0.6)]"
                  />

                  <!-- Key Data Nodes -->
                  <circle cx="120" cy="55" r="4.5" fill="#202124" stroke="#D4A72C" stroke-width="2.5" />
                  <circle cx="230" cy="45" r="5" fill="#D4A72C" stroke="#FFFFFF" stroke-width="2" class="animate-pulse" />
                  <circle cx="340" cy="35" r="4.5" fill="#202124" stroke="#D4A72C" stroke-width="2.5" />
                </svg>

                <!-- Floating Tooltip Card over active node -->
                <div class="absolute top-2 left-1/2 -translate-x-1/2 bg-[#D4A72C] text-[#202124] px-3 py-1 rounded-xl text-[10px] font-black shadow-lg glow-mustard flex items-center space-x-1.5 animate-float-gentle">
                  <span>⚡ BEST BID: ₹42/kg</span>
                  <span class="opacity-70">• Fast Dispatch</span>
                </div>
              </div>

              <!-- Month timeline labels -->
              <div class="flex justify-between text-[9px] font-bold text-white/40 pt-2 border-t border-white/5">
                <span>Jan</span>
                <span>Mar</span>
                <span>May</span>
                <span>Jul</span>
                <span>Sep</span>
                <span>Nov</span>
              </div>
            </div>

            <!-- Footer Action Row (Matching Send Quotation button from image 1) -->
            <div class="mt-4 flex items-center justify-between pt-2">
              <div class="flex items-center space-x-2">
                <div class="w-7 h-7 rounded-lg bg-[#B9DDE5]/20 flex items-center justify-center text-xs">📍</div>
                <div class="text-[11px] font-medium text-white/80">
                  <span class="font-bold text-[#F7F5EF]">24 Local Wholesalers</span> active in your radius
                </div>
              </div>
              <div class="px-3.5 py-1.5 rounded-xl bg-[#D4A72C] text-[#202124] text-xs font-bold shadow-md hover:scale-105 transition">
                Send a Query
              </div>
            </div>
          </div>

          <!-- 3D FLOATING ELEMENT 1: Instant Quotations Badge (Hovers off top-left in 3D) -->
          <div class="absolute -top-7 -left-6 bg-app-card text-app-text p-3.5 rounded-2xl border border-app-border shadow-2xl animate-float-chip-1 preserve-3d flex items-center space-x-3 pointer-events-none">
            <div class="h-10 w-10 rounded-xl bg-[#D4A72C] text-[#202124] flex items-center justify-center font-bold text-lg shadow-md glow-mustard">
              ⚡
            </div>
            <div>
              <div class="text-xs font-black font-heading text-app-text">Instant Wholesaler Quotes</div>
              <div class="text-[10px] text-app-muted">4 Competitive bids within 15 mins</div>
            </div>
          </div>

          <!-- 3D FLOATING ELEMENT 2: Hyperlocal Radius Badge (Hovers off bottom-right in 3D) -->
          <div class="absolute -bottom-8 -right-6 bg-app-card text-app-text p-3.5 rounded-2xl border border-app-border shadow-2xl animate-float-chip-2 preserve-3d flex items-center space-x-3 pointer-events-none">
            <div class="h-10 w-10 rounded-xl bg-[#B9DDE5] text-[#202124] flex items-center justify-center font-bold text-lg shadow-md">
              📍
            </div>
            <div>
              <div class="text-xs font-black font-heading text-app-text">Nearby Supplier Match</div>
              <div class="text-[10px] text-[#D4A72C] font-bold">2.4 km delivery radius</div>
            </div>
          </div>

          <!-- 3D FLOATING ELEMENT 3: Smart Margin Badge (Hovers off bottom-left in 3D) -->
          <div class="hidden sm:flex absolute top-1/2 -left-10 -translate-y-1/2 bg-[#202124] text-[#F7F5EF] px-3.5 py-2.5 rounded-2xl border border-white/10 shadow-2xl animate-float-chip-3 preserve-3d items-center space-x-2.5 pointer-events-none">
            <span class="h-2.5 w-2.5 rounded-full bg-[#D4A72C] animate-ping"></span>
            <div class="text-[11px] font-bold">
              <span class="text-[#D4A72C]">Saved 14%</span> vs Retail MRP
            </div>
          </div>

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
