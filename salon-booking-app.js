var salonConfig = window.SALON_CONFIG || {};
var LOCALE = 'en-GB';
var SALON_TIME_ZONE = 'Europe/London';
var SALON_CURRENCY = salonConfig.currency || 'GBP';
if (['GBP', 'EUR'].indexOf(SALON_CURRENCY) === -1) {
  throw new Error('Salon currency must be GBP or EUR.');
}
var SLOT_INTERVAL = 15;
var LUNCH_BREAK = { start: '13:00', end: '14:00' };
var WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var REPORT_STORAGE_KEY = 'salonMonthlyReports:' + SALON_CURRENCY;
var SUPABASE_ENABLED = salonConfig.backendEnabled === true;
var SUPABASE_URL = salonConfig.supabaseUrl || '';
var SUPABASE_PUBLISHABLE_KEY = salonConfig.supabasePublishableKey || '';
var supabaseSyncReady = false;
var MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
var LONG_DATE_FORMATTER = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
var supabaseClient = null;
var supabaseRealtimeChannel = null;
var adminSession = null;
var adminProfile = null;
var notifiedBookingIds = {};

var services = [
  { id: 1, name: 'Gel manicure', dur: '60 min', price: formatCurrency(90), amount: 90 },
  { id: 2, name: 'Full nail extensions', dur: '90 min', price: formatCurrency(120), amount: 120 },
  { id: 3, name: 'Gel pedicure', dur: '75 min', price: formatCurrency(100), amount: 100 },
  { id: 4, name: 'Nail removal', dur: '30 min', price: formatCurrency(40), amount: 40 }
];

function createRoster(overrides) {
  var base = {
    0: { on: false, open: '09:00', close: '18:00' },
    1: { on: true, open: '09:00', close: '18:00' },
    2: { on: false, open: '10:00', close: '20:00' },
    3: { on: true, open: '10:00', close: '20:00' },
    4: { on: true, open: '09:00', close: '18:00' },
    5: { on: true, open: '09:00', close: '18:00' },
    6: { on: true, open: '09:00', close: '14:00' }
  };

  Object.keys(overrides || {}).forEach(function(key) {
    base[key] = Object.assign({}, base[key], overrides[key]);
  });

  return base;
}

var attendants = [
  { id: 1, name: 'Nail technician 1', serviceIds: [1, 2, 4], roster: createRoster({ 3: { open: '11:00', close: '20:00' } }) },
  { id: 2, name: 'Nail technician 2', serviceIds: [1, 3, 4], roster: createRoster({ 1: { on: false }, 2: { on: true, open: '09:00', close: '17:00' } }) },
  { id: 3, name: 'Nail technician 3', serviceIds: [2, 3], roster: createRoster({ 5: { open: '10:00', close: '19:00' }, 6: { on: false } }) }
];

var blockedDates = [];

var bookings = [];

var auditLog = [];

function getSalonNow() {
  // A wall-clock Date for calendar arithmetic; never use it as a stored instant.
  var parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  var values = {};
  parts.forEach(function(part) { values[part.type] = part.value; });
  return new Date(Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second));
}

function createInitialState() {
  var today = getSalonNow();
  return {
    attendantId: null,
    walkIn: false,
    serviceId: null,
    dateKey: null,
    dateLabel: null,
    time: null,
    pay: 'later',
    currentStep: 1,
    calYear: today.getFullYear(),
    calMonth: today.getMonth()
  };
}

var state = createInitialState();
var currentFilter = 'all';

function getSupabaseClient() {
  if (!SUPABASE_ENABLED || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return null;
  }
  if (supabaseClient || !window.supabase) {
    return supabaseClient;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return supabaseClient;
}

function showConnectionNotice(message) {
  var notice = document.getElementById('connectionNotice');
  if (notice) {
    notice.hidden = false;
    notice.textContent = message;
  }
}

function setOfflinePreview() {
  showConnectionNotice('Studio preview — online booking and owner sign-in are currently offline.');
  document.querySelectorAll('[onclick="submitBooking()"], [onclick="adminLogin()"], [onclick="syncFromSupabase(true)"], [onclick="adminLogout()"], [onclick="requestAdminNotifications()"]').forEach(function(button) {
    button.disabled = true;
    button.setAttribute('aria-describedby', 'connectionNotice');
  });
  var status = document.getElementById('adminSessionStatus');
  if (status) status.textContent = 'Offline preview';
}

function hasAdminSession() {
  return !!(adminSession && adminProfile && adminProfile.role === 'admin');
}

function requireAdminSession() {
  if (!hasAdminSession()) {
    showToast('Sign in as the owner to make changes.');
    return false;
  }
  return true;
}

function normalizeTimeString(value) {
  return value ? String(value).slice(0, 5) : '';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mapServiceFromDb(row) {
  var defaultNames = {
    'Manicure em gel': 'Gel manicure',
    'Alongamento completo': 'Full nail extensions',
    'Pedicure + gel': 'Gel pedicure',
    'Remoção de unhas': 'Nail removal'
  };
  return {
    id: Number(row.id),
    name: defaultNames[row.name] || row.name,
    dur: row.duration_minutes + ' min',
    price: formatCurrency(Number(row.price_cents || 0) / 100),
    amount: Number(row.price_cents || 0) / 100
  };
}

function updateAdminSessionStatus() {
  var el = document.getElementById('adminSessionStatus');
  if (!el) {
    return;
  }
  el.textContent = hasAdminSession() ? 'Owner signed in: ' + (adminProfile.email || 'no email') : 'Not signed in';
  if (typeof updateAdminAccessState === 'function') {
    updateAdminAccessState();
  }
}

function updateNotificationStatus() {
  var el = document.getElementById('notificationStatus');
  if (!el) {
    return;
  }
  if (!('Notification' in window)) {
    el.textContent = 'Notifications: unavailable';
    return;
  }
  var label = Notification.permission === 'granted'
    ? 'Notifications: on'
    : Notification.permission === 'denied'
      ? 'Notifications: blocked'
      : 'Notifications: off';
  el.textContent = label;
}

async function requestAdminNotifications() {
  if (!('Notification' in window)) {
    showToast('This browser does not support notifications.');
    updateNotificationStatus();
    return;
  }
  var permission = await Notification.requestPermission();
  updateNotificationStatus();
  if (permission === 'granted') {
    showToast('Browser notifications enabled.');
    return;
  }
  if (permission === 'denied') {
    showToast('Notifications are blocked in your browser settings.');
    return;
  }
  showToast('Notifications were not enabled.');
}

function notifyNewBookingFromPayload(payload) {
  if (!hasAdminSession() || !isAdminOnlyPage()) {
    return;
  }
  if (!payload || !payload.new || !payload.new.id) {
    return;
  }
  var bookingId = String(payload.new.id);
  if (notifiedBookingIds[bookingId]) {
    return;
  }
  notifiedBookingIds[bookingId] = true;

  var title = 'Novo agendamento recebido';
  var message = normalizeTimeString(payload.new.start_time) + ' • ' + formatDateKey(payload.new.booking_date);
  showToast(title + ': ' + message);

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    var body = 'Time ' + normalizeTimeString(payload.new.start_time) + ' on ' + formatDateKey(payload.new.booking_date);
    var notification = new Notification(title, {
      body: body,
      tag: 'booking-' + bookingId
    });
    notification.onclick = function() {
      window.focus();
      switchAdmin('requests');
    };
  } catch (error) {
    showToast('Unable to show the browser notification.');
  }
}

async function loadAdminProfile() {
  var client = getSupabaseClient();
  if (!client) {
    return null;
  }

  var sessionResult = await client.auth.getSession();
  adminSession = sessionResult.data.session || null;
  if (!adminSession) {
    adminProfile = null;
    updateAdminSessionStatus();
    return null;
  }

  var profileResult = await client.from('profiles').select('id, email, role').eq('id', adminSession.user.id).maybeSingle();
  if (profileResult.error) {
    adminProfile = null;
    updateAdminSessionStatus();
    throw new Error(profileResult.error.message || 'Unable to read the owner profile.');
  }
  adminProfile = profileResult.data || null;
  updateAdminSessionStatus();
  return adminProfile;
}

function hydrateAttendantsFromSupabase(rows, relationRows, rosterRows) {
  return rows.map(function(attendant) {
    var serviceIds = relationRows.filter(function(rel) {
      return Number(rel.attendant_id) === Number(attendant.id);
    }).map(function(rel) {
      return Number(rel.service_id);
    });

    var roster = createRoster();
    rosterRows.filter(function(item) {
      return Number(item.attendant_id) === Number(attendant.id);
    }).forEach(function(item) {
      roster[item.weekday] = {
        on: !!item.is_working,
        open: item.open_time ? normalizeTimeString(item.open_time) : '09:00',
        close: item.close_time ? normalizeTimeString(item.close_time) : '18:00'
      };
    });

    return {
      id: Number(attendant.id),
      name: attendant.name,
      active: attendant.active !== false,
      serviceIds: serviceIds,
      roster: roster
    };
  });
}

function mapBookingFromDb(row) {
  return {
    id: Number(row.id),
    name: row.client_name,
    serviceId: Number(row.service_id),
    dateKey: row.booking_date,
    date: formatDateKey(row.booking_date),
    time: normalizeTimeString(row.start_time),
    phone: row.client_phone || '',
    email: row.client_email || '',
    status: row.status,
    payMethod: row.payment_method,
    payStatus: row.payment_status,
    attendantId: Number(row.attendant_id)
  };
}

function mapBookingSlotFromDb(row) {
  return {
    id: Number(row.id),
    name: 'Reservado',
    serviceId: Number(row.service_id),
    dateKey: row.booking_date,
    date: formatDateKey(row.booking_date),
    time: normalizeTimeString(row.start_time),
    phone: '',
    email: '',
    status: row.status,
    payMethod: 'pix',
    payStatus: row.payment_status || 'unpaid',
    attendantId: Number(row.attendant_id)
  };
}

async function syncFromSupabase(silent) {
  var client = getSupabaseClient();
  if (!client) {
    if (!silent) {
      showToast('The booking connection is unavailable. Reload and try again.');
    }
    return false;
  }

  try {
    await loadAdminProfile();

    var publicResults = await Promise.all([
      client.from('services').select('id, name, duration_minutes, price_cents, active').order('id'),
      client.from('attendants').select('id, name, active').order('id'),
      client.from('attendant_services').select('attendant_id, service_id'),
      client.from('rosters').select('attendant_id, weekday, is_working, open_time, close_time'),
      client.from('blocked_dates').select('id, blocked_date, reason').order('blocked_date')
    ]);

    if (publicResults.some(function(result) { return result.error; })) {
      throw new Error(publicResults.map(function(result) { return result.error && result.error.message; }).filter(Boolean).join(' | '));
    }

    services = publicResults[0].data.map(mapServiceFromDb);
    attendants = hydrateAttendantsFromSupabase(publicResults[1].data, publicResults[2].data, publicResults[3].data);
    blockedDates = publicResults[4].data.map(function(item) {
      return { id: Number(item.id), date: item.blocked_date, reason: item.reason || 'Unavailable' };
    });

    if (hasAdminSession()) {
      var bookingsResult = await client.from('bookings').select('id, client_name, client_phone, client_email, service_id, attendant_id, booking_date, start_time, end_time, status, payment_method, payment_status, created_at').order('booking_date').order('start_time');
      if (!bookingsResult.error) {
        bookings = bookingsResult.data.map(mapBookingFromDb);
      }
      var reportsResult = await client.from('monthly_reports').select('month_key, snapshot_json, created_at').order('month_key', { ascending: false });
      if (!reportsResult.error) {
        setStoredMonthlyReports(reportsResult.data.map(function(item) {
          return Object.assign({}, item.snapshot_json, {
            monthKey: item.month_key,
            createdAt: item.created_at || item.snapshot_json.createdAt
          });
        }));
      }
    } else {
      var publicBookingsResult = await client.from('booking_public_slots').select('id, service_id, attendant_id, booking_date, start_time, end_time, status, payment_status, created_at').order('booking_date').order('start_time');
      if (publicBookingsResult.error) throw publicBookingsResult.error;
      bookings = publicBookingsResult.data.map(mapBookingSlotFromDb);
    }

    renderClientAttendants();
    renderServiceList();
    updateClientAttendantSummary();
    renderCalendar();
    renderServiceAdmin();
    renderAttendantsAdmin();
    renderBlocked();
    renderBookings(currentFilter);
    renderHistoryBookings(currentHistoryFilter);
    renderRanking();
    renderRevenueCards();
    updatePendingCount();
    renderReportArchive();

    if (!silent) {
      showToast('Salon data refreshed.');
    }
    supabaseSyncReady = true;
    return true;
  } catch (error) {
    supabaseSyncReady = false;
    if (!silent) {
      showToast('Unable to refresh salon data. Please try again.');
    }
    return false;
  }
}

async function adminLogin() {
  var client = getSupabaseClient();
  if (!client) {
    showToast('The booking connection is unavailable. Reload and try again.');
    return;
  }

  var email = document.getElementById('adminEmail').value.trim();
  var password = document.getElementById('adminPassword').value;
  if (!email || !password) {
    showToast('Enter your owner email and password.');
    return;
  }

  var result = await client.auth.signInWithPassword({ email: email, password: password });
  if (result.error) {
    showToast('Unable to sign in: ' + result.error.message);
    return;
  }

  try {
    await loadAdminProfile();
  } catch (error) {
    showToast('Signed in, but unable to load your owner profile: ' + error.message);
    return;
  }
  if (!hasAdminSession()) {
    showToast('This account does not have owner access.');
    return;
  }

  await syncFromSupabase(true);
  switchAdmin('dash');
  subscribeToSupabase();
  showToast('You are signed in as the owner.');
}

async function adminLogout() {
  var client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
  adminSession = null;
  adminProfile = null;
  updateAdminSessionStatus();
  switchAdmin('dash');
  showToast('You have signed out.');
}

function subscribeToSupabase() {
  var client = getSupabaseClient();
  if (!client || !supabaseSyncReady || supabaseRealtimeChannel) {
    return;
  }

  supabaseRealtimeChannel = client.channel('salon-live-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, function(payload) {
      if (payload && payload.eventType === 'INSERT') {
        notifyNewBookingFromPayload(payload);
      }
      syncFromSupabase(true);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, function() { syncFromSupabase(true); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendants' }, function() { syncFromSupabase(true); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendant_services' }, function() { syncFromSupabase(true); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rosters' }, function() { syncFromSupabase(true); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_dates' }, function() { syncFromSupabase(true); })
    .subscribe(function(status) {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        var failedChannel = supabaseRealtimeChannel;
        supabaseRealtimeChannel = null;
        if (failedChannel) Promise.resolve(client.removeChannel(failedChannel)).catch(function() {});
        showConnectionNotice('Live updates are unavailable. Use Refresh data to check for changes.');
      }
    });
}

function formatMonthYear(year, month) {
  return MONTH_YEAR_FORMATTER.format(new Date(year, month, 1));
}

function formatLongDate(date) {
  return LONG_DATE_FORMATTER.format(date);
}

function getDateKey(year, month, day) {
  return [String(year), String(month + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function parseDateKey(dateKey) {
  var parts = dateKey.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateKey(dateKey) {
  return formatLongDate(parseDateKey(dateKey));
}

function formatCurrency(amount) {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency', currency: SALON_CURRENCY,
    minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatMonthKeyLabel(monthKey) {
  if (!monthKey) {
    return '';
  }
  var parts = monthKey.split('-').map(Number);
  return formatMonthYear(parts[0], parts[1] - 1);
}

function parseTimeToMinutes(value) {
  var parts = value.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

function formatMinutesAsTime(totalMinutes) {
  var hours = Math.floor(totalMinutes / 60);
  var minutes = totalMinutes % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

function parseDurationToMinutes(label) {
  return Number(label.replace(/[^\d]/g, '')) || 0;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function getBreakIntervals() {
  return [{ start: parseTimeToMinutes(LUNCH_BREAK.start), end: parseTimeToMinutes(LUNCH_BREAK.end) }];
}

function getServiceById(id) {
  return services.find(function(service) {
    return service.id === id;
  }) || null;
}

function getAttendantById(id) {
  return attendants.find(function(attendant) {
    return attendant.id === id;
  }) || null;
}

function getSelectedService() {
  return getServiceById(state.serviceId);
}

function getSelectedAttendant() {
  return getAttendantById(state.attendantId);
}

function hasSelectedAttendantMode() {
  return state.walkIn || !!state.attendantId;
}

function getAttendantName(id) {
  var attendant = getAttendantById(id);
  return attendant ? attendant.name : 'Staff member not assigned';
}

function getBookingService(booking) {
  return getServiceById(booking.serviceId);
}

function getBookingAmount(booking) {
  var service = getBookingService(booking);
  return service ? service.amount : 0;
}

function getMonthKeyFromDateKey(dateKey) {
  return dateKey ? dateKey.slice(0, 7) : '';
}

function getServicesForAttendant(attendantId) {
  var attendant = getAttendantById(attendantId);
  if (!attendant) {
    return [];
  }

  return services.filter(function(service) {
    return attendant.serviceIds.includes(service.id);
  });
}

function getWalkInServices() {
  return services.filter(function(service) {
    return attendants.some(function(attendant) {
      return attendant.serviceIds.includes(service.id);
    });
  });
}

function getEligibleAttendantsForService(serviceId) {
  return attendants.filter(function(attendant) {
    return attendant.serviceIds.includes(serviceId);
  });
}

function getAttendantsForService(serviceId) {
  return getEligibleAttendantsForService(serviceId);
}

function getRosterForAttendant(attendantId, dayIndex) {
  var attendant = getAttendantById(attendantId);
  if (!attendant) {
    return null;
  }
  return attendant.roster[dayIndex] || null;
}

function getBookingsForDateAndAttendant(dateKey, attendantId) {
  return bookings.filter(function(booking) {
    return booking.dateKey === dateKey && booking.attendantId === attendantId && booking.status !== 'declined';
  });
}

function isBlockedDate(year, month, day) {
  var dateKey = getDateKey(year, month, day);
  return blockedDates.some(function(blocked) {
    return blocked.date === dateKey;
  });
}

function isAttendantWorking(attendantId, dayIndex) {
  var roster = getRosterForAttendant(attendantId, dayIndex);
  return !!(roster && roster.on);
}

function isAttendantBusy(attendantId, dateKey, startMinutes, endMinutes) {
  return getBookingsForDateAndAttendant(dateKey, attendantId).some(function(booking) {
    var service = getBookingService(booking);
    if (!service) {
      return false;
    }
    var bookingStart = parseTimeToMinutes(booking.time);
    var bookingEnd = bookingStart + parseDurationToMinutes(service.dur);
    return rangesOverlap(startMinutes, endMinutes, bookingStart, bookingEnd);
  });
}

function getSlotAvailability(dateKey, dayIndex, attendantId, serviceId, startMinutes) {
  var roster = getRosterForAttendant(attendantId, dayIndex);
  var service = getServiceById(serviceId);

  if (!roster || !roster.on || !service) {
    return false;
  }

  var durationMinutes = parseDurationToMinutes(service.dur);
  var endMinutes = startMinutes + durationMinutes;

  if (endMinutes > parseTimeToMinutes(roster.close) || startMinutes < parseTimeToMinutes(roster.open)) {
    return false;
  }

  var overlapsBreak = getBreakIntervals().some(function(interval) {
    return rangesOverlap(startMinutes, endMinutes, interval.start, interval.end);
  });

  if (overlapsBreak) {
    return false;
  }

  return !isAttendantBusy(attendantId, dateKey, startMinutes, endMinutes);
}

function getAvailableAttendantsForSlot(dateKey, dayIndex, serviceId, startMinutes) {
  return getEligibleAttendantsForService(serviceId).filter(function(attendant) {
    return getSlotAvailability(dateKey, dayIndex, attendant.id, serviceId, startMinutes);
  });
}

function switchView(view, button) {
  document.querySelectorAll('.view').forEach(function(el) {
    el.classList.remove('active');
  });
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-pill').forEach(function(el) {
    el.classList.remove('active');
  });
  if (button) {
    button.classList.add('active');
  }
  if (view === 'admin') {
    renderAdmin();
  }
}

function renderClientAttendants() {
  var grid = document.getElementById('clientAttendantGrid');
  grid.innerHTML = '';

  var walkInCard = document.createElement('button');
  walkInCard.type = 'button';
  walkInCard.className = 'attendant-card' + (state.walkIn ? ' selected' : '');
  walkInCard.setAttribute('aria-pressed', String(state.walkIn));
  walkInCard.innerHTML = '<span class="technician-mark" aria-hidden="true">✳</span><div class="attendant-name">Anyone available</div><div class="attendant-meta">Find my perfect match</div>';
  walkInCard.onclick = function() {
    state.walkIn = true;
    state.attendantId = null;
    state.serviceId = null;
    state.dateKey = null;
    state.dateLabel = null;
    state.time = null;
    renderClientAttendants();
    renderServiceList();
    updateClientAttendantSummary();
    updateSelectedSlotSummary();
  };
  grid.appendChild(walkInCard);

  attendants.forEach(function(attendant) {
    var serviceCount = getServicesForAttendant(attendant.id).length;
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'attendant-card' + (!state.walkIn && state.attendantId === attendant.id ? ' selected' : '');
    card.innerHTML = '<div class="attendant-name">' + attendant.name + '</div><div class="attendant-meta">' + serviceCount + ' assigned service(s)</div>';
    card.onclick = function() {
      state.walkIn = false;
      state.attendantId = attendant.id;
      state.serviceId = null;
      state.dateKey = null;
      state.dateLabel = null;
      state.time = null;
      renderClientAttendants();
      renderServiceList();
      updateClientAttendantSummary();
      updateSelectedSlotSummary();
    };
    grid.appendChild(card);
  });
}

function updateClientAttendantSummary() {
  var summary = document.getElementById('clientAttendantSummary');
  var attendant = getSelectedAttendant();
  if (!summary) {
    return;
  }
  summary.textContent = state.walkIn
    ? 'Any available staff member selected. Choose a service and an available time.'
    : attendant
      ? 'Selected staff member: ' + attendant.name + '. The services below are offered by this staff member.'
      : 'No staff member selected.';
}

function renderServiceList() {
  var list = document.getElementById('serviceList');
  list.innerHTML = '';

  if (!hasSelectedAttendantMode()) {
    list.innerHTML = '<div class="lgpd-note">Choose a staff member first to see their services.</div>';
    return;
  }

  var allowedServices = state.walkIn ? getWalkInServices() : getServicesForAttendant(state.attendantId);
  if (!allowedServices.length) {
    list.innerHTML = '<div class="lgpd-note">' + (state.walkIn ? 'No services have been assigned to staff yet.' : 'This staff member has no assigned services yet.') + '</div>';
    return;
  }

  allowedServices.forEach(function(service) {
    var card = document.createElement('button');
    card.type = 'button';
    card.setAttribute('aria-pressed', String(state.serviceId === service.id));
    card.className = 'svc-item' + (state.serviceId === service.id ? ' selected' : '');
    card.onclick = function() {
      selectService(service.id);
    };
    card.innerHTML = '<div class="svc-dot"></div><div class="svc-info"><div class="svc-name">' + service.name + '</div><div class="svc-dur">' + service.dur + '</div></div><div class="svc-price">' + service.price.replace(',00', '') + '</div>';
    list.appendChild(card);
  });
}

function selectService(serviceId) {
  state.serviceId = serviceId;
  state.dateKey = null;
  state.dateLabel = null;
  state.time = null;
  var service = getServiceById(serviceId);
  renderServiceList();
  updateSelectedSlotSummary();
}

function validateClientDetails() {
  var name = document.getElementById('clientName').value.trim();
  var phone = document.getElementById('clientPhone').value.trim();
  var email = document.getElementById('clientEmail').value.trim();
  if (!name || !phone || !email) {
    showToast('Enter your name, phone number and email to continue.');
    return false;
  }
  return true;
}

function goStep(stepNumber) {
  if (stepNumber === 2 && !hasSelectedAttendantMode()) {
    showToast('Choose a staff member or anyone available to continue.');
    return;
  }
  if (stepNumber === 3 && (!hasSelectedAttendantMode() || !state.serviceId)) {
    showToast('Choose a staff member or anyone available, then choose a service.');
    return;
  }
  if (stepNumber === 4 && (!state.dateKey || !state.time)) {
    showToast('Choose a date and time to continue.');
    return;
  }
  if (stepNumber === 5 && !validateClientDetails()) {
    return;
  }

  var current = document.getElementById('step' + state.currentStep);
  if (current) {
    current.style.display = 'none';
  }

  state.currentStep = stepNumber;
  var next = document.getElementById('step' + stepNumber);
  next.style.display = 'block';
  next.classList.remove('fade-in');
  void next.offsetWidth;
  next.classList.add('fade-in');

  updateStepBar(stepNumber);
  updateClientAttendantSummary();
  updateSelectedSlotSummary();

  if (stepNumber === 3) {
    renderCalendar();
  }
}

function updateStepBar(stepNumber) {
  for (var i = 1; i <= 5; i += 1) {
    var segment = document.getElementById('seg' + i);
    segment.className = 'step-seg';
    segment.removeAttribute('aria-current');
    if (i < stepNumber) {
      segment.classList.add('done');
    }
    if (i === stepNumber) {
      segment.classList.add('active');
      segment.setAttribute('aria-current', 'step');
    }
  }
}

function renderCalendar() {
  var monthEl = document.getElementById('calMonth');
  var grid = document.getElementById('dayGrid');
  if (!monthEl || !grid) {
    return;
  }
  monthEl.textContent = formatMonthYear(state.calYear, state.calMonth);
  grid.innerHTML = '';
  var firstDay = new Date(state.calYear, state.calMonth, 1).getDay();
  var daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();
  var today = getSalonNow();
  today.setHours(0, 0, 0, 0);

  for (var i = 0; i < firstDay; i += 1) {
    var empty = document.createElement('div');
    empty.className = 'day-cell empty';
    grid.appendChild(empty);
  }

  for (var day = 1; day <= daysInMonth; day += 1) {
    var date = new Date(state.calYear, state.calMonth, day);
    var dateKey = getDateKey(state.calYear, state.calMonth, day);
    var dayIndex = date.getDay();
    var cell = document.createElement('button');
    cell.type = 'button';
    cell.setAttribute('aria-label', formatDateKey(dateKey));
    cell.className = 'day-cell';
    cell.textContent = day;

    var isPast = date < today;
    var blocked = isBlockedDate(state.calYear, state.calMonth, day);
    var working = false;
    if (state.walkIn && state.serviceId) {
      working = getEligibleAttendantsForService(state.serviceId).some(function(attendant) {
        return isAttendantWorking(attendant.id, dayIndex);
      });
    } else if (state.attendantId) {
      working = isAttendantWorking(state.attendantId, dayIndex);
    }

    if (isPast || blocked || !working) {
      cell.classList.add('unavail');
      cell.disabled = true;
    } else {
      (function(selectedDay, selectedIndex, selectedKey) {
        cell.onclick = function() {
          selectDay(this, selectedDay, selectedIndex, selectedKey);
        };
      })(day, dayIndex, dateKey);
    }

    if (state.dateKey === dateKey) {
      cell.classList.add('selected');
    }
    if (date.getTime() === today.getTime()) {
      cell.classList.add('today');
    }
    grid.appendChild(cell);
  }
}

function changeMonth(direction) {
  state.calMonth += direction;
  if (state.calMonth > 11) {
    state.calMonth = 0;
    state.calYear += 1;
  }
  if (state.calMonth < 0) {
    state.calMonth = 11;
    state.calYear -= 1;
  }
  state.dateKey = null;
  state.dateLabel = null;
  state.time = null;
  var timePicker = document.getElementById('timePicker');
  if (timePicker) {
    timePicker.style.display = 'none';
  }
  renderCalendar();
}

function selectDay(el, day, dayIndex, dateKey) {
  document.querySelectorAll('.day-cell').forEach(function(cell) {
    cell.classList.remove('selected');
  });
  el.classList.add('selected');
  state.dateKey = dateKey;
  state.dateLabel = formatLongDate(new Date(state.calYear, state.calMonth, day));
  state.time = null;
  renderTimes(dayIndex);
  document.getElementById('timePicker').style.display = 'block';
  updateSelectedSlotSummary();
}

function renderTimes(dayIndex) {
  var grid = document.getElementById('timeGrid');
  var hint = document.getElementById('slotHint');
  var attendant = getSelectedAttendant();
  var service = getSelectedService();
  grid.innerHTML = '';

  if ((!attendant && !state.walkIn) || !service || !state.dateKey) {
    hint.textContent = 'Choose a staff member, service and date.';
    return;
  }

  var durationMinutes = parseDurationToMinutes(service.dur);
  var startMinutes;
  var closeMinutes;

  if (state.walkIn) {
    var eligible = getEligibleAttendantsForService(service.id).filter(function(item) {
      return isAttendantWorking(item.id, dayIndex);
    });
    if (!eligible.length) {
      hint.textContent = 'No qualified staff are working on this day.';
      return;
    }
    startMinutes = Math.min.apply(null, eligible.map(function(item) {
      return parseTimeToMinutes(getRosterForAttendant(item.id, dayIndex).open);
    }));
    closeMinutes = Math.max.apply(null, eligible.map(function(item) {
      return parseTimeToMinutes(getRosterForAttendant(item.id, dayIndex).close);
    }));
    hint.textContent = 'Times are shown when a qualified staff member is available for ' + service.name + '.';
  } else {
    var roster = getRosterForAttendant(attendant.id, dayIndex);
    if (!roster || !roster.on) {
      hint.textContent = attendant.name + ' is not working on this day.';
      return;
    }
    hint.textContent = attendant.name + ' is working from ' + roster.open + ' to ' + roster.close + '. Service duration: ' + service.dur + '.';
    startMinutes = parseTimeToMinutes(roster.open);
    closeMinutes = parseTimeToMinutes(roster.close);
  }

  for (var minute = startMinutes; minute + durationMinutes <= closeMinutes; minute += SLOT_INTERVAL) {
    var availableAttendants = state.walkIn
      ? getAvailableAttendantsForSlot(state.dateKey, dayIndex, service.id, minute)
      : (getSlotAvailability(state.dateKey, dayIndex, attendant.id, service.id, minute) ? [attendant] : []);
    var cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'time-slot';
    cell.innerHTML = formatMinutesAsTime(minute);

    if (!availableAttendants.length) {
      cell.disabled = true;
      cell.classList.add('unavail');
      cell.innerHTML += '<small>Unavailable</small>';
    } else {
      cell.innerHTML += '<small>' + (state.walkIn ? availableAttendants.length + ' available' : 'available') + '</small>';
      (function(timeLabel) {
        cell.onclick = function() {
          document.querySelectorAll('.time-slot').forEach(function(slot) {
            slot.classList.remove('selected');
          });
          this.classList.add('selected');
          state.time = timeLabel;
          updateSelectedSlotSummary();
        };
      })(formatMinutesAsTime(minute));
    }

    if (state.time === formatMinutesAsTime(minute)) {
      cell.classList.add('selected');
    }
    grid.appendChild(cell);
  }
}

function updateSelectedSlotSummary() {
  var summary = document.getElementById('selectedSlotSummary');
  if (!summary) {
    return;
  }

  var attendant = getSelectedAttendant();
  var service = getSelectedService();
  if ((!attendant && !state.walkIn) || !service || !state.dateLabel || !state.time) {
    summary.textContent = 'Choose a time to see your booking summary.';
    return;
  }

  summary.textContent = 'Summary: ' + (state.walkIn ? 'Any available staff member' : attendant.name) + ' • ' + service.name + ' • ' + state.dateLabel + ' to ' + state.time + '.';
}

function selectPay(type) {
  state.pay = 'later';
  var payLater = document.getElementById('pay-later');
  if (payLater) payLater.classList.add('selected');
}

function copyPix() {
  var pixKey = '12.345.678/0001-99';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(pixKey).then(function() {
      showToast('Payment reference copied.');
    }).catch(function() {
      showToast('Unable to copy the payment reference.');
    });
    return;
  }
  showToast('Copy the payment reference shown on screen.');
}

var bookingSubmitting = false;
async function submitBooking() {
  if (bookingSubmitting) return;
  if (!getSupabaseClient()) {
    showToast('Booking is temporarily unavailable. Please contact the salon or try again later.');
    return;
  }
  var button = document.querySelector('[onclick="submitBooking()"]');
  bookingSubmitting = true;
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  try {
    await persistBooking();
  } catch (error) {
    showToast('Unable to send your booking. Your details have been kept. Please try again.');
  } finally {
    bookingSubmitting = false;
    if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
  }
}

async function persistBooking() {
  if ((!state.attendantId && !state.walkIn) || !state.serviceId || !state.dateKey || !state.time) {
    showToast('Choose a staff member, service, date and time before submitting.');
    return;
  }
  if (!validateClientDetails()) {
    return;
  }

  var service = getSelectedService();
  var dayIndex = parseDateKey(state.dateKey).getDay();
  var startMinutes = parseTimeToMinutes(state.time);
  var attendant = getSelectedAttendant();

  if (state.walkIn) {
    var walkInCandidates = getAvailableAttendantsForSlot(state.dateKey, dayIndex, service.id, startMinutes);
    attendant = walkInCandidates[0] || null;
  }

  if (!attendant || !getSlotAvailability(state.dateKey, dayIndex, attendant.id, service.id, startMinutes)) {
      showToast('That time was just taken. Choose another time.');
      renderTimes(dayIndex);
      return;
  }

  var newBooking = {
    id: bookings.length + 100,
    name: document.getElementById('clientName').value.trim(),
    serviceId: service.id,
    dateKey: state.dateKey,
    date: state.dateLabel,
    time: state.time,
    phone: document.getElementById('clientPhone').value.trim(),
    email: document.getElementById('clientEmail').value.trim(),
    status: 'pending',
      payMethod: state.pay,
      payStatus: state.pay === 'pix' ? 'waiting_check' : 'unpaid',
      attendantId: attendant.id
  };

    var client = getSupabaseClient();
    if (client) {
      var insertResult = await client.from('bookings').insert({
        client_name: newBooking.name,
        client_phone: newBooking.phone,
        client_email: newBooking.email,
        service_id: newBooking.serviceId,
        attendant_id: newBooking.attendantId,
        booking_date: newBooking.dateKey,
        start_time: newBooking.time + ':00',
        end_time: formatMinutesAsTime(parseTimeToMinutes(newBooking.time) + parseDurationToMinutes(service.dur)) + ':00',
        status: newBooking.status,
        payment_method: newBooking.payMethod,
        payment_status: newBooking.payStatus
      });

      if (insertResult.error) {
        showToast('Unable to save your booking: ' + insertResult.error.message);
        return;
      }
    }

    bookings.unshift(newBooking);
  auditLog.unshift({
    dot: '',
    time: 'Just now',
    text: 'New booking request from <strong>' + newBooking.name + '</strong> with ' + attendant.name
  });

  document.getElementById('cf-attendant').textContent = attendant.name;
  document.getElementById('cf-service').textContent = service.name;
  document.getElementById('cf-date').textContent = state.dateLabel;
  document.getElementById('cf-time').textContent = state.time;
  document.getElementById('cf-price').textContent = service.price;
  document.getElementById('cf-pay').textContent = state.pay === 'pix' ? 'Legacy payment awaiting review' : 'Pay in salon';

  var current = document.getElementById('step' + state.currentStep);
  current.style.display = 'none';
  state.currentStep = 6;
  document.getElementById('step6').style.display = 'block';
    updateStepBar(5);
    updatePendingCount();
    renderRanking();
    renderRevenueCards();
    if (client) {
      syncFromSupabase(true);
    }
  }

function resetBooking() {
  document.querySelectorAll('.step-card').forEach(function(card) { card.style.display = 'none'; });
  state = createInitialState();
  document.getElementById('clientName').value = '';
  document.getElementById('clientPhone').value = '';
  document.getElementById('clientEmail').value = '';
  document.getElementById('timePicker').style.display = 'none';
  renderClientAttendants();
  renderServiceList();
  updateClientAttendantSummary();
  updateSelectedSlotSummary();
  selectPay('later');
  goStep(1);
}

(function buildQR() {
  var pattern = [1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0];
  var grid = document.getElementById('qrGrid');
  if (!grid) {
    return;
  }
  pattern.forEach(function(value) {
    var cell = document.createElement('div');
    cell.className = 'qr-cell' + (value ? ' dark' : '');
    grid.appendChild(cell);
  });
})();

function switchAdmin(panel) {
  document.querySelectorAll('.admin-panel').forEach(function(item) {
    item.classList.remove('active');
  });
  document.querySelectorAll('.sidebar-link').forEach(function(item) {
    item.classList.remove('active');
  });
  document.getElementById('panel-' + panel).classList.add('active');
  document.getElementById('sl-' + panel).classList.add('active');

  if (panel === 'requests') {
    renderBookings(currentFilter);
  }
  if (panel === 'avail') {
    renderServiceAdmin();
    renderAttendantsAdmin();
    renderBlocked();
  }
  if (panel === 'audit') {
    renderAudit();
  }
}

function renderAdmin() {
  updatePendingCount();
  renderRanking();
  renderRevenueCards();
  setReportMonthDefault();
  renderReportArchive();
}

function updatePendingCount() {
  var pending = bookings.filter(function(booking) {
    return booking.status === 'pending';
  }).length;
  var pendingPayments = bookings.filter(function(booking) {
    return booking.payStatus !== 'paid' && booking.status !== 'declined';
  }).length;
  document.getElementById('pending-badge').textContent = pending;
  document.getElementById('dash-pending').textContent = pending;
  document.getElementById('dash-pix').textContent = pendingPayments;
}

function renderRanking() {
  var container = document.getElementById('rankingList');
  if (!container) {
    return;
  }

  var counts = services.map(function(service) {
    return {
      service: service,
      count: bookings.filter(function(booking) {
        return booking.serviceId === service.id && booking.status !== 'declined';
      }).length
    };
  }).sort(function(a, b) {
    return b.count - a.count;
  });

  var max = counts.length ? Math.max.apply(null, counts.map(function(item) { return item.count; })) || 1 : 1;
  container.innerHTML = counts.map(function(item) {
    var extraStyle = item === counts[counts.length - 1] ? ' style="margin-bottom:0;"' : '';
    return '<div class="rank-item"' + extraStyle + '>' +
      '<div class="rank-row"><span class="rank-name">' + item.service.name + '</span><span class="rank-count">' + item.count + ' agendamentos</span></div>' +
      '<div class="rank-bar-bg"><div class="rank-bar" style="width:' + ((item.count / max) * 100) + '%"></div></div>' +
    '</div>';
    }).join('');
}

function getDashboardReferenceDate() {
  return getSalonNow();
}

function getDefaultReportMonth() {
  return getMonthKeyFromDateKey(getDashboardReferenceDate().toISOString().slice(0, 10));
}

function getStoredMonthlyReports() {
  try {
    var raw = localStorage.getItem(REPORT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function setStoredMonthlyReports(items) {
  try {
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    showToast('Unable to save the monthly archive in this browser.');
  }
}

function getSelectedReportMonth() {
  var input = document.getElementById('reportMonth');
  return input && input.value ? input.value : getDefaultReportMonth();
}

function buildMonthlyReport(monthKey) {
  var monthlyBookings = bookings.filter(function(booking) {
    return getMonthKeyFromDateKey(booking.dateKey) === monthKey;
  });
  var paidBookings = monthlyBookings.filter(function(booking) {
    return booking.payStatus === 'paid' && booking.status !== 'declined';
  });
  var pendingBookings = monthlyBookings.filter(function(booking) {
    return booking.payStatus !== 'paid' && booking.status !== 'declined';
  });
  var totalRevenue = paidBookings.reduce(function(total, booking) {
    return total + getBookingAmount(booking);
  }, 0);

  var byService = services.map(function(service) {
    return {
      name: service.name,
      count: monthlyBookings.filter(function(booking) {
        return booking.serviceId === service.id && booking.status !== 'declined';
      }).length,
      revenue: paidBookings.filter(function(booking) {
        return booking.serviceId === service.id;
      }).reduce(function(total, booking) {
        return total + getBookingAmount(booking);
      }, 0)
    };
  }).filter(function(item) {
    return item.count > 0 || item.revenue > 0;
  });

  var byAttendant = attendants.map(function(attendant) {
    return {
      name: attendant.name,
      count: monthlyBookings.filter(function(booking) {
        return booking.attendantId === attendant.id && booking.status !== 'declined';
      }).length,
      revenue: paidBookings.filter(function(booking) {
        return booking.attendantId === attendant.id;
      }).reduce(function(total, booking) {
        return total + getBookingAmount(booking);
      }, 0)
    };
  }).filter(function(item) {
    return item.count > 0 || item.revenue > 0;
  });

  return {
    monthKey: monthKey,
    monthLabel: formatMonthKeyLabel(monthKey),
    createdAt: new Date().toISOString(),
    totals: {
      bookings: monthlyBookings.filter(function(booking) { return booking.status !== 'declined'; }).length,
      paid: paidBookings.length,
      pending: pendingBookings.length,
      revenue: totalRevenue
    },
    byService: byService,
    byAttendant: byAttendant,
    bookings: monthlyBookings.map(function(booking) {
      var service = getBookingService(booking);
      return {
        id: booking.id,
        client: booking.name,
        date: booking.date,
        time: booking.time,
        attendant: getAttendantName(booking.attendantId),
        service: service ? service.name : 'Removed service',
        amount: getBookingAmount(booking),
        priceLabel: service ? service.price : '£0,00',
        payLabel: booking.payStatus === 'paid' ? 'Paid' : (booking.payMethod === 'pix' ? 'Legacy payment pending' : 'Pay in salon'),
        statusLabel: booking.status === 'accepted' ? 'Confirmed' : booking.status === 'declined' ? 'Declined' : 'Pending'
      };
    })
  };
}

function getReportHtml(report) {
  var bookingRows = report.bookings.length
    ? report.bookings.map(function(booking) {
        return '<tr><td>' + booking.date + '</td><td>' + booking.time + '</td><td>' + booking.client + '</td><td>' + booking.attendant + '</td><td>' + booking.service + '</td><td>' + booking.payLabel + '</td><td>' + booking.priceLabel + '</td></tr>';
      }).join('')
    : '<tr><td colspan="7">No bookings recorded this month.</td></tr>';

  var serviceRows = report.byService.length
    ? report.byService.map(function(item) {
        return '<tr><td>' + item.name + '</td><td>' + item.count + '</td><td>' + formatCurrency(item.revenue) + '</td></tr>';
      }).join('')
    : '<tr><td colspan="3">No service data.</td></tr>';

  var attendantRows = report.byAttendant.length
    ? report.byAttendant.map(function(item) {
        return '<tr><td>' + item.name + '</td><td>' + item.count + '</td><td>' + formatCurrency(item.revenue) + '</td></tr>';
      }).join('')
    : '<tr><td colspan="3">No staff data.</td></tr>';

  return '<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"/><title>Monthly report - ' + report.monthLabel + '</title><style>' +
    'body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a;}h1,h2{margin:0 0 12px;}h1{font-size:28px;}h2{font-size:18px;margin-top:28px;}p{margin:0 0 10px;color:#555;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;font-size:13px;}th{background:#f5efe4;} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0;} .card{border:1px solid #ddd;border-radius:12px;padding:14px 16px;background:#faf7f2;} .label{font-size:11px;text-transform:uppercase;color:#777;margin-bottom:6px;} .value{font-size:24px;font-weight:700;color:#5c4a30;}' +
    '@media print{body{padding:14px;} .no-print{display:none;}}' +
    '</style></head><body><div class="no-print" style="margin-bottom:18px;"><button onclick="window.print()">Print / Save PDF</button></div><h1>Monthly report</h1><p>' + report.monthLabel + '</p><p>Generated on ' + new Date(report.createdAt).toLocaleString('en-GB', { timeZone: SALON_TIME_ZONE }) + '</p>' +
    '<div class="grid"><div class="card"><div class="label">bookings</div><div class="value">' + report.totals.bookings + '</div></div><div class="card"><div class="label">Paid</div><div class="value">' + report.totals.paid + '</div></div><div class="card"><div class="label">Pending</div><div class="value">' + report.totals.pending + '</div></div><div class="card"><div class="label">Revenue</div><div class="value">' + formatCurrency(report.totals.revenue) + '</div></div></div>' +
    '<h2>Bookings by service</h2><table><thead><tr><th>Service</th><th>Count</th><th>Revenue</th></tr></thead><tbody>' + serviceRows + '</tbody></table>' +
    '<h2>Bookings by staff member</h2><table><thead><tr><th>Staff member</th><th>Count</th><th>Revenue</th></tr></thead><tbody>' + attendantRows + '</tbody></table>' +
    '<h2>Monthly bookings</h2><table><thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Staff member</th><th>Service</th><th>Payment</th><th>Price</th></tr></thead><tbody>' + bookingRows + '</tbody></table>' +
    '</body></html>';
}

function openReportWindow(report, autoPrint) {
  var popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) {
    showToast('Allow pop-ups for this site to open the report.');
    return;
  }
  popup.document.open();
  popup.document.write(getReportHtml(report));
  popup.document.close();
  if (autoPrint) {
    popup.focus();
    popup.print();
  }
}

function renderReportArchive() {
  var container = document.getElementById('reportArchive');
  if (!container) {
    return;
  }

  var reports = getStoredMonthlyReports().sort(function(a, b) {
    return b.monthKey.localeCompare(a.monthKey);
  });

  if (!reports.length) {
    container.innerHTML = '<div class="report-archive-empty">No monthly reports saved yet.</div>';
    return;
  }

  container.innerHTML = reports.map(function(report, index) {
    return '<div class="report-archive-item"><div><div class="report-archive-title">' + report.monthLabel + '</div><div class="report-archive-meta">Saved on ' + new Date(report.createdAt).toLocaleString('en-GB', { timeZone: SALON_TIME_ZONE }) + ' • ' + report.totals.bookings + ' booking(s) • ' + formatCurrency(report.totals.revenue) + '</div></div><div class="report-archive-actions"><button class="btn btn-ghost" type="button" onclick="openSavedMonthlyRecord(' + index + ', false)">Open</button><button class="btn btn-ghost" type="button" onclick="openSavedMonthlyRecord(' + index + ', true)">Print again</button><button class="remove-btn" type="button" onclick="deleteSavedMonthlyRecord(' + index + ')">Delete</button></div></div>';
  }).join('');
}

function setReportMonthDefault() {
  var input = document.getElementById('reportMonth');
  if (input && !input.value) {
    input.value = getDefaultReportMonth();
  }
}

function upsertStoredMonthlyReport(report) {
  var items = getStoredMonthlyReports();
  var existingIndex = items.findIndex(function(item) {
    return item.monthKey === report.monthKey;
  });

  if (existingIndex >= 0) {
    items[existingIndex] = report;
  } else {
    items.push(report);
  }

  setStoredMonthlyReports(items);
  renderReportArchive();
}

async function saveMonthlyRecord() {
  var monthKey = getSelectedReportMonth();
  var report = buildMonthlyReport(monthKey);
  upsertStoredMonthlyReport(report);
  if (hasAdminSession()) {
    var client = getSupabaseClient();
    if (client) {
      await client.from('monthly_reports').upsert({
        month_key: report.monthKey,
        snapshot_json: report
      }, { onConflict: 'month_key' });
      syncFromSupabase(true);
    }
  }
  showToast('Monthly report saved for ' + report.monthLabel + '.');
}

async function generateMonthlyPdf() {
  var monthKey = getSelectedReportMonth();
  var report = buildMonthlyReport(monthKey);
  upsertStoredMonthlyReport(report);
  if (hasAdminSession()) {
    var client = getSupabaseClient();
    if (client) {
      await client.from('monthly_reports').upsert({
        month_key: report.monthKey,
        snapshot_json: report
      }, { onConflict: 'month_key' });
    }
  }
  openReportWindow(report, true);
  showToast('Monthly report opened for printing or saving as PDF.');
}

function openSavedMonthlyRecord(index, autoPrint) {
  var reports = getStoredMonthlyReports().sort(function(a, b) {
    return b.monthKey.localeCompare(a.monthKey);
  });
  var report = reports[index];
  if (!report) {
    showToast('Monthly record not found.');
    return;
  }
  openReportWindow(report, autoPrint);
}

function deleteSavedMonthlyRecord(index) {
  var reports = getStoredMonthlyReports().sort(function(a, b) {
    return b.monthKey.localeCompare(a.monthKey);
  });
  if (!reports[index]) {
    showToast('Monthly record not found.');
    return;
  }
  reports.splice(index, 1);
  setStoredMonthlyReports(reports);
  renderReportArchive();
  showToast('Monthly record deleted.');
}

function getStartOfWeek(date) {
  var result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function getEndOfWeek(date) {
  var result = getStartOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function renderRevenueCards() {
  var weekEl = document.getElementById('rev-week');
  var monthEl = document.getElementById('rev-month');
  var weekSubEl = document.getElementById('rev-week-sub');
  var monthSubEl = document.getElementById('rev-month-sub');

  if (!weekEl || !monthEl || !weekSubEl || !monthSubEl) {
    return;
  }

  var referenceDate = getDashboardReferenceDate();
  var weekStart = getStartOfWeek(referenceDate);
  var weekEnd = getEndOfWeek(referenceDate);
  var refMonth = referenceDate.getMonth();
  var refYear = referenceDate.getFullYear();

  var paidBookings = bookings.filter(function(booking) {
    return booking.payStatus === 'paid' && booking.status !== 'declined' && booking.dateKey;
  });

  var weekTotal = paidBookings.reduce(function(total, booking) {
    var bookingDate = parseDateKey(booking.dateKey);
    if (bookingDate >= weekStart && bookingDate <= weekEnd) {
      return total + getBookingAmount(booking);
    }
    return total;
  }, 0);

  var monthTotal = paidBookings.reduce(function(total, booking) {
    var bookingDate = parseDateKey(booking.dateKey);
    if (bookingDate.getFullYear() === refYear && bookingDate.getMonth() === refMonth) {
      return total + getBookingAmount(booking);
    }
    return total;
  }, 0);

  weekEl.textContent = formatCurrency(weekTotal);
  monthEl.textContent = formatCurrency(monthTotal);
  weekSubEl.textContent = 'Based on paid bookings';
  monthSubEl.textContent = 'Based on paid bookings';
}

function filterRequests(button, filter) {
  document.querySelectorAll('.filter-pill').forEach(function(item) {
    item.classList.remove('active');
  });
  button.classList.add('active');
  currentFilter = filter;
  renderBookings(filter);
}

function renderBookings(filter) {
  var list = document.getElementById('bookings-list');
  var filtered = filter === 'all' ? bookings : bookings.filter(function(booking) {
    return booking.status === filter;
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="booking-card"><div class="bc-name">No requests found</div><div class="bc-service">No bookings match this filter.</div></div>';
    return;
  }

  list.innerHTML = filtered.map(function(booking) {
    return bookingCardHTML(booking);
  }).join('');
}

function bookingCardHTML(booking) {
  var service = getBookingService(booking);
  var statusBadge = booking.status === 'pending'
    ? '<span class="badge badge-pending">Pending</span>'
    : booking.status === 'accepted'
      ? '<span class="badge badge-accepted">Confirmed</span>'
      : '<span class="badge badge-declined">Declined</span>';
  var payBadge = booking.payStatus === 'paid'
    ? '<span class="badge badge-paid">Paid</span>'
    : booking.payStatus === 'waiting_check'
      ? '<span class="badge badge-wait">Legacy payment</span>'
      : '<span class="badge badge-unpaid">Pay in salon</span>';
  var methodBadge = booking.payMethod === 'pix' ? '<span class="badge badge-pix">Legacy payment</span>' : '';
  var actions = '';

  if (booking.status === 'pending') {
    actions = '<button class="act-btn act-accept" type="button" onclick="acceptBooking(' + booking.id + ')">Confirm</button>' +
      '<button class="act-btn act-decline" type="button" onclick="declineBooking(' + booking.id + ')">Decline</button>';
    if (booking.payStatus !== 'paid') {
      actions += '<button class="act-btn act-paid" type="button" onclick="markPaid(' + booking.id + ')">Mark paid</button>';
    }
  }

  if (booking.status === 'accepted' && booking.payStatus !== 'paid') {
    actions = '<button class="act-btn act-paid" type="button" onclick="markPaid(' + booking.id + ')">Mark paid</button>';
  }

  return '<div class="booking-card ' + booking.status + '" id="bc-' + booking.id + '">' +
    '<div class="bc-top"><div><div class="bc-name">' + booking.name + '</div><div class="bc-service">' + (service ? service.name : 'Removed service') + ' • ' + getAttendantName(booking.attendantId) + '</div></div><div class="bc-badges">' + statusBadge + methodBadge + payBadge + '</div></div>' +
    '<div class="bc-details">' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Date</div><div class="bc-detail-val">' + booking.date + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Time</div><div class="bc-detail-val">' + booking.time + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Price</div><div class="bc-detail-val">' + (service ? service.price : '—') + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Duration</div><div class="bc-detail-val">' + (service ? service.dur : '—') + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Staff member</div><div class="bc-detail-val">' + getAttendantName(booking.attendantId) + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Phone</div><div class="bc-detail-val">' + booking.phone + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Email</div><div class="bc-detail-val" style="font-size:11px;">' + booking.email + '</div></div>' +
    '</div>' +
    (actions ? '<div class="bc-actions">' + actions + '</div>' : '') +
  '</div>';
}

async function acceptBooking(id) {
    var booking = bookings.find(function(item) { return item.id === id; });
    if (!booking) {
      return;
    }
    if (!requireAdminSession()) {
      return;
    }
    var client = getSupabaseClient();
    if (client) {
      var result = await client.from('bookings').update({ status: 'accepted' }).eq('id', id);
      if (result.error) {
        showToast('Unable to update the booking. Please try again.');
        return;
      }
    }
    booking.status = 'accepted';
  auditLog.unshift({ dot: 'green', time: 'Just now', text: 'Booking <strong>#' + id + '</strong> confirmed; ' + booking.name });
  renderBookings(currentFilter);
  renderHistoryBookings(currentHistoryFilter);
  updatePendingCount();
  renderRevenueCards();
    showToast('Booking confirmed for ' + booking.name + '.');
    if (client) {
      syncFromSupabase(true);
    }
  }

  async function declineBooking(id) {
    var booking = bookings.find(function(item) { return item.id === id; });
    if (!booking) {
      return;
    }
    if (!requireAdminSession()) {
      return;
    }
    var client = getSupabaseClient();
    if (client) {
      var result = await client.from('bookings').update({ status: 'declined' }).eq('id', id);
      if (result.error) {
        showToast('Unable to update the booking. Please try again.');
        return;
      }
    }
    booking.status = 'declined';
  auditLog.unshift({ dot: 'red', time: 'Just now', text: 'Booking <strong>#' + id + '</strong> declined; ' + booking.name });
  renderBookings(currentFilter);
  renderHistoryBookings(currentHistoryFilter);
  updatePendingCount();
  renderRevenueCards();
    showToast('Booking declined.');
    if (client) {
      syncFromSupabase(true);
    }
  }

  async function markPaid(id) {
    var booking = bookings.find(function(item) { return item.id === id; });
    if (!booking) {
      return;
    }
    if (!requireAdminSession()) {
      return;
    }
    var client = getSupabaseClient();
    if (client) {
      var result = await client.from('bookings').update({ payment_status: 'paid' }).eq('id', id);
      if (result.error) {
        showToast('Unable to update the payment. Please try again.');
        return;
      }
    }
    booking.payStatus = 'paid';
  auditLog.unshift({ dot: 'blue', time: 'Just now', text: 'Booking <strong>#' + id + '</strong> marked paid; ' + booking.name });
  renderBookings(currentFilter);
  renderHistoryBookings(currentHistoryFilter);
  updatePendingCount();
  renderRevenueCards();
    showToast('Payment marked as paid for ' + booking.name + '.');
    if (client) {
      syncFromSupabase(true);
    }
  }

function renderServiceAdmin() {
  var list = document.getElementById('adminServiceList');
  if (!list) {
    return;
  }

  list.innerHTML = services.map(function(service) {
    var serviceAttendants = getAttendantsForService(service.id);
    var usage = serviceAttendants.length;
    var attendantNames = serviceAttendants.map(function(attendant) {
      return attendant.name;
    }).join(', ') || 'Nenhuma profissional vinculada';

    return '<div class="staff-card">' +
      '<div><div class="staff-name">' + service.name + '</div><div class="staff-meta">' + service.dur + ' • ' + service.price + ' • ' + usage + ' profissional(is) habilitada(s)</div><div class="staff-meta">Equipe: ' + attendantNames + '</div></div>' +
      '<div class="staff-actions"><button class="remove-btn" type="button" onclick="removeService(' + service.id + ')">Remove</button></div>' +
    '</div>';
  }).join('');
}

function addService() {
  var name = prompt('New service name:');
  if (!name) {
    return;
  }
  var duration = prompt('Duration in minutes (for example, 45):');
  var amount = Number(prompt('Price in the salon currency (for example, 35.50):'));
  if (!duration || !amount) {
    showToast('Enter a valid duration and price.');
    return;
  }

  var nextId = services.length ? Math.max.apply(null, services.map(function(item) { return item.id; })) + 1 : 1;
  services.push({
    id: nextId,
    name: name,
    dur: duration + ' min',
    price: formatCurrency(amount),
    amount: amount
  });

  renderServiceAdmin();
  renderServiceList();
  renderAttendantsAdmin();
  renderRanking();
  showToast('Service added.');
}

function removeService(serviceId) {
  var inUse = bookings.some(function(booking) {
    return booking.serviceId === serviceId && booking.status !== 'declined';
  });
  if (inUse) {
    showToast('This service has bookings. Resolve those bookings before removing it.');
    return;
  }

  services = services.filter(function(service) {
    return service.id !== serviceId;
  });

  attendants.forEach(function(attendant) {
    attendant.serviceIds = attendant.serviceIds.filter(function(id) {
      return id !== serviceId;
    });
  });

  if (state.serviceId === serviceId) {
    state.serviceId = null;
  }

  renderServiceAdmin();
  renderServiceList();
  renderAttendantsAdmin();
  renderRanking();
  showToast('Service removed.');
}

function renderAttendantsAdmin() {
  var list = document.getElementById('staff-list');
  if (!list) {
    return;
  }

  list.innerHTML = attendants.map(function(attendant) {
    var serviceNames = getServicesForAttendant(attendant.id).map(function(service) {
      return service.name;
    }).join(', ') || 'No services';
    var rosterSummary = WEEKDAY_LABELS.map(function(label, index) {
      var roster = attendant.roster[index];
      return roster.on ? label + ' ' + roster.open + '-' + roster.close : label + ' closed';
    }).join(' • ');

    return '<div class="staff-card">' +
      '<div><div class="staff-name">' + attendant.name + '</div><div class="staff-meta">Services: ' + serviceNames + '</div><div class="staff-meta">Working hours: ' + rosterSummary + '</div></div>' +
      '<div class="staff-actions">' +
        '<button class="btn btn-ghost" type="button" onclick="editAttendantServices(' + attendant.id + ')">Edit services</button>' +
        '<button class="btn btn-ghost" type="button" onclick="editAttendantRoster(' + attendant.id + ')">Edit hours</button>' +
        '<button class="remove-btn" type="button" onclick="removeAttendant(' + attendant.id + ')">Remove</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function addAttendant() {
  var name = prompt('New staff member name:');
  if (!name) {
    return;
  }

  var allServiceIds = services.map(function(service) { return service.id; });
  var nextId = attendants.length ? Math.max.apply(null, attendants.map(function(item) { return item.id; })) + 1 : 1;
  attendants.push({
    id: nextId,
    name: name,
    serviceIds: allServiceIds.slice(0, 1),
    roster: createRoster()
  });

  renderClientAttendants();
  renderAttendantsAdmin();
  renderServiceAdmin();
  showToast('Staff member added.');
}

function removeAttendant(id) {
  if (attendants.length === 1) {
    showToast('Keep at least one staff member.');
    return;
  }

  var hasBookings = bookings.some(function(booking) {
    return booking.attendantId === id && booking.status !== 'declined';
  });
  if (hasBookings) {
    showToast('This staff member has bookings. Reassign those bookings first.');
    return;
  }

  attendants = attendants.filter(function(attendant) {
    return attendant.id !== id;
  });

  if (state.attendantId === id) {
    state.attendantId = null;
    state.serviceId = null;
  }

  renderClientAttendants();
  renderServiceList();
  renderAttendantsAdmin();
  renderServiceAdmin();
  updateClientAttendantSummary();
  showToast('Staff member removed.');
}

function editAttendantServices(attendantId) {
  var attendant = getAttendantById(attendantId);
  if (!attendant) {
    return;
  }

  var current = attendant.serviceIds.join(',');
  var serviceMap = services.map(function(service) {
    return service.id + ' = ' + service.name;
  }).join(' | ');
  var input = prompt('Enter the service IDs offered by ' + attendant.name + ' separated by commas.\n' + serviceMap, current);
  if (input === null) {
    return;
  }

  var ids = input.split(',').map(function(part) {
    return Number(part.trim());
  }).filter(function(id) {
    return services.some(function(service) { return service.id === id; });
  });

  if (!ids.length) {
    showToast('Choose at least one valid service.');
    return;
  }

  attendant.serviceIds = ids;
  if (state.attendantId === attendantId && state.serviceId && !attendant.serviceIds.includes(state.serviceId)) {
    state.serviceId = null;
  }
  renderServiceList();
  renderAttendantsAdmin();
  renderClientAttendants();
  showToast('Staff services updated.');
}

function editAttendantRoster(attendantId) {
  var attendant = getAttendantById(attendantId);
  if (!attendant) {
    return;
  }

  var dayIndex = Number(prompt('Which day would you like to edit?\n0 Sunday, 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday'));
  if (Number.isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) {
    showToast('Invalid day.');
    return;
  }

  var current = attendant.roster[dayIndex];
  var enabled = prompt('Does this staff member work on this day? Enter yes or no.', current.on ? 'yes' : 'no');
  if (enabled === null) {
    return;
  }

  var on = enabled.toLowerCase() === 'yes';
  var open = current.open;
  var close = current.close;

  if (on) {
    open = prompt('Start time (HH:MM):', current.open) || current.open;
    close = prompt('Finish time (HH:MM):', current.close) || current.close;
  }

  attendant.roster[dayIndex] = { on: on, open: open, close: close };
  renderAttendantsAdmin();
  if (state.attendantId === attendantId && state.dateKey) {
    renderCalendar();
    var selectedDay = parseDateKey(state.dateKey).getDay();
    if (selectedDay === dayIndex) {
      renderTimes(dayIndex);
    }
  }
  showToast('Working hours updated.');
}

function renderBlocked() {
  var list = document.getElementById('blocked-list');
  if (!list) {
    return;
  }
  if (!blockedDates.length) {
    list.innerHTML = '<div class="blocked-item"><div><div style="font-weight:500;font-size:14px;">No blocked dates</div><div class="blocked-reason">Customers can book as usual.</div></div></div>';
    return;
  }

  list.innerHTML = blockedDates.map(function(blocked, index) {
    return '<div class="blocked-item"><div><div style="font-weight:500;font-size:14px;">' + formatDateKey(blocked.date) + '</div><div class="blocked-reason">' + blocked.reason + '</div></div><button class="remove-btn" type="button" onclick="removeBlock(' + index + ')">Remove</button></div>';
  }).join('');
}

function addBlock() {
  var dateValue = prompt('Enter the date to block in YYYY-MM-DD format:');
  if (!dateValue) {
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    showToast('Use YYYY-MM-DD to block a date.');
    return;
  }
  var reason = prompt('Reason for time off (optional):') || 'Unavailable';
  blockedDates.push({ date: dateValue, reason: reason });
  renderBlocked();
  renderCalendar();
  showToast('Date blocked: ' + formatDateKey(dateValue) + '.');
}

function removeBlock(index) {
  blockedDates.splice(index, 1);
  renderBlocked();
  renderCalendar();
  showToast('Date unblocked.');
}

function updatePixPreview() {
  var prevType = document.getElementById('prev-type');
  var prevKey = document.getElementById('prev-key');
  var prevName = document.getElementById('prev-name');
  var keyType = document.getElementById('pixKeyType');
  var keyVal = document.getElementById('pixKeyVal');
  var nameVal = document.getElementById('pixName');
  if (!prevType || !prevKey || !prevName || !keyType || !keyVal || !nameVal) {
    return;
  }
  var types = {
    cnpj: 'CNPJ',
    phone: 'Phone',
    email: 'Email',
    random: 'Random key'
  };
  prevType.textContent = types[keyType.value] || 'CNPJ';
  prevKey.textContent = keyVal.value;
  prevName.textContent = nameVal.value;
}

function savePix() {
  showToast('Payment settings are not available yet.');
  auditLog.unshift({ dot: '', time: 'Just now', text: 'Payment settings updated' });
}

function renderAudit() {
  var list = document.getElementById('audit-list');
  list.innerHTML = auditLog.map(function(entry) {
    return '<div class="audit-row2"><div class="audit-dot ' + entry.dot + '"></div><div class="audit-time">' + entry.time + '</div><div class="audit-text">' + entry.text + '</div></div>';
  }).join('');
}

function showToast(message) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function() {
    toast.classList.remove('show');
  }, 3000);
}

async function addService() {
  if (!requireAdminSession()) {
    return;
  }
  var name = prompt('New service name:');
  if (!name) {
    return;
  }
  var duration = prompt('Duration in minutes (for example, 45):');
  var amount = Number(prompt('Price in the salon currency (for example, 35.50):'));
  if (!duration || !amount) {
    showToast('Enter a valid duration and price.');
    return;
  }
  var client = getSupabaseClient();
  var insertResult = await client.from('services').insert({
    name: name,
    duration_minutes: Number(duration),
    price_cents: Math.round(amount * 100),
    active: true
  }).select('id').single();
  if (insertResult.error) {
    showToast('Unable to save the service. Please try again.');
    return;
  }
  await syncFromSupabase(true);
  showToast('Service added.');
}

async function removeService(serviceId) {
  if (!requireAdminSession()) {
    return;
  }
  var inUse = bookings.some(function(booking) {
    return booking.serviceId === serviceId && booking.status !== 'declined';
  });
  if (inUse) {
    showToast('This service has bookings. Resolve those bookings before removing it.');
    return;
  }
  var client = getSupabaseClient();
  var deleteResult = await client.from('services').delete().eq('id', serviceId);
  if (deleteResult.error) {
    showToast('Unable to remove the service. Please try again.');
    return;
  }
  await syncFromSupabase(true);
  showToast('Service removed.');
}

async function addAttendant() {
  if (!requireAdminSession()) {
    return;
  }
  var name = prompt('New staff member name:');
  if (!name) {
    return;
  }
  var client = getSupabaseClient();
  var insertAttendant = await client.from('attendants').insert({ name: name, active: true }).select('id').single();
  if (insertAttendant.error) {
    showToast('Unable to save the staff member. Please try again.');
    return;
  }
  var attendantId = Number(insertAttendant.data.id);
  var defaultServiceId = services.length ? services[0].id : null;
  if (defaultServiceId) {
    await client.from('attendant_services').insert({ attendant_id: attendantId, service_id: defaultServiceId });
  }
  var rosterSeed = createRoster();
  await client.from('rosters').insert(Object.keys(rosterSeed).map(function(key) {
    var slot = rosterSeed[key];
    return {
      attendant_id: attendantId,
      weekday: Number(key),
      is_working: slot.on,
      open_time: slot.on ? slot.open + ':00' : null,
      close_time: slot.on ? slot.close + ':00' : null
    };
  }));
  await syncFromSupabase(true);
  showToast('Staff member added.');
}

async function removeAttendant(id) {
  if (!requireAdminSession()) {
    return;
  }
  if (attendants.length === 1) {
    showToast('Keep at least one staff member.');
    return;
  }
  var hasBookings = bookings.some(function(booking) {
    return booking.attendantId === id && booking.status !== 'declined';
  });
  if (hasBookings) {
    showToast('This staff member has bookings. Reassign those bookings first.');
    return;
  }
  var client = getSupabaseClient();
  var deleteResult = await client.from('attendants').delete().eq('id', id);
  if (deleteResult.error) {
    showToast('Unable to remove the staff member. Please try again.');
    return;
  }
  await syncFromSupabase(true);
  showToast('Staff member removed.');
}

async function editAttendantServices(attendantId) {
  if (!requireAdminSession()) {
    return;
  }
  var attendant = getAttendantById(attendantId);
  if (!attendant) {
    return;
  }
  var current = attendant.serviceIds.join(',');
  var serviceMap = services.map(function(service) {
    return service.id + ' = ' + service.name;
  }).join(' | ');
  var input = prompt('Enter the service IDs offered by ' + attendant.name + ' separated by commas.\n' + serviceMap, current);
  if (input === null) {
    return;
  }
  var ids = input.split(',').map(function(part) {
    return Number(part.trim());
  }).filter(function(id) {
    return services.some(function(service) { return service.id === id; });
  });
  if (!ids.length) {
    showToast('Choose at least one valid service.');
    return;
  }
  var client = getSupabaseClient();
  await client.from('attendant_services').delete().eq('attendant_id', attendantId);
  var relationResult = await client.from('attendant_services').insert(ids.map(function(id) {
    return { attendant_id: attendantId, service_id: id };
  }));
  if (relationResult.error) {
    showToast('Unable to update staff services. Please try again.');
    return;
  }
  await syncFromSupabase(true);
  showToast('Staff services updated.');
}

async function editAttendantRoster(attendantId) {
  if (!requireAdminSession()) {
    return;
  }
  var attendant = getAttendantById(attendantId);
  if (!attendant) {
    return;
  }
  var dayIndex = Number(prompt('Which day would you like to edit?\n0 Sunday, 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday'));
  if (Number.isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) {
    showToast('Invalid day.');
    return;
  }
  var current = attendant.roster[dayIndex];
  var enabled = prompt('Does this staff member work on this day? Enter yes or no.', current.on ? 'yes' : 'no');
  if (enabled === null) {
    return;
  }
  var on = enabled.toLowerCase() === 'yes';
  var open = current.open;
  var close = current.close;
  if (on) {
    open = prompt('Start time (HH:MM):', current.open) || current.open;
    close = prompt('Finish time (HH:MM):', current.close) || current.close;
  }
  var client = getSupabaseClient();
  var upsertResult = await client.from('rosters').upsert({
    attendant_id: attendantId,
    weekday: dayIndex,
    is_working: on,
    open_time: on ? open + ':00' : null,
    close_time: on ? close + ':00' : null
  }, { onConflict: 'attendant_id,weekday' });
  if (upsertResult.error) {
    showToast('Unable to update working hours. Please try again.');
    return;
  }
  await syncFromSupabase(true);
  showToast('Working hours updated.');
}

async function addBlock() {
  if (!requireAdminSession()) {
    return;
  }
  var dateValue = prompt('Enter the date to block in YYYY-MM-DD format:');
  if (!dateValue) {
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    showToast('Use YYYY-MM-DD to block a date.');
    return;
  }
  var reason = prompt('Reason for time off (optional):') || 'Unavailable';
  var client = getSupabaseClient();
  var insertResult = await client.from('blocked_dates').insert({
    blocked_date: dateValue,
    reason: reason
  });
  if (insertResult.error) {
    showToast('Unable to block the date. Please try again.');
    return;
  }
  await syncFromSupabase(true);
  showToast('Date blocked: ' + formatDateKey(dateValue) + '.');
}

async function removeBlock(index) {
  if (!requireAdminSession()) {
    return;
  }
  var blocked = blockedDates[index];
  if (!blocked || !blocked.id) {
    return;
  }
  var client = getSupabaseClient();
  var deleteResult = await client.from('blocked_dates').delete().eq('id', blocked.id);
  if (deleteResult.error) {
    showToast('Unable to unblock the date. Please try again.');
    return;
  }
  await syncFromSupabase(true);
  showToast('Date unblocked.');
}

var currentHistoryFilter = 'today';

function hasPrivateAdminFlag() {
  try {
    var params = new URLSearchParams(window.location.search || '');
    return params.get('admin') === '1' || window.location.hash === '#admin';
  } catch (error) {
    return false;
  }
}

function isAdminOnlyPage() {
  return !document.getElementById('view-client') && !!document.getElementById('view-admin');
}

function toggleAdminMenu(forceOpen) {
  var shell = document.querySelector('.admin-shell');
  if (!shell) {
    return;
  }
  var open = typeof forceOpen === 'boolean' ? forceOpen : !shell.classList.contains('menu-open');
  shell.classList.toggle('menu-open', open);
  if (document.body) {
    document.body.style.overflow = open && window.innerWidth <= 700 ? 'hidden' : '';
  }
  var sidebar = document.getElementById('studio-navigation');
  var trigger = document.querySelector('.admin-menu-toggle');
  var mobile = window.innerWidth <= 700;
  if (trigger) trigger.setAttribute('aria-expanded', String(open && mobile));
  if (sidebar) {
    sidebar.inert = mobile && !open;
    if (mobile && open) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      sidebar.querySelector('.sidebar-close').focus();
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      if (mobile && trigger) trigger.focus();
    }
  }
}

function toggleAdminPassword(button) {
  var input = document.getElementById('adminPassword');
  var reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.textContent = reveal ? 'Hide' : 'Show';
  button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
  button.setAttribute('aria-pressed', String(reveal));
}

document.addEventListener('keydown', function(event) {
  var sidebar = document.getElementById('studio-navigation');
  if (!sidebar || window.innerWidth > 700 || !document.querySelector('.admin-shell.menu-open')) return;
  if (event.key === 'Escape') { event.preventDefault(); toggleAdminMenu(false); return; }
  if (event.key === 'Tab') {
    var controls = Array.from(sidebar.querySelectorAll('button:not(:disabled),a[href]'));
    var first = controls[0];
    var last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

function shouldExposeAdminEntry() {
  return isAdminOnlyPage() || hasPrivateAdminFlag() || hasAdminSession();
}

function updateAdminNavVisibility() {
  var adminButton = document.getElementById('adminNavButton');
  if (!adminButton) {
    return;
  }
  var show = shouldExposeAdminEntry();
  adminButton.classList.toggle('hidden', !show);

  if (!show) {
    var adminView = document.getElementById('view-admin');
    var clientView = document.getElementById('view-client');
    if (adminView && adminView.classList.contains('active') && clientView) {
      adminView.classList.remove('active');
      clientView.classList.add('active');
      document.querySelectorAll('.nav-pill').forEach(function(item) {
        item.classList.remove('active');
      });
      var clientButton = document.querySelector('.nav-pill');
      if (clientButton) {
        clientButton.classList.add('active');
      }
    }
  }
}

function ensureHistoryPanel() {
  if (document.getElementById('panel-history')) {
    return;
  }
  var requestsPanel = document.getElementById('panel-requests');
  if (!requestsPanel) {
    return;
  }
  requestsPanel.insertAdjacentHTML('afterend',
    '<div class="admin-panel" id="panel-history">' +
      '<div class="admin-title">Booking history</div>' +
      '<div class="request-filters">' +
        '<button class="filter-pill active" type="button" onclick="filterHistory(this, \'today\')">Today</button>' +
        '<button class="filter-pill" type="button" onclick="filterHistory(this, \'accepted\')">Confirmed</button>' +
        '<button class="filter-pill" type="button" onclick="filterHistory(this, \'payment_pending\')">Unpaid bookings</button>' +
        '<button class="filter-pill" type="button" onclick="filterHistory(this, \'declined\')">Declined</button>' +
        '<button class="filter-pill" type="button" onclick="filterHistory(this, \'all\')">All</button>' +
      '</div>' +
      '<div id="history-list"></div>' +
    '</div>'
  );
}

function getTodayDateKey() {
  var reference = getDashboardReferenceDate();
  return [
    reference.getFullYear(),
    String(reference.getMonth() + 1).padStart(2, '0'),
    String(reference.getDate()).padStart(2, '0')
  ].join('-');
}

function getPendingBookings() {
  return bookings.filter(function(booking) {
    return booking.status === 'pending';
  });
}

function getHistoryBookings(filter) {
  var todayKey = getTodayDateKey();
  var items = bookings.slice();

  if (filter === 'today') {
    return items.filter(function(booking) {
      return booking.dateKey === todayKey && booking.status !== 'declined';
    });
  }
  if (filter === 'accepted') {
    return items.filter(function(booking) {
      return booking.status === 'accepted';
    });
  }
  if (filter === 'declined') {
    return items.filter(function(booking) {
      return booking.status === 'declined';
    });
  }
  if (filter === 'payment_pending') {
    return items.filter(function(booking) {
      return booking.status !== 'declined' && booking.payStatus !== 'paid';
    });
  }
  return items.filter(function(booking) {
    return booking.status !== 'pending';
  });
}

function updateAdminAccessState() {
  var locked = !hasAdminSession();
  var identity = document.getElementById('sidebarAdminIdentity');
  if (identity) {
    identity.textContent = locked ? 'Sign-in required' : (adminProfile.email || 'Owner signed in');
  }

  var authCard = document.getElementById('adminAuthCard');
  if (authCard) {
    authCard.style.display = 'block';
  }

  document.querySelectorAll('.admin-protected').forEach(function(el) {
    el.classList.toggle('hidden', locked);
  });

  ['requests', 'history', 'avail', 'pix', 'audit'].forEach(function(panel) {
    var link = document.getElementById('sl-' + panel);
    if (link) {
      link.classList.toggle('locked', locked);
    }
    var panelEl = document.getElementById('panel-' + panel);
    if (panelEl) {
      panelEl.style.display = locked ? 'none' : '';
    }
  });

  if (locked) {
    var dash = document.getElementById('panel-dash');
    if (dash) {
      dash.classList.add('active');
    }
    document.querySelectorAll('.sidebar-link').forEach(function(item) {
      item.classList.remove('active');
    });
    var dashLink = document.getElementById('sl-dash');
    if (dashLink) {
      dashLink.classList.add('active');
    }
  }

  updateAdminNavVisibility();
  updateNotificationStatus();
}

function switchView(view, button) {
  if (view === 'admin' && !shouldExposeAdminEntry()) {
    showToast('The owner area requires sign-in.');
    return;
  }
  var targetView = document.getElementById('view-' + view);
  if (!targetView) {
    return;
  }
  document.querySelectorAll('.view').forEach(function(el) {
    el.classList.remove('active');
  });
  targetView.classList.add('active');
  if (button) {
    document.querySelectorAll('.nav-pill').forEach(function(el) {
      el.classList.remove('active');
    });
    button.classList.add('active');
  }
  if (view === 'admin') {
    updateAdminAccessState();
    if (!hasAdminSession()) {
      switchAdmin('dash');
      showToast('Sign in as the owner to open the dashboard.');
    } else {
      renderAdmin();
    }
  }
}

function switchAdmin(panel) {
  if (!hasAdminSession() && panel !== 'dash') {
    switchAdmin('dash');
    showToast('Sign in as the owner to continue.');
    return;
  }

  document.querySelectorAll('.admin-panel').forEach(function(item) {
    item.classList.remove('active');
  });
  document.querySelectorAll('.sidebar-link').forEach(function(item) {
    item.classList.remove('active');
  });

  var panelEl = document.getElementById('panel-' + panel);
  var linkEl = document.getElementById('sl-' + panel);
  if (panelEl) {
    panelEl.classList.add('active');
  }
  if (linkEl) {
    linkEl.classList.add('active');
  }

  if (panel === 'requests') {
    renderBookings();
  }
  if (panel === 'history') {
    renderHistoryBookings(currentHistoryFilter);
  }
  if (panel === 'avail') {
    renderServiceAdmin();
    renderAttendantsAdmin();
    renderBlocked();
  }
  if (panel === 'audit') {
    renderAudit();
  }
  toggleAdminMenu(false);
}

function renderAdmin() {
  ensureHistoryPanel();
  var requestsTitle = document.querySelector('#panel-requests .admin-title');
  if (requestsTitle) {
    requestsTitle.textContent = 'Pending requests';
  }
  var requestsFilters = document.querySelector('#panel-requests .request-filters');
  if (requestsFilters) {
    requestsFilters.innerHTML = '<div class="salon-sub">Requests leave this list once confirmed or declined.</div>';
  }
  updateAdminAccessState();
  updatePendingCount();
  renderRanking();
  renderRevenueCards();
  setReportMonthDefault();
  renderReportArchive();
  renderBookings();
  renderHistoryBookings(currentHistoryFilter);
}

function updatePendingCount() {
  var pending = getPendingBookings().length;
  var pendingPayments = getHistoryBookings('payment_pending').length;
  var todayCount = getHistoryBookings('today').length;
  var acceptedCount = getHistoryBookings('accepted').length;
  var pendingBadge = document.getElementById('pending-badge');
  var dashPending = document.getElementById('dash-pending');
  var dashPix = document.getElementById('dash-pix');
  var dashToday = document.getElementById('dash-today');
  var dashConfirmed = document.getElementById('dash-confirmed');
  if (pendingBadge) pendingBadge.textContent = pending;
  if (dashPending) dashPending.textContent = pending;
  if (dashPix) dashPix.textContent = pendingPayments;
  if (dashToday) dashToday.textContent = todayCount;
  if (dashConfirmed) dashConfirmed.textContent = acceptedCount;
}

function renderBookings() {
  var list = document.getElementById('bookings-list');
  if (!list) {
    return;
  }
  var filtered = getPendingBookings();
  if (!filtered.length) {
    list.innerHTML = '<div class="booking-card"><div class="bc-name">No pending requests</div><div class="bc-service">New requests appear here until you confirm or decline them.</div></div>';
    return;
  }
  list.innerHTML = filtered.map(function(booking) {
    return bookingCardHTML(booking);
  }).join('');
}

function filterRequests(button, filter) {
  currentFilter = 'pending';
  if (button) {
    document.querySelectorAll('#panel-requests .filter-pill').forEach(function(item) {
      item.classList.remove('active');
    });
    button.classList.add('active');
  }
  renderBookings();
}

function filterHistory(button, filter) {
  currentHistoryFilter = filter;
  document.querySelectorAll('#panel-history .filter-pill').forEach(function(item) {
    item.classList.remove('active');
  });
  if (button) {
    button.classList.add('active');
  }
  renderHistoryBookings(filter);
}

function renderHistoryBookings(filter) {
  var list = document.getElementById('history-list');
  if (!list) {
    return;
  }
  var filtered = getHistoryBookings(filter);
  if (!filtered.length) {
    list.innerHTML = '<div class="booking-card"><div class="bc-name">No bookings found</div><div class="bc-service">No bookings match this filter.</div></div>';
    return;
  }
  list.innerHTML = filtered.map(function(booking) {
    return bookingCardHTML(booking);
  }).join('');
}

function openDashboardFilter(filter) {
  if (!hasAdminSession()) {
    switchAdmin('dash');
    showToast('Sign in as the owner to view the details.');
    return;
  }
  if (filter === 'pending') {
    switchAdmin('requests');
    renderBookings();
    return;
  }
  switchAdmin('history');
  currentHistoryFilter = filter;
  document.querySelectorAll('#panel-history .filter-pill').forEach(function(item) {
    item.classList.remove('active');
    if (item.getAttribute('onclick') && item.getAttribute('onclick').indexOf("'" + filter + "'") >= 0) {
      item.classList.add('active');
    }
  });
  renderHistoryBookings(filter);
}

function renderClientAttendants() {
  var grid = document.getElementById('clientAttendantGrid');
  if (!grid) {
    return;
  }
  grid.innerHTML = '';

  var walkInCard = document.createElement('button');
  walkInCard.type = 'button';
  walkInCard.className = 'attendant-card' + (state.walkIn ? ' selected' : '');
  walkInCard.setAttribute('aria-pressed', String(state.walkIn));
  walkInCard.innerHTML = '<span class="technician-mark" aria-hidden="true">✳</span><div class="attendant-name">Anyone available</div><div class="attendant-meta">Find my perfect match</div>';
  walkInCard.onclick = function() {
    state.walkIn = true;
    state.attendantId = null;
    state.serviceId = null;
    state.dateKey = null;
    state.dateLabel = null;
    state.time = null;
    renderClientAttendants();
    renderServiceList();
    updateClientAttendantSummary();
    updateSelectedSlotSummary();
  };
  grid.appendChild(walkInCard);

  attendants.forEach(function(attendant) {
    var serviceCount = getServicesForAttendant(attendant.id).length;
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'attendant-card' + (!state.walkIn && state.attendantId === attendant.id ? ' selected' : '');
    card.setAttribute('aria-pressed', String(!state.walkIn && state.attendantId === attendant.id));
    var initials = attendant.name.trim().split(/\s+/).map(function(part) { return part.charAt(0); });
    var monogram = initials.length > 1 ? initials[0] + initials[initials.length - 1] : initials[0];
    card.innerHTML = '<span class="technician-mark" aria-hidden="true">' + escapeHtml(monogram.toUpperCase()) + '</span><div class="attendant-name">' + escapeHtml(attendant.name) + '</div><div class="attendant-meta">' + serviceCount + (serviceCount === 1 ? ' service available' : ' services available') + '</div>';
    card.onclick = function() {
      state.walkIn = false;
      state.attendantId = attendant.id;
      state.serviceId = null;
      state.dateKey = null;
      state.dateLabel = null;
      state.time = null;
      renderClientAttendants();
      renderServiceList();
      updateClientAttendantSummary();
      updateSelectedSlotSummary();
    };
    grid.appendChild(card);
  });
}

function renderServiceList() {
  var list = document.getElementById('serviceList');
  if (!list) {
    return;
  }
  list.innerHTML = '';

  if (!hasSelectedAttendantMode()) {
    list.innerHTML = '<div class="lgpd-note">Choose a staff member first to see their services.</div>';
    return;
  }

  var allowedServices = state.walkIn ? getWalkInServices() : getServicesForAttendant(state.attendantId);
  if (!allowedServices.length) {
    list.innerHTML = '<div class="lgpd-note">' + (state.walkIn ? 'No services have been assigned to staff yet.' : 'This staff member has no assigned services yet.') + '</div>';
    return;
  }

  allowedServices.forEach(function(service) {
    var card = document.createElement('button');
    card.type = 'button';
    card.setAttribute('aria-pressed', String(state.serviceId === service.id));
    card.className = 'svc-item' + (state.serviceId === service.id ? ' selected' : '');
    card.onclick = function() {
      selectService(service.id);
    };
    card.innerHTML = '<div class="svc-dot"></div><div class="svc-info"><div class="svc-name">' + escapeHtml(service.name) + '</div><div class="svc-dur">' + escapeHtml(service.dur) + '</div></div><div class="svc-price">' + escapeHtml(service.price.replace(',00', '')) + '</div>';
    list.appendChild(card);
  });
}

function bookingCardHTML(booking) {
  var service = getBookingService(booking);
  var statusBadge = booking.status === 'pending'
    ? '<span class="badge badge-pending">Pending</span>'
    : booking.status === 'accepted'
      ? '<span class="badge badge-accepted">Confirmed</span>'
      : '<span class="badge badge-declined">Declined</span>';
  var payBadge = booking.payStatus === 'paid'
    ? '<span class="badge badge-paid">Paid</span>'
    : booking.payStatus === 'waiting_check'
      ? '<span class="badge badge-wait">Legacy payment</span>'
      : '<span class="badge badge-unpaid">Pay in salon</span>';
  var methodBadge = booking.payMethod === 'pix' ? '<span class="badge badge-pix">Legacy payment</span>' : '';
  var actions = '';

  if (booking.status === 'pending') {
    actions = '<button class="act-btn act-accept" type="button" onclick="acceptBooking(' + booking.id + ')">Confirm</button>' +
      '<button class="act-btn act-decline" type="button" onclick="declineBooking(' + booking.id + ')">Decline</button>';
    if (booking.payStatus !== 'paid') {
      actions += '<button class="act-btn act-paid" type="button" onclick="markPaid(' + booking.id + ')">Mark paid</button>';
    }
  }

  if (booking.status === 'accepted' && booking.payStatus !== 'paid') {
    actions = '<button class="act-btn act-paid" type="button" onclick="markPaid(' + booking.id + ')">Mark paid</button>';
  }

  return '<div class="booking-card ' + booking.status + '" id="bc-' + booking.id + '">' +
    '<div class="bc-top"><div><div class="bc-name">' + escapeHtml(booking.name) + '</div><div class="bc-service">' + escapeHtml(service ? service.name : 'Removed service') + ' • ' + escapeHtml(getAttendantName(booking.attendantId)) + '</div></div><div class="bc-badges">' + statusBadge + methodBadge + payBadge + '</div></div>' +
    '<div class="bc-details">' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Date</div><div class="bc-detail-val">' + escapeHtml(booking.date) + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Time</div><div class="bc-detail-val">' + escapeHtml(booking.time) + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Price</div><div class="bc-detail-val">' + escapeHtml(service ? service.price : '—') + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Duration</div><div class="bc-detail-val">' + escapeHtml(service ? service.dur : '—') + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Staff member</div><div class="bc-detail-val">' + escapeHtml(getAttendantName(booking.attendantId)) + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Phone</div><div class="bc-detail-val">' + escapeHtml(booking.phone) + '</div></div>' +
      '<div class="bc-detail-item"><div class="bc-detail-label">Email</div><div class="bc-detail-val" style="font-size:11px;">' + escapeHtml(booking.email) + '</div></div>' +
    '</div>' +
    (actions ? '<div class="bc-actions">' + actions + '</div>' : '') +
  '</div>';
}

function renderServiceAdmin() {
  var list = document.getElementById('adminServiceList');
  if (!list) {
    return;
  }

  list.innerHTML = services.map(function(service) {
    var serviceAttendants = getAttendantsForService(service.id);
    var usage = serviceAttendants.length;
    var attendantNames = serviceAttendants.map(function(attendant) {
      return escapeHtml(attendant.name);
    }).join(', ') || 'Nenhuma profissional vinculada';

    return '<div class="staff-card">' +
      '<div><div class="staff-name">' + escapeHtml(service.name) + '</div><div class="staff-meta">' + escapeHtml(service.dur) + ' • ' + escapeHtml(service.price) + ' • ' + usage + ' profissional(is) habilitada(s)</div><div class="staff-meta">Equipe: ' + attendantNames + '</div></div>' +
      '<div class="staff-actions"><button class="remove-btn" type="button" onclick="removeService(' + service.id + ')">Remove</button></div>' +
    '</div>';
  }).join('');
}

function renderAttendantsAdmin() {
  var list = document.getElementById('staff-list');
  if (!list) {
    return;
  }

  list.innerHTML = attendants.map(function(attendant) {
    var serviceNames = getServicesForAttendant(attendant.id).map(function(service) {
      return escapeHtml(service.name);
    }).join(', ') || 'No services';
    var rosterSummary = WEEKDAY_LABELS.map(function(label, index) {
      var roster = attendant.roster[index];
      return escapeHtml(roster.on ? label + ' ' + roster.open + '-' + roster.close : label + ' closed');
    }).join(' • ');

    return '<div class="staff-card attendant-card-admin">' +
      '<div class="staff-card-body"><div class="staff-name">' + escapeHtml(attendant.name) + '</div><div class="staff-meta">Services: ' + serviceNames + '</div><div class="staff-meta">Working hours: ' + rosterSummary + '</div></div>' +
      '<div class="staff-actions bottom-actions">' +
        '<button class="btn btn-ghost" type="button" onclick="editAttendantServices(' + attendant.id + ')">Edit services</button>' +
        '<button class="btn btn-ghost" type="button" onclick="editAttendantRoster(' + attendant.id + ')">Edit hours</button>' +
        '<button class="remove-btn" type="button" onclick="removeAttendant(' + attendant.id + ')">Remove</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderBlocked() {
  var list = document.getElementById('blocked-list');
  if (!list) {
    return;
  }
  if (!blockedDates.length) {
    list.innerHTML = '<div class="blocked-item"><div><div style="font-weight:500;font-size:14px;">No blocked dates</div><div class="blocked-reason">Customers can book as usual.</div></div></div>';
    return;
  }

  list.innerHTML = blockedDates.map(function(blocked, index) {
    return '<div class="blocked-item"><div><div style="font-weight:500;font-size:14px;">' + escapeHtml(formatDateKey(blocked.date)) + '</div><div class="blocked-reason">' + escapeHtml(blocked.reason) + '</div></div><button class="remove-btn" type="button" onclick="removeBlock(' + index + ')">Remove</button></div>';
  }).join('');
}

function renderAudit() {
  var list = document.getElementById('audit-list');
  if (!list) {
    return;
  }
  list.innerHTML = '';
  auditLog.forEach(function(entry) {
    var row = document.createElement('div');
    row.className = 'audit-row2';

    var dot = document.createElement('div');
    dot.className = 'audit-dot ' + (entry.dot || '');
    row.appendChild(dot);

    var time = document.createElement('div');
    time.className = 'audit-time';
    time.textContent = entry.time || '';
    row.appendChild(time);

    var text = document.createElement('div');
    text.className = 'audit-text';
    text.textContent = String(entry.text || '').replace(/<[^>]+>/g, '');
    row.appendChild(text);

    list.appendChild(row);
  });
}

function getReportHtml(report) {
  var bookingRows = report.bookings.length
    ? report.bookings.map(function(booking) {
        return '<tr><td>' + escapeHtml(booking.date) + '</td><td>' + escapeHtml(booking.time) + '</td><td>' + escapeHtml(booking.client) + '</td><td>' + escapeHtml(booking.attendant) + '</td><td>' + escapeHtml(booking.service) + '</td><td>' + escapeHtml(booking.payLabel) + '</td><td>' + escapeHtml(booking.priceLabel) + '</td></tr>';
      }).join('')
    : '<tr><td colspan="7">No bookings recorded this month.</td></tr>';

  var serviceRows = report.byService.length
    ? report.byService.map(function(item) {
        return '<tr><td>' + escapeHtml(item.name) + '</td><td>' + item.count + '</td><td>' + escapeHtml(formatCurrency(item.revenue)) + '</td></tr>';
      }).join('')
    : '<tr><td colspan="3">No service data.</td></tr>';

  var attendantRows = report.byAttendant.length
    ? report.byAttendant.map(function(item) {
        return '<tr><td>' + escapeHtml(item.name) + '</td><td>' + item.count + '</td><td>' + escapeHtml(formatCurrency(item.revenue)) + '</td></tr>';
      }).join('')
    : '<tr><td colspan="3">No staff data.</td></tr>';

  return '<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"/><title>Monthly report - ' + escapeHtml(report.monthLabel) + '</title><style>' +
    'body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a;}h1,h2{margin:0 0 12px;}h1{font-size:28px;}h2{font-size:18px;margin-top:28px;}p{margin:0 0 10px;color:#555;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #ddd;padding:8px 10px;text-align:left;font-size:13px;}th{background:#f5efe4;} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0;} .card{border:1px solid #ddd;border-radius:12px;padding:14px 16px;background:#faf7f2;} .label{font-size:11px;text-transform:uppercase;color:#777;margin-bottom:6px;} .value{font-size:24px;font-weight:700;color:#5c4a30;}' +
    '@media print{body{padding:14px;} .no-print{display:none;}}' +
    '</style></head><body><div class="no-print" style="margin-bottom:18px;"><button onclick="window.print()">Print / Save PDF</button></div><h1>Monthly report</h1><p>' + escapeHtml(report.monthLabel) + '</p><p>Generated on ' + escapeHtml(new Date(report.createdAt).toLocaleString('en-GB', { timeZone: SALON_TIME_ZONE })) + '</p>' +
    '<div class="grid"><div class="card"><div class="label">bookings</div><div class="value">' + report.totals.bookings + '</div></div><div class="card"><div class="label">Paid</div><div class="value">' + report.totals.paid + '</div></div><div class="card"><div class="label">Pending</div><div class="value">' + report.totals.pending + '</div></div><div class="card"><div class="label">Revenue</div><div class="value">' + escapeHtml(formatCurrency(report.totals.revenue)) + '</div></div></div>' +
    '<h2>Bookings by service</h2><table><thead><tr><th>Service</th><th>Count</th><th>Revenue</th></tr></thead><tbody>' + serviceRows + '</tbody></table>' +
    '<h2>Bookings by staff member</h2><table><thead><tr><th>Staff member</th><th>Count</th><th>Revenue</th></tr></thead><tbody>' + attendantRows + '</tbody></table>' +
    '<h2>Monthly bookings</h2><table><thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Staff member</th><th>Service</th><th>Payment</th><th>Price</th></tr></thead><tbody>' + bookingRows + '</tbody></table>' +
    '</body></html>';
}

function renderReportArchive() {
  var container = document.getElementById('reportArchive');
  if (!container) {
    return;
  }

  var reports = getStoredMonthlyReports().sort(function(a, b) {
    return b.monthKey.localeCompare(a.monthKey);
  });

  if (!reports.length) {
    container.innerHTML = '<div class="report-archive-empty">No monthly reports saved yet.</div>';
    return;
  }

  container.innerHTML = reports.map(function(report, index) {
    return '<div class="report-archive-item"><div><div class="report-archive-title">' + escapeHtml(report.monthLabel) + '</div><div class="report-archive-meta">Saved on ' + escapeHtml(new Date(report.createdAt).toLocaleString('en-GB', { timeZone: SALON_TIME_ZONE })) + ' • ' + report.totals.bookings + ' booking(s) • ' + escapeHtml(formatCurrency(report.totals.revenue)) + '</div></div><div class="report-archive-actions"><button class="btn btn-ghost" type="button" onclick="openSavedMonthlyRecord(' + index + ', false)">Open</button><button class="btn btn-ghost" type="button" onclick="openSavedMonthlyRecord(' + index + ', true)">Print again</button><button class="remove-btn" type="button" onclick="deleteSavedMonthlyRecord(' + index + ')">Delete</button></div></div>';
  }).join('');
}

renderClientAttendants();
renderServiceList();
updateClientAttendantSummary();
updateSelectedSlotSummary();
renderServiceAdmin();
renderAttendantsAdmin();
renderBlocked();
renderRanking();
renderRevenueCards();
setReportMonthDefault();
renderReportArchive();
updatePixPreview();
updatePendingCount();
selectPay('later');
updateAdminSessionStatus();
var currencyLabel = document.getElementById('salonCurrencyLabel');
if (currencyLabel) currencyLabel.textContent = SALON_CURRENCY === 'EUR' ? 'EUR — Euro' : 'GBP — British pound';
updateAdminNavVisibility();
updateNotificationStatus();
window.addEventListener('resize', function() {
  if (window.innerWidth > 700) {
    toggleAdminMenu(false);
  } else {
    var sidebar = document.getElementById('studio-navigation');
    if (sidebar) sidebar.inert = !document.querySelector('.admin-shell.menu-open');
  }
});
var studioNavigation = document.getElementById('studio-navigation');
if (studioNavigation) studioNavigation.inert = window.innerWidth <= 700;

(async function initSupabaseApp() {
  if (!SUPABASE_ENABLED) {
    setOfflinePreview();
    return;
  }
  var client = getSupabaseClient();
  if (!client) {
    showConnectionNotice('Online booking is unavailable. Please contact the salon.');
    return;
  }
  try {
    var synced = await syncFromSupabase(true);
    if (!synced) {
      client.auth.stopAutoRefresh();
      showConnectionNotice('The booking service cannot be reached. Please contact the salon or try again later.');
      return;
    }
  } catch (error) {
    client.auth.stopAutoRefresh();
    showConnectionNotice('The booking service cannot be reached. Please contact the salon or try again later.');
    return;
  }
  client.auth.onAuthStateChange(function(_event, session) {
    adminSession = session || null;
    // Let the auth callback finish before requesting another session.
    setTimeout(function() { syncFromSupabase(true); }, 0);
  });
  subscribeToSupabase();
})();

