class I18nStore {
  locale = 'en';

  setLocale() {
    // English-only application mode
    this.locale = 'en';
  }

  // Translation dictionaries (English-only)
  translations = {
    en: {
      brandName: 'GrocerStock',
      retailerDashboard: 'Retailer Dashboard',
      wholesalerDashboard: 'Wholesaler Dashboard',
      adminPanel: 'Admin Panel',
      logout: 'Logout',
      signIn: 'Sign In',
      getStarted: 'Get Started',
      
      // Landing Page
      heroTitle1: 'Connecting Grocers with',
      heroTitle2: 'Local Wholesalers Instantly.',
      heroSub: 'Skip the endless phone calls. Retailers create stock requests, nearby wholesalers bid competitive prices, and you pick the best deal. Streamlined, transparent, and fast.',
      getStartedBtn: 'Get Started for Free',
      signInBtn: 'Sign In',
      featuresHeading: 'Modern Features for Smooth Stock Flow',
      featuresSub: 'Everything you need to request, bid, compare, and fulfill stock requests in one minimal interface.',
      feature1Title: 'Sleek Requests',
      feature1Desc: 'Create detailed stock requests specifying quantity, unit, urgency, brand, and preferred dates with dropdowns.',
      feature2Title: 'Instant Bidding',
      feature2Desc: 'Wholesalers respond instantly with item availability, offered quantity, price quotation, and expected delivery.',
      feature3Title: 'Compare & Accept',
      feature3Desc: 'Compare multiple bids side-by-side. Choose the best supplier based on price, delivery time, and volume.',
      feature4Title: 'Real-time Updates',
      feature4Desc: 'Receive real-time alerts when requests are created, bids are submitted, or a bid is accepted.',
      howItWorksHeading: 'How It Works',
      howItWorksSub: 'Simplify your inventory procurement in three simple steps.',
      step1Title: 'Create Stock Request',
      step1Desc: 'Retailers log in and submit requests for needed grocery stock. Wholesalers are notified instantly.',
      step2Title: 'Wholesalers Submit Bids',
      step2Desc: 'Wholesalers view pending requests and submit detailed quotes containing availability, quantity, and pricing.',
      step3Title: 'Choose Best Supplier',
      step3Desc: 'Retailer compares bids, accepts the best fit with one click, and the winning wholesaler is alerted.',
      footerInfo: 'Trusted by 2,000+ local grocers. Built for modern local B2B grocery supply.',

      // Auth Page
      welcomeTitle: 'Smarter Grocery Stock Management.',
      welcomeSub: 'Join nearby retailers and wholesalers on the primary digital platform for grocery procurement. Send quick requests and secure the best wholesale margins.',
      benefit1: 'Eliminate multiple cold calls and follow-ups.',
      benefit2: 'Receive competitive quotes side-by-side.',
      benefit3: 'Real-time notifications on response status.',
      forgotPwTitle: 'Forgot Password',
      forgotPwSub: 'Enter your email address and we will send you a link to reset your password.',
      backToSignIn: 'Back to Sign In',
      sendRecoveryBtn: 'Send Recovery Link',
      signInTitle: 'Sign In',
      signInSub: 'Welcome back. Enter your credentials to access your dashboard.',
      emailLabel: 'Email Address',
      passwordLabel: 'Password',
      confirmPasswordLabel: 'Confirm Password',
      forgotPwLink: 'Forgot password?',
      signInBtnAction: 'Sign In',
      signingInText: 'Signing In...',
      signUpPrompt: "Don't have an account?",
      signUpBtn: 'Sign Up',
      createAccountTitle: 'Create Account',
      createAccountSub: 'Set up your profile to start requesting stock or responding to bids.',
      roleLabel: 'I am a',
      retailerRole: 'Retailer',
      wholesalerRole: 'Wholesaler',
      storeNameLabel: 'Store Name',
      companyNameLabel: 'Company Name',
      businessRegLabel: 'Business Reg Number',
      phoneLabel: 'Phone Number',
      addressLabel: 'Business Address',
      creatingAccountText: 'Creating Account...',
      createAccountAction: 'Create Account',
      signInPrompt: 'Already have an account?',
      pwStrength: 'Password Strength',
      strengthWeak: 'Weak',
      strengthMedium: 'Medium',
      strengthStrong: 'Strong',
      strengthExcellent: 'Excellent',
      ruleUppercase: 'Uppercase Letter',
      ruleLowercase: 'Lowercase Letter',
      ruleNumber: 'Number',
      ruleSpecial: 'Special Character',
      ruleLength: 'Min 8 characters',
      matchCheck: 'Passwords Match',
      showPw: 'Show',
      hidePw: 'Hide',

      // Retailer Dashboard
      totalRequests: 'Total Requests',
      pendingBids: 'Pending Bids',
      acceptedDeals: 'Accepted Deals',
      rejectedBids: 'Rejected Bids',
      createRequestHeader: 'Create Stock Request',
      selectCatalog: 'Select Product Catalog (Optional)',
      customProductName: 'Product Name',
      categoryLabel: 'Category',
      brandLabel: 'Brand',
      quantityLabel: 'Quantity',
      unitLabel: 'Unit',
      urgencyLabel: 'Urgency',
      preferredDate: 'Preferred Date',
      remarksLabel: 'Remarks / Delivery Notes',
      sendRequestBtn: 'Send Stock Request',
      sendingRequestText: 'Sending Request...',
      requestHistoryHeader: 'Request History',
      searchPlaceholder: 'Search by product, brand...',
      allCategories: 'All Categories',
      allStatuses: 'All Statuses',
      newestFirst: 'Newest First',
      oldestFirst: 'Oldest First',
      qtyHighLow: 'Qty (High to Low)',
      qtyLowHigh: 'Qty (Low to High)',
      colProductName: 'Product Name',
      colCategory: 'Category',
      colQtyUnit: 'Qty & Unit',
      colUrgency: 'Urgency',
      colStatus: 'Status',
      colActions: 'Actions',
      urgencyLow: 'low',
      urgencyMedium: 'medium',
      urgencyHigh: 'high',
      statusBidsReceived: 'bids received',
      statusPending: 'pending',
      statusAccepted: 'accepted',
      statusRejected: 'rejected',
      actionCompare: 'Compare Bids',
      showingPage: 'Showing page {page} of {pages} ({total} total requests)',
      prevBtn: 'Previous',
      nextBtn: 'Next',
      emptyRequests: 'No stock requests found. Try resetting filters or submit a new request.',
      
      // Comparison Modal
      modalTitle: 'Stock Request Analysis',
      yourRemarks: 'Your Request Remarks',
      responsesHeader: 'Wholesaler Responses',
      waitingForBids: 'Waiting for bids from local wholesalers.',
      waitingForBidsSub: 'Wholesalers have been notified. We will update you as soon as a bid is placed.',
      fullyAvailable: 'Fully Available',
      partialStock: 'Partial Stock',
      unavailableStock: 'Unavailable',
      offeredStock: 'Offered Stock',
      unitPriceLabel: 'Unit Price',
      deliveryTimeLabel: 'Delivery Time',
      totalQuoteLabel: 'Total Quote',
      dealClosed: '✓ Deal Closed',
      chooseSupplierBtn: 'Choose Supplier',

      // Wholesaler Dashboard
      incomingRequestsHeader: 'Incoming Requests',
      myBidsHeader: 'Your Active Bids',
      colRetailerStore: 'Retailer / Store',
      colPreferredDelivery: 'Preferred Delivery Date',
      submitQuoteAction: 'Submit Quote',
      emptyIncoming: 'No incoming stock requests. We will notify you when a retailer posts one.',
      emptyBids: 'You have not placed any bids yet. Go to Incoming Requests to quote.',
      submitQuoteModalHeader: 'Submit Price Quote',
      requestedQty: 'Qty Requested',
      quoteAvailability: 'Availability',
      quoteQtyOffered: 'Qty Offered',
      quoteUnitPrice: 'Unit Price (₹)',
      quoteDeliveryTime: 'Expected Delivery Time',
      quoteRemarks: 'Remarks / Notes',
      submittingBidText: 'Submitting Bid...',
      submitPriceBidBtn: 'Submit Price Bid',
      fullyAvailableOption: 'Fully Available (In Stock)',
      partialStockOption: 'Partial Stock',
      unavailableOption: 'Unavailable',
      colRequestedQty: 'Requested Qty',
      colYourQuote: 'Your Quote',

      // Common
      confirmTitle: 'Are you sure?',
      confirmAcceptBid: 'Are you sure you want to accept this wholesaler bid? All other bids will be rejected.',
      confirmDelete: 'Are you sure you want to delete this item?'
    }
  };

  t(key, replacements = {}) {
    let text = this.translations.en[key] || key;
    
    // Process string replacements (like {page})
    Object.keys(replacements).forEach(r => {
      text = text.replace(`{${r}}`, replacements[r]);
    });
    return text;
  }
}

export const i18n = new I18nStore();
