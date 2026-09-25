<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth.svelte.js';
  import { api } from '$lib/api.js';
  import { i18n } from '$lib/i18n.svelte.js';
  import { toasts } from '$lib/toasts.svelte.js';

  let view = $state('login'); // 'login' | 'register' | 'forgot' | 'otp'
  
  // Login Form
  let loginEmail = $state('');
  let loginPassword = $state('');
  let loginError = $state('');
  let loginLoading = $state(false);
  let showLoginPassword = $state(false);

  // Register Form
  let regEmail = $state('');
  let regPassword = $state('');
  let regConfirmPassword = $state('');
  let regRole = $state('retailer');
  let storeName = $state('');
  let companyName = $state('');
  let phone = $state('');
  let address = $state('');
  let businessRegNo = $state('');
  let regError = $state('');
  let regLoading = $state(false);
  let showRegPassword = $state(false);
  let showConfirmPassword = $state(false);
  let regCity = $state('');
  let regState = $state('');
  let regPostalCode = $state('');
  let regLat = $state(null);
  let regLng = $state(null);
  let locatingReg = $state(false);

  function detectRegistrationLocation() {
    if (!navigator.geolocation) {
      toasts.error('Geolocation is not supported by your browser.');
      return;
    }
    locatingReg = true;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        locatingReg = false;
        regLat = Number(pos.coords.latitude.toFixed(6));
        regLng = Number(pos.coords.longitude.toFixed(6));
        try {
          const revRes = await api.get(`/location/reverse?lat=${regLat}&lng=${regLng}`);
          if (revRes.success && revRes.data) {
            if (revRes.data.formattedAddress) address = revRes.data.formattedAddress;
            if (revRes.data.city) regCity = revRes.data.city;
            if (revRes.data.state) regState = revRes.data.state;
            if (revRes.data.postalCode) regPostalCode = revRes.data.postalCode;
            toasts.success(`Location detected: ${revRes.data.city || revRes.data.formattedAddress}`);
          }
        } catch {
          toasts.info('GPS coordinates acquired.');
        }
      },
      (err) => {
        locatingReg = false;
        if (err.code === 1) {
          toasts.warning('Location permission was denied. Please enter address manually.');
        } else {
          toasts.error('Unable to retrieve location. Please enter manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // OTP State
  let otpEmail = $state('');
  let otpDigits = $state(['', '', '', '', '', '']);
  let otpError = $state('');
  let otpSuccess = $state('');
  let otpLoading = $state(false);
  let resendCooldown = $state(0);
  let resendTimer = null;

  // Password Validation derived states
  let min8 = $derived(regPassword.length >= 8);
  let hasUpper = $derived(/[A-Z]/.test(regPassword));
  let hasLower = $derived(/[a-z]/.test(regPassword));
  let hasDigit = $derived(/[0-9]/.test(regPassword));
  let hasSpecial = $derived(/[^A-Za-z0-9]/.test(regPassword));
  let matchCheck = $derived(regConfirmPassword.length > 0 && regPassword === regConfirmPassword);

  let pwScore = $derived(
    [min8, hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length
  );

  let strengthText = $derived(() => {
    if (regPassword.length === 0) return '';
    if (pwScore <= 2) return i18n.t('strengthWeak');
    if (pwScore === 3) return i18n.t('strengthMedium');
    if (pwScore === 4) return i18n.t('strengthStrong');
    if (pwScore === 5) return i18n.t('strengthStrong');
    return '';
  });

  let strengthColor = $derived(() => {
    if (pwScore <= 2) return 'text-rose-500';
    if (pwScore === 3) return 'text-amber-500';
    return 'text-brand-orange';
  });

  let strengthBg = $derived(() => {
    if (pwScore <= 2) return 'bg-rose-500';
    if (pwScore === 3) return 'bg-amber-500';
    return 'bg-brand-orange';
  });

  let strengthPct = $derived(
    regPassword.length === 0 ? 0 : pwScore * 20
  );

  // Forgot Password Form
  let forgotEmail = $state('');
  let forgotMessage = $state('');
  let forgotError = $state('');
  let forgotLoading = $state(false);

  $effect(() => {
    const isReg = $page.url.searchParams.get('register');
    if (isReg === 'true') {
      view = 'register';
    } else if (isReg === 'false') {
      view = 'login';
    }
  });

  function startResendTimer() {
    resendCooldown = 60;
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      if (resendCooldown > 0) {
        resendCooldown -= 1;
      } else {
        clearInterval(resendTimer);
        resendTimer = null;
      }
    }, 1000);
  }

  async function handleLogin(e) {
    e.preventDefault();
    loginError = '';
    loginLoading = true;

    if (!loginEmail) {
      document.getElementById('login-email')?.focus();
      loginError = 'Email is required';
      loginLoading = false;
      return;
    }
    if (!loginPassword) {
      document.getElementById('login-password')?.focus();
      loginError = 'Password is required';
      loginLoading = false;
      return;
    }

    try {
      const res = await api.post('/auth/login', {
        email: loginEmail,
        password: loginPassword
      });

      if (res.requireOtp) {
        otpEmail = res.email;
        view = 'otp';
        startResendTimer();
        toasts.warning('Please enter the 6-digit verification code sent to your email.');
        return;
      }

      auth.setSession(res, res.token);
      toasts.success(i18n.locale === 'ta' ? 'உள்நுழைவு வெற்றியடைந்தது!' : 'Signed in successfully!');
      
      if (res.role === 'retailer') goto('/retailer');
      else if (res.role === 'wholesaler') goto('/wholesaler');
      else if (res.role === 'admin') goto('/admin');
    } catch (err) {
      if (err.message.includes('not verified') || err.message.includes('OTP')) {
        otpEmail = loginEmail;
        view = 'otp';
        startResendTimer();
        toasts.warning('Email verification required. Code sent to your inbox.');
      } else {
        loginError = err.message || 'Login failed';
        toasts.error(loginError);
      }
    } finally {
      loginLoading = false;
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (regLoading) return;
    regError = '';
    regLoading = true;

    if (!regEmail) {
      document.getElementById('reg-email')?.focus();
      regError = 'Email is required';
      regLoading = false;
      return;
    }
    if (pwScore < 4) {
      document.getElementById('reg-password')?.focus();
      regError = 'Password does not meet complexity requirements';
      regLoading = false;
      return;
    }
    if (!matchCheck) {
      document.getElementById('reg-confirm')?.focus();
      regError = 'Passwords do not match';
      regLoading = false;
      return;
    }
    if (regRole === 'retailer' && !storeName) {
      document.getElementById('store-name')?.focus();
      regError = 'Store name is required';
      regLoading = false;
      return;
    }
    if (regRole === 'wholesaler' && !companyName) {
      document.getElementById('company-name')?.focus();
      regError = 'Company name is required';
      regLoading = false;
      return;
    }
    if (regRole === 'wholesaler' && !businessRegNo) {
      document.getElementById('business-reg')?.focus();
      regError = 'Business registration number is required';
      regLoading = false;
      return;
    }
    if (!phone) {
      document.getElementById('phone')?.focus();
      regError = 'Phone number is required';
      regLoading = false;
      return;
    }
    if (!address) {
      document.getElementById('address')?.focus();
      regError = 'Address is required';
      regLoading = false;
      return;
    }

    try {
      const body = {
        email: regEmail,
        password: regPassword,
        role: regRole,
        phone,
        address,
        city: regCity,
        state: regState,
        postalCode: regPostalCode,
        latitude: regLat,
        longitude: regLng,
      };

      if (regRole === 'retailer') {
        body.storeName = storeName;
      } else {
        body.companyName = companyName;
        body.businessRegNo = businessRegNo;
      }

      const res = await api.post('/auth/register', body);
      otpEmail = regEmail;
      view = 'otp';
      startResendTimer();
      toasts.success('Registration successful! Enter the verification code sent to your email.');
    } catch (err) {
      const rawMsg = err.message || '';
      if (rawMsg.includes('already exists') || rawMsg.includes('409')) {
        regError = 'An account with this email already exists.';
      } else if (rawMsg.includes('verification email') || rawMsg.includes('503') || rawMsg.includes('SMTP')) {
        regError = "We couldn't send the OTP. Please check your email configuration and try again.";
      } else if (rawMsg.includes('next is not a function')) {
        regError = 'Unable to create your account. Please try again.';
      } else {
        regError = rawMsg || 'Unable to create your account. Please try again.';
      }
      toasts.error(regError);
    } finally {
      regLoading = false;
    }
  }

  function handleOtpInput(index, event) {
    const val = event.target.value;
    if (val.length > 1) {
      // Paste handling
      const pasted = val.slice(0, 6).split('');
      otpDigits = Array(6).fill('').map((_, i) => pasted[i] || '');
      const nextFocus = Math.min(pasted.length, 5);
      document.getElementById(`otp-input-${nextFocus}`)?.focus();
      return;
    }

    otpDigits[index] = val;
    if (val && index < 5) {
      document.getElementById(`otp-input-${index + 1}`)?.focus();
    }
  }

  function handleOtpKeydown(index, event) {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      document.getElementById(`otp-input-${index - 1}`)?.focus();
    }
  }

  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    if (otpLoading) return;
    otpError = '';
    otpSuccess = '';
    otpLoading = true;

    const fullCode = otpDigits.join('');
    if (fullCode.length < 6) {
      otpError = 'Please enter all 6 digits of the OTP verification code.';
      otpLoading = false;
      return;
    }

    try {
      const res = await api.post('/auth/verify-otp', {
        email: otpEmail,
        otp: fullCode,
      });

      otpSuccess = 'Email verified successfully!';
      auth.setSession(res, res.token);
      toasts.success('Email verified successfully!');

      setTimeout(() => {
        if (res.role === 'retailer') goto('/retailer');
        else if (res.role === 'wholesaler') goto('/wholesaler');
        else if (res.role === 'admin') goto('/admin');
        else goto('/');
      }, 600);
    } catch (err) {
      otpError = err.message || 'Invalid or expired verification code. Please try again.';
      toasts.error(otpError);
    } finally {
      otpLoading = false;
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    otpError = '';
    otpSuccess = '';

    try {
      const res = await api.post('/auth/resend-otp', { email: otpEmail });
      otpSuccess = res.message || 'New OTP sent to your email';
      toasts.success('A new 6-digit code has been sent!');
      startResendTimer();
    } catch (err) {
      otpError = err.message || 'Failed to resend OTP';
      toasts.error(otpError);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    forgotError = '';
    forgotMessage = '';
    forgotLoading = true;

    if (!forgotEmail) {
      document.getElementById('forgot-email')?.focus();
      forgotError = 'Email is required';
      forgotLoading = false;
      return;
    }

    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail });
      forgotMessage = res.message || 'Reset link sent to your email!';
      toasts.success(forgotMessage);
    } catch (err) {
      forgotError = err.message || 'Failed to send recovery email';
      toasts.error(forgotError);
    } finally {
      forgotLoading = false;
    }
  }

  onMount(() => {
    if (auth.token && auth.user) {
      if (auth.user.role === 'retailer') goto('/retailer');
      else if (auth.user.role === 'wholesaler') goto('/wholesaler');
      else if (auth.user.role === 'admin') goto('/admin');
    }
  });
</script>

<div class="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-app-bg transition-colors duration-200">
  <!-- Left Side static benefits panel -->
  <div class="lg:w-1/2 bg-brand-olive text-white flex flex-col justify-between p-8 sm:p-16 relative overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-brand-olive via-brand-olive to-[#3A3F29] opacity-95 z-0"></div>
    <div class="absolute -top-16 -left-16 w-64 h-64 bg-brand-orange rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>
    <div class="absolute -bottom-16 -right-16 w-64 h-64 bg-brand-sage rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>

    <div class="z-10 flex flex-col h-full justify-between">
      <div class="flex items-center space-x-3">
        <div class="h-9 w-9 rounded-xl bg-brand-orange text-white flex items-center justify-center font-heading font-extrabold text-lg shadow-sm">
          G
        </div>
        <span class="font-heading text-xl font-bold tracking-tight">{i18n.t('brandName')}</span>
      </div>

      <div class="my-auto py-12 max-w-md">
        <h2 class="text-3xl sm:text-4xl font-extrabold font-heading tracking-tight leading-tight text-brand-cream">
          {i18n.t('welcomeTitle')}
        </h2>
        <p class="mt-4 text-brand-sage leading-relaxed font-body">
          {i18n.t('welcomeSub')}
        </p>

        <ul class="mt-8 space-y-4 text-sm font-medium">
          <li class="flex items-center space-x-3">
            <span class="h-6 w-6 rounded-full bg-brand-orange text-white flex items-center justify-center text-xs font-bold shadow-sm">✓</span>
            <span class="text-brand-cream">{i18n.t('benefit1')}</span>
          </li>
          <li class="flex items-center space-x-3">
            <span class="h-6 w-6 rounded-full bg-brand-orange text-white flex items-center justify-center text-xs font-bold shadow-sm">✓</span>
            <span class="text-brand-cream">{i18n.t('benefit2')}</span>
          </li>
          <li class="flex items-center space-x-3">
            <span class="h-6 w-6 rounded-full bg-brand-orange text-white flex items-center justify-center text-xs font-bold shadow-sm">✓</span>
            <span class="text-brand-cream">{i18n.t('benefit3')}</span>
          </li>
        </ul>
      </div>

      <div class="text-xs text-brand-sage/70">
        &copy; {new Date().getFullYear()} {i18n.t('brandName')}.
      </div>
    </div>
  </div>

  <!-- Right Side Form Panel -->
  <div class="lg:w-1/2 flex items-center justify-center p-6 sm:p-12 z-10 bg-app-bg">
    <div class="w-full max-w-md bg-app-card rounded-3xl border border-app-border shadow-xl overflow-hidden transition-colors duration-200">
      
      {#if view === 'otp'}
        <!-- OTP Verification Screen -->
        <div class="px-6 sm:px-8 py-10">
          <div class="text-center">
            <div class="mx-auto w-14 h-14 bg-brand-orange/10 text-brand-orange rounded-2xl flex items-center justify-center text-2xl mb-4">
              ✉️
            </div>
            <h3 class="text-2xl font-bold text-app-text tracking-tight">Verify Email Address</h3>
            <p class="mt-2 text-xs text-app-muted leading-relaxed">
              We sent a 6-digit verification code to: <br/>
              <strong class="text-brand-orange text-sm font-semibold">{otpEmail}</strong>
            </p>
          </div>

          <form onsubmit={handleVerifyOtp} class="mt-8 space-y-6">
            {#if otpError}
              <div class="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-xl font-semibold border border-rose-200 dark:border-rose-900">
                {otpError}
              </div>
            {/if}
            {#if otpSuccess}
              <div class="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 rounded-xl font-semibold border border-emerald-200 dark:border-emerald-900">
                {otpSuccess}
              </div>
            {/if}

            <!-- 6 Segmented Digit Inputs -->
            <div class="flex justify-center space-x-2 sm:space-x-3">
              {#each otpDigits as digit, i}
                <input 
                  id="otp-input-{i}"
                  type="text" 
                  inputmode="numeric"
                  maxlength="1"
                  value={digit}
                  oninput={(e) => handleOtpInput(i, e)}
                  onkeydown={(e) => handleOtpKeydown(i, e)}
                  class="w-11 h-13 text-center text-xl font-bold rounded-xl border border-app-border bg-app-cardSubtle text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all shadow-xs"
                />
              {/each}
            </div>

            <button 
              type="submit" 
              disabled={otpLoading}
              class="w-full py-3 text-sm font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl transition-all shadow-md hover-lift flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {otpLoading ? 'Verifying Code...' : 'Verify & Continue'}
            </button>
          </form>

          <div class="mt-6 text-center space-y-3">
            <div class="text-xs text-app-muted">
              Didn't receive code? 
              <button 
                type="button"
                onclick={handleResendOtp}
                disabled={resendCooldown > 0}
                class="font-bold text-brand-orange hover:underline transition disabled:opacity-50 ml-1"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </div>

            <button 
              onclick={() => view = 'login'}
              class="text-xs font-semibold text-app-muted hover:text-app-text transition"
            >
              ← Back to Sign In
            </button>
          </div>
        </div>
      {:else}
        <!-- Sliding Panels for Forgot / Login / Register -->
        <div 
          class="flex w-[300%] transition-transform duration-500 ease-in-out"
          style="transform: translateX({view === 'forgot' ? '0%' : view === 'login' ? '-33.333%' : '-66.666%'})"
        >
          <!-- Form Panel 0: Forgot Password -->
          <div class="w-[33.333%] px-6 sm:px-8 py-8 flex flex-col justify-between flex-shrink-0">
            <div>
              <h3 class="text-xl font-bold text-app-text tracking-tight">{i18n.t('forgotPwTitle')}</h3>
              <p class="mt-2 text-xs text-app-muted">
                {i18n.t('forgotPwSub')}
              </p>

              <form onsubmit={handleForgotPassword} class="mt-6 space-y-4">
                {#if forgotError}
                  <div class="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-xl font-medium border border-rose-200">
                    {forgotError}
                  </div>
                {/if}
                {#if forgotMessage}
                  <div class="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 rounded-xl font-medium border border-emerald-200">
                    {forgotMessage}
                  </div>
                {/if}

                <div>
                  <label for="forgot-email" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('emailLabel')}</label>
                  <input 
                    id="forgot-email"
                    type="email" 
                    bind:value={forgotEmail}
                    placeholder="name@store.com"
                    class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={forgotLoading}
                  class="w-full py-3 text-sm font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl transition-all shadow-md hover-lift flex justify-center items-center"
                >
                  {forgotLoading ? '...' : i18n.t('sendRecoveryBtn')}
                </button>
              </form>
            </div>

            <div class="mt-6 text-center">
              <button 
                onclick={() => view = 'login'}
                class="text-xs font-semibold text-brand-orange hover:underline transition"
              >
                {i18n.t('backToSignIn')}
              </button>
            </div>
          </div>

          <!-- Form Panel 1: Login Form -->
          <div class="w-[33.333%] px-6 sm:px-8 py-8 flex flex-col justify-between flex-shrink-0">
            <div>
              <h3 class="text-2xl font-bold text-app-text tracking-tight">{i18n.t('signInTitle')}</h3>
              <p class="mt-2 text-xs text-app-muted">
                {i18n.t('signInSub')}
              </p>

              <form onsubmit={handleLogin} class="mt-6 space-y-4">
                {#if loginError}
                  <div class="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-xl font-semibold border border-rose-200">
                    {loginError}
                  </div>
                {/if}

                <div>
                  <label for="login-email" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('emailLabel')}</label>
                  <input 
                    id="login-email"
                    type="email" 
                    bind:value={loginEmail}
                    placeholder="retailer@store.com"
                    class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                  />
                </div>

                <div>
                  <div class="flex justify-between items-center">
                    <label for="login-password" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('passwordLabel')}</label>
                    <button 
                      type="button"
                      onclick={() => view = 'forgot'}
                      class="text-[11px] font-semibold text-brand-orange hover:underline transition"
                    >
                      {i18n.t('forgotPwLink')}
                    </button>
                  </div>
                  <div class="relative mt-1">
                    <input 
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'} 
                      bind:value={loginPassword}
                      placeholder="••••••••"
                      class="block w-full pl-3.5 pr-12 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                    />
                    <button 
                      type="button"
                      onclick={() => showLoginPassword = !showLoginPassword}
                      class="absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-app-muted hover:text-app-text select-none"
                    >
                      {showLoginPassword ? i18n.t('hidePw') : i18n.t('showPw')}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loginLoading}
                  class="w-full py-3 text-sm font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl transition-all shadow-md hover-lift flex justify-center items-center"
                >
                  {loginLoading ? i18n.t('signingInText') : i18n.t('signInBtnAction')}
                </button>
              </form>
            </div>

            <div class="mt-6 text-center text-xs text-app-muted">
              {i18n.t('signUpPrompt')} 
              <button 
                onclick={() => view = 'register'}
                class="font-bold text-brand-orange hover:underline transition ml-1"
              >
                {i18n.t('signUpBtn')}
              </button>
            </div>
          </div>

          <!-- Form Panel 2: Register Form -->
          <div class="w-[33.333%] px-6 sm:px-8 py-8 flex flex-col justify-between flex-shrink-0 overflow-y-auto max-h-[600px]">
            <div>
              <h3 class="text-2xl font-bold text-app-text tracking-tight">{i18n.t('createAccountTitle')}</h3>
              <p class="mt-2 text-xs text-app-muted">
                {i18n.t('createAccountSub')}
              </p>

              <form onsubmit={handleRegister} class="mt-6 space-y-4">
                {#if regError}
                  <div class="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-xl font-semibold border border-rose-200">
                    {regError}
                  </div>
                {/if}

                <!-- Role Tabs -->
                <div>
                  <span class="block text-xs font-bold text-app-text uppercase tracking-wider mb-2">{i18n.t('roleLabel')}</span>
                  <div class="grid grid-cols-2 gap-2 bg-app-cardSubtle p-1 rounded-xl border border-app-border">
                    <button 
                      type="button"
                      onclick={() => regRole = 'retailer'}
                      class="py-1.5 text-xs font-bold rounded-lg transition-all {regRole === 'retailer' ? 'bg-brand-orange text-white shadow-xs' : 'text-app-muted hover:text-app-text'}"
                    >
                      {i18n.t('retailerRole')}
                    </button>
                    <button 
                      type="button"
                      onclick={() => regRole = 'wholesaler'}
                      class="py-1.5 text-xs font-bold rounded-lg transition-all {regRole === 'wholesaler' ? 'bg-brand-orange text-white shadow-xs' : 'text-app-muted hover:text-app-text'}"
                    >
                      {i18n.t('wholesalerRole')}
                    </button>
                  </div>
                </div>

                <div>
                  <label for="reg-email" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('emailLabel')}</label>
                  <input 
                    id="reg-email"
                    type="email" 
                    bind:value={regEmail}
                    placeholder="name@company.com"
                    class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                  />
                </div>

                <!-- Password + strength checklist -->
                <div>
                  <label for="reg-password" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('passwordLabel')}</label>
                  <div class="relative mt-1">
                    <input 
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'} 
                      bind:value={regPassword}
                      placeholder="••••••••"
                      class="block w-full pl-3.5 pr-12 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                    />
                    <button 
                      type="button"
                      onclick={() => showRegPassword = !showRegPassword}
                      class="absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-app-muted hover:text-app-text select-none"
                    >
                      {showRegPassword ? i18n.t('hidePw') : i18n.t('showPw')}
                    </button>
                  </div>

                  {#if regPassword.length > 0}
                    <div class="mt-2.5 space-y-1.5 p-3 bg-app-cardSubtle border border-app-border rounded-xl text-[10px]">
                      <div class="flex justify-between items-center mb-1">
                        <span class="text-app-muted font-bold uppercase text-[9px]">{i18n.t('pwStrength')}:</span>
                        <span class="font-extrabold {strengthColor()}">{strengthText()}</span>
                      </div>
                      <div class="w-full h-1.5 bg-app-border rounded-full overflow-hidden">
                        <div class="h-full {strengthBg()} transition-all duration-300" style="width: {strengthPct}%"></div>
                      </div>
                      <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-app-muted font-medium">
                        <div class="flex items-center space-x-1">
                          <span class={min8 ? 'text-brand-orange' : 'opacity-30'}>{min8 ? '✔' : '○'}</span>
                          <span class={min8 ? 'text-app-text font-semibold' : ''}>{i18n.t('ruleLength')}</span>
                        </div>
                        <div class="flex items-center space-x-1">
                          <span class={hasUpper ? 'text-brand-orange' : 'opacity-30'}>{hasUpper ? '✔' : '○'}</span>
                          <span class={hasUpper ? 'text-app-text font-semibold' : ''}>{i18n.t('ruleUppercase')}</span>
                        </div>
                        <div class="flex items-center space-x-1">
                          <span class={hasLower ? 'text-brand-orange' : 'opacity-30'}>{hasLower ? '✔' : '○'}</span>
                          <span class={hasLower ? 'text-app-text font-semibold' : ''}>{i18n.t('ruleLowercase')}</span>
                        </div>
                        <div class="flex items-center space-x-1">
                          <span class={hasDigit ? 'text-brand-orange' : 'opacity-30'}>{hasDigit ? '✔' : '○'}</span>
                          <span class={hasDigit ? 'text-app-text font-semibold' : ''}>{i18n.t('ruleNumber')}</span>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- Confirm Password -->
                <div>
                  <label for="reg-confirm" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('confirmPasswordLabel')}</label>
                  <div class="relative mt-1">
                    <input 
                      id="reg-confirm"
                      type={showConfirmPassword ? 'text' : 'password'} 
                      bind:value={regConfirmPassword}
                      placeholder="••••••••"
                      class="block w-full pl-3.5 pr-12 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                    />
                    <button 
                      type="button"
                      onclick={() => showConfirmPassword = !showConfirmPassword}
                      class="absolute inset-y-0 right-3 flex items-center text-[10px] font-bold text-app-muted hover:text-app-text select-none"
                    >
                      {showConfirmPassword ? i18n.t('hidePw') : i18n.t('showPw')}
                    </button>
                  </div>
                  {#if regConfirmPassword.length > 0}
                    <div class="mt-1 flex items-center space-x-1 text-[10px] font-bold">
                      <span class={matchCheck ? 'text-brand-orange' : 'text-rose-500'}>{matchCheck ? '✔' : '✕'}</span>
                      <span class={matchCheck ? 'text-app-text' : 'text-rose-500'}>{i18n.t('matchCheck')}</span>
                    </div>
                  {/if}
                </div>

                {#if regRole === 'retailer'}
                  <div>
                    <label for="store-name" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('storeNameLabel')}</label>
                    <input 
                      id="store-name"
                      type="text" 
                      bind:value={storeName}
                      placeholder="Corner Grocery LLC"
                      class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                    />
                  </div>
                {:else}
                  <div>
                    <label for="company-name" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('companyNameLabel')}</label>
                    <input 
                      id="company-name"
                      type="text" 
                      bind:value={companyName}
                      placeholder="Apex Wholesale Foods"
                      class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                    />
                  </div>

                  <div>
                    <label for="business-reg" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('businessRegLabel')}</label>
                    <input 
                      id="business-reg"
                      type="text" 
                      bind:value={businessRegNo}
                      placeholder="REG-882910"
                      class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                    />
                  </div>
                {/if}

                <div>
                  <label for="phone" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('phoneLabel')}</label>
                  <input 
                    id="phone"
                    type="text" 
                    bind:value={phone}
                    placeholder="555-0100"
                    class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between">
                    <label for="address" class="block text-xs font-bold text-app-text uppercase tracking-wider">{i18n.t('addressLabel')}</label>
                    <button
                      type="button"
                      onclick={detectRegistrationLocation}
                      disabled={locatingReg}
                      class="text-[11px] font-semibold text-brand-orange hover:underline transition flex items-center gap-1 disabled:opacity-50"
                    >
                      <span>🎯</span>
                      <span>{locatingReg ? 'Detecting...' : 'Use My GPS Location'}</span>
                    </button>
                  </div>
                  <input 
                    id="address"
                    type="text" 
                    bind:value={address}
                    placeholder="456 Industrial Way, Suite A"
                    class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                  />
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label for="reg-city" class="block text-xs font-bold text-app-text uppercase tracking-wider">City</label>
                    <input 
                      id="reg-city"
                      type="text" 
                      bind:value={regCity}
                      placeholder="Salem"
                      class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                    />
                  </div>
                  <div>
                    <label for="reg-state" class="block text-xs font-bold text-app-text uppercase tracking-wider">State</label>
                    <input 
                      id="reg-state"
                      type="text" 
                      bind:value={regState}
                      placeholder="Tamil Nadu"
                      class="mt-1 block w-full px-3.5 py-2.5 bg-app-cardSubtle border border-app-border rounded-xl text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={regLoading}
                  class="w-full py-3 text-sm font-bold bg-brand-orange hover:bg-brand-orange/90 text-white rounded-xl transition-all shadow-md hover-lift flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {regLoading ? i18n.t('creatingAccountText') : i18n.t('createAccountAction')}
                </button>
              </form>
            </div>

            <div class="mt-6 text-center text-xs text-app-muted">
              {i18n.t('signInPrompt')} 
              <button 
                onclick={() => view = 'login'}
                class="font-bold text-brand-orange hover:underline transition ml-1"
              >
                {i18n.t('signInBtnAction')}
              </button>
            </div>
          </div>
        </div>
      {/if}

    </div>
  </div>
</div>
