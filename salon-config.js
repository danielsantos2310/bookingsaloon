// One currency per salon. Set GBP or EUR and enter service prices in that currency.
// Changing this setting does not convert existing prices or migrate stored data.
window.SALON_CONFIG = Object.freeze({
  locale: 'en-GB',
  timeZone: 'Europe/London',
  currency: 'GBP',
  country: 'United Kingdom',
  // Leave disabled until this project's Supabase service has been resumed.
  backendEnabled: false,
  supabaseUrl: 'https://lvetvfxbjmclbhnqabut.supabase.co',
  supabasePublishableKey: 'sb_publishable_83UkgQz_yLBSYMK6k-tiYw_CigBZxr7'
});

