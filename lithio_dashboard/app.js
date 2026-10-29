const API_ORIGIN = window.location.protocol === 'file:' || window.location.port === '8080'
  ? `http://${window.location.hostname || 'localhost'}:8000`
  : window.location.origin;
const API_BASE_URL = `${API_ORIGIN}/api`;

const state = {
  drivers: [],
  routes: [],
  rewards: [],
  applications: [],
  wallet: [],
  vouchers: [],
  rideReceipts: [],
  reviews: [],
  reviewsDriver: '',
  bcv: null,
  admin: null
};

const STATUS_LABEL = {
  pendiente: 'Nueva',
  en_revision: 'En revisión',
  inspeccion: 'Inspección',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado'
};

// Siguiente paso de una postulación: texto del botón y estado al que avanza.
const NEXT_STEP = {
  pendiente: { label: 'Iniciar revisión', status: 'en_revision' },
  en_revision: { label: 'Citar inspección', status: 'inspeccion' },
  inspeccion: { label: 'Dar luz verde', status: 'aprobado' },
  rechazado: { label: 'Reabrir revisión', status: 'en_revision' }
};

let adminToken = null;
// El token de Firebase dura una hora: se renueva solo para que el panel siga avisando.
let refreshToken = null;
let tokenExpiresAt = 0;
let firebaseConfig;
const authGate = document.getElementById('auth-gate');
const dashboardApp = document.getElementById('dashboard-app');
const authStatus = document.getElementById('auth-status');
const loginButton = document.getElementById('login-button');
const statusText = document.getElementById('api-status');
const driversTableBody = document.getElementById('drivers-table-body');
const routesList = document.getElementById('routes-list');
const rewardsList = document.getElementById('rewards-list');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const entityForm = document.getElementById('entity-form');

const statAdminName = document.getElementById('stat-admin-name');
const statDriversCount = document.getElementById('stat-drivers-count');
const statPendingCount = document.getElementById('stat-pending-count');
const applicationsList = document.getElementById('applications-list');
const walletList = document.getElementById('wallet-list');
const vouchersList = document.getElementById('vouchers-list');
const rideReceiptsList = document.getElementById('ride-receipts-list');
const reviewsList = document.getElementById('reviews-list');
const reviewsSummary = document.getElementById('reviews-summary');
const reviewsDriverFilter = document.getElementById('reviews-driver-filter');
const toastStack = document.getElementById('toast-stack');

// Etiqueta de la referencia según el tipo de movimiento.
const REFERENCE_LABEL = { recarga: 'Referencia', donacion_pm: 'Referencia', retiro: 'Pagar a' };
// Cada cuánto se buscan solicitudes nuevas para avisar (el panel no usa WebSocket:
// competiría con la sesión única de la app del administrador).
const ALERT_POLL_MS = 30000;
let alertTimer = null;
let seenPending = null;
const statRoutesCount = document.getElementById('stat-routes-count');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function getFirebaseConfig() {
  if (firebaseConfig) return firebaseConfig;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/config`);
  } catch {
    throw new Error(`No se pudo conectar con el backend (${API_ORIGIN}). Inícialo y vuelve a cargar el dashboard.`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || 'La autenticación del dashboard no está configurada.');
  }
  firebaseConfig = body;
  return firebaseConfig;
}

async function firebaseSignIn(email, password) {
  const config = await getFirebaseConfig();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.idToken !== 'string') {
    const code = body.error?.message;
    if (code === 'INVALID_PASSWORD' || code === 'EMAIL_NOT_FOUND' || code === 'INVALID_LOGIN_CREDENTIALS') {
      throw new Error('Correo o contraseña incorrectos.');
    }
    throw new Error('No se pudo iniciar sesión con Firebase.');
  }
  refreshToken = body.refreshToken;
  tokenExpiresAt = Date.now() + Number(body.expiresIn || 3600) * 1000;
  return body.idToken;
}

async function freshToken() {
  if (refreshToken && Date.now() > tokenExpiresAt - 5 * 60 * 1000) {
    const config = await getFirebaseConfig();
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(config.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.id_token) {
      adminToken = body.id_token;
      refreshToken = body.refresh_token;
      tokenExpiresAt = Date.now() + Number(body.expires_in || 3600) * 1000;
    }
  }
  return adminToken;
}

async function requestAdmin(path, method = 'GET', body) {
  if (!adminToken) throw new Error('Inicia sesión como administrador para continuar.');
  const headers = new Headers({ Authorization: `Bearer ${await freshToken()}` });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.detail || `La operación no se pudo completar (${response.status}).`);
  }
  return result;
}

function renderAdminProfile(profile) {
  state.admin = profile;
  statAdminName.textContent = profile.name.split(' ')[0];
  document.getElementById('profile-name').textContent = profile.name;
  document.getElementById('profile-email').textContent = profile.email;
  document.getElementById('profile-phone').textContent = profile.phone;
  const form = document.getElementById('profile-form');
  form.elements.name.value = profile.name;
  form.elements.email.value = profile.email;
  form.elements.phone.value = profile.phone;
}

async function handleLogin(event) {
  event.preventDefault();
  loginButton.disabled = true;
  authStatus.textContent = 'Verificando acceso...';
  const form = new FormData(event.currentTarget);
  try {
    adminToken = await firebaseSignIn(form.get('email'), form.get('password'));
    const profile = await requestAdmin('/admin/me');
    renderAdminProfile(profile);
    authGate.classList.add('hidden');
    dashboardApp.classList.remove('hidden');
    authStatus.textContent = '';
    event.currentTarget.reset();
    await fetchData();
    startAlertPolling();
  } catch (error) {
    adminToken = null;
    authStatus.textContent = error instanceof Error ? error.message : 'No se pudo verificar el acceso.';
  } finally {
    loginButton.disabled = false;
  }
}

function setApiStatus(online) {
  const dot = document.querySelector('.pulse-dot');
  dot.classList.toggle('online', online);
  statusText.textContent = online ? 'Sistema online' : 'Conectando...';
}

async function fetchData() {
  try {
    setApiStatus(false);

    const [driversRes, routesRes, workshopRes, applicationsRes, walletRes, vouchersRes, receiptsRes] = await Promise.all([
      requestAdmin('/admin/drivers'),
      requestAdmin('/routes'),
      requestAdmin('/admin/workshop'),
      requestAdmin('/admin/driver-applications'),
      requestAdmin('/admin/wallet/pending'),
      requestAdmin('/admin/vouchers'),
      requestAdmin('/rides/admin/receipts')
    ]);
    // La tasa y las reseñas no deben impedir que cargue el resto del panel.
    state.bcv = await requestAdmin('/rates/bcv').catch(() => null);
    state.reviews = await requestAdmin(reviewsPath()).catch(() => []);

    state.drivers = driversRes;
    state.routes = routesRes;
    state.rewards = workshopRes;
    state.applications = applicationsRes.filter(a => a.status !== 'rechazado');
    state.wallet = walletRes;
    state.vouchers = vouchersRes;
    state.rideReceipts = receiptsRes;
    announceNewRequests();

    renderStats();
    renderApprovals();
    renderDrivers();
    renderRoutes();
    renderRewards();
    renderReviews();
    setApiStatus(true);
  } catch (error) {
    console.error(error);
    setApiStatus(false);
    statusText.textContent = error instanceof Error ? error.message : 'No se pudieron cargar los datos.';
  }
}

function renderStats() {
  statAdminName.textContent = state.admin.name.split(' ')[0];
  statDriversCount.textContent = String(state.drivers.length);
  const pending = state.applications.length + state.wallet.length + state.vouchers.length;
  statPendingCount.textContent = String(pending);
  document.title = `${pending ? `(${pending}) ` : ''}Panel de administración - LITHIO`;
  statRoutesCount.textContent = String(state.routes.length);
  const bcv = state.bcv;
  document.getElementById('stat-bcv').textContent = bcv ? `Bs ${bcv.rate.toFixed(2)}` : '—';
  document.getElementById('stat-bcv-meta').textContent = bcv
    ? `· ${bcv.is_current ? 'hoy' : bcv.date}${bcv.source === 'manual' ? ' · manual' : ''}`
    : '· sin datos';
}

function pendingKeys() {
  return new Set([
    ...state.applications.map(a => `app-${a.user_id}-${a.status}`),
    ...state.wallet.map(w => `tx-${w.id}-${w.has_receipt}`),
    ...state.vouchers.map(v => `vale-${v.id}`)
  ]);
}

function describeNew(key) {
  const [kind, id] = key.split('-');
  if (kind === 'app') {
    const app = state.applications.find(a => a.user_id === Number(id));
    return app && ['Conductor por verificar', `${app.name} · ${app.moto.brand_model}`];
  }
  if (kind === 'tx') {
    const tx = state.wallet.find(w => w.id === Number(id));
    return tx && [`${tx.label} por revisar`, `${tx.user_name} · ◆ ${Math.abs(tx.amount).toFixed(2)}${tx.has_receipt ? ' · con comprobante' : ''}`];
  }
  const voucher = state.vouchers.find(v => v.id === Number(id));
  return voucher && ['Vale de nota por revisar', `${voucher.user_name} · ${voucher.subject}`];
}

function showToast(title, body) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(body)}`;
  toast.addEventListener('click', () => {
    document.getElementById('approvals').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast.remove();
  });
  toastStack.prepend(toast);
  setTimeout(() => toast.remove(), 8000);
  // Con la pestaña en segundo plano, también como notificación del navegador.
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

// La primera carga solo memoriza lo pendiente; las siguientes avisan lo nuevo.
function announceNewRequests() {
  const keys = pendingKeys();
  if (seenPending) {
    [...keys].filter(key => !seenPending.has(key)).forEach(key => {
      const message = describeNew(key);
      if (message) showToast(...message);
    });
  }
  seenPending = keys;
}

function startAlertPolling() {
  stopAlertPolling();
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  alertTimer = setInterval(fetchData, ALERT_POLL_MS);
}

function stopAlertPolling() {
  if (alertTimer) clearInterval(alertTimer);
  alertTimer = null;
  seenPending = null;
}

// Fotos privadas (comprobantes y notas): se descargan con el token y se muestran como blob.
function loadPrivateImages(container, selector, pathFor) {
  container.querySelectorAll(selector).forEach(async img => {
    try {
      const response = await fetch(`${API_BASE_URL}${pathFor(img)}`, { headers: { Authorization: `Bearer ${await freshToken()}` } });
      if (response.ok) {
        img.src = URL.createObjectURL(await response.blob());
        img.addEventListener('click', () => window.open(img.src, '_blank'));
      } else {
        img.alt = 'No se pudo cargar la foto';
      }
    } catch {
      img.alt = 'No se pudo cargar la foto';
    }
  });
}

function emptyNote(text) {
  return `<p class="empty-note">${escapeHtml(text)}</p>`;
}

function renderApprovals() {
  applicationsList.innerHTML = state.applications.length ? state.applications.map(app => {
    const next = NEXT_STEP[app.status];
    return `
      <div class="route-card">
        <strong>${escapeHtml([app.name, app.last_name].filter(Boolean).join(' '))}</strong>
        <p><span class="status-badge status-pending">${escapeHtml(STATUS_LABEL[app.status] || app.status)}</span></p>
        <p>${escapeHtml(app.moto.brand_model)} · ${escapeHtml(app.moto.color)} · Placa ${escapeHtml(app.moto.plate)}${app.moto.year ? ` · ${app.moto.year}` : ''}</p>
        <p>Cédula: ${escapeHtml(app.cedula)} · Licencia: ${escapeHtml(app.license_number || '—')}</p>
        <p>Teléfono: ${escapeHtml(app.phone)} · ${escapeHtml(app.email)}</p>
        ${app.inspection_date ? `<p>Inspección: ${escapeHtml(app.inspection_date)}</p>` : ''}
        <div class="action-group">
          ${next ? `<button class="small-btn" data-action="app-advance" data-id="${Number(app.user_id)}">${escapeHtml(next.label)}</button>` : ''}
          <button class="small-btn danger" data-action="app-reject" data-id="${Number(app.user_id)}">Rechazar</button>
        </div>
      </div>`;
  }).join('') : emptyNote('No hay postulaciones pendientes.');

  walletList.innerHTML = state.wallet.length ? state.wallet.map(item => `
    <div class="route-card">
      <strong>${escapeHtml(item.label)} · ◆ ${Math.abs(item.amount).toFixed(2)}</strong>
      <p>${escapeHtml(item.user_name)} · ${escapeHtml(item.user_email)}${item.friend_code ? ` · ${escapeHtml(item.friend_code)}` : ''}</p>
      ${item.reference ? `<p>${REFERENCE_LABEL[item.kind] || 'Referencia'}: ${escapeHtml(item.reference)}</p>` : ''}
      ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
      ${item.has_receipt
        ? `<img class="evidence-img" data-tx="${Number(item.id)}" alt="Comprobante del Pago Móvil">`
        : (item.kind === 'recarga' || item.kind === 'donacion_pm' ? '<p class="empty-note">Sin captura del pago todavía.</p>' : '')}
      <p>${escapeHtml(new Date(item.created_at).toLocaleString('es-VE'))}</p>
      <div class="action-group">
        <button class="small-btn" data-action="wallet-approve" data-id="${Number(item.id)}">${item.kind === 'recarga' ? 'Acreditar diamantes' : 'Aprobar'}</button>
        <button class="small-btn danger" data-action="wallet-reject" data-id="${Number(item.id)}">Rechazar</button>
      </div>
    </div>`).join('') : emptyNote('No hay movimientos esperando revisión.');

  vouchersList.innerHTML = state.vouchers.length ? state.vouchers.map(voucher => `
    <div class="route-card">
      <strong>${escapeHtml(voucher.subject)}</strong>
      <p>${escapeHtml(voucher.user_name)}</p>
      <img class="evidence-img" data-voucher="${Number(voucher.id)}" alt="Foto de la nota">
      ${voucher.note ? `<p>${escapeHtml(voucher.note)}</p>` : ''}
      <div class="action-group">
        <button class="small-btn" data-action="voucher-approve" data-id="${Number(voucher.id)}">Aprobar vale</button>
        <button class="small-btn danger" data-action="voucher-reject" data-id="${Number(voucher.id)}">Rechazar</button>
      </div>
    </div>`).join('') : emptyNote('No hay vales por revisar.');

  rideReceiptsList.innerHTML = state.rideReceipts.length ? state.rideReceipts.map(ride => `
    <div class="route-card">
      <strong>Viaje #${Number(ride.id)} · $${Number(ride.fare_amount).toFixed(2)}</strong>
      <p>${escapeHtml(ride.origin)} → ${escapeHtml(ride.destination)}</p>
      <p>${escapeHtml(ride.passenger_name)} con ${escapeHtml(ride.driver_name)} · ${escapeHtml(ride.status)}</p>
      ${ride.payment_reference ? `<p>Referencia: ${escapeHtml(ride.payment_reference)}</p>` : ''}
      <img class="evidence-img" data-ride="${Number(ride.id)}" alt="Comprobante del viaje">
      ${ride.receipt_uploaded_at ? `<p>${escapeHtml(new Date(`${ride.receipt_uploaded_at}Z`).toLocaleString('es-VE'))}</p>` : ''}
    </div>`).join('') : emptyNote('Aún no hay comprobantes de viajes.');

  loadPrivateImages(vouchersList, 'img[data-voucher]', img => `/admin/vouchers/${img.dataset.voucher}/evidence`);
  loadPrivateImages(walletList, 'img[data-tx]', img => `/wallet/transactions/${img.dataset.tx}/receipt`);
  loadPrivateImages(rideReceiptsList, 'img[data-ride]', img => `/rides/${img.dataset.ride}/receipt`);
}

function renderDrivers() {
  if (!state.drivers.length) {
    driversTableBody.innerHTML = '<tr><td colspan="5">No hay conductores registrados.</td></tr>';
    return;
  }

  driversTableBody.innerHTML = state.drivers.map(driver => `
    <tr>
      <td>
        <div class="driver-meta">
          <div class="avatar">${escapeHtml(driver.name.charAt(0).toUpperCase())}</div>
          <div>
            <strong>${escapeHtml([driver.name, driver.last_name].filter(Boolean).join(' '))}</strong><br>
            <small>★ ${Number(driver.rating_avg || 0).toFixed(1)} · ${driver.trips_count || 0} viajes</small>
          </div>
        </div>
      </td>
      <td>
        <strong>${escapeHtml(driver.moto.brand_model)}</strong><br>
        <small>Placa: ${escapeHtml(driver.moto.plate)}</small>
      </td>
      <td>${escapeHtml(STATUS_LABEL[driver.status] || driver.status)}</td>
      <td>
        <span class="status-badge ${driver.is_available ? 'status-available' : 'status-busy'}">
          ${driver.is_available ? 'Disponible' : 'Ocupado'}
        </span>
      </td>
      <td>
        <div class="action-group">
          <button class="small-btn" data-action="edit-driver" data-id="${Number(driver.user_id)}">Editar</button>
          <button class="small-btn danger" data-action="delete-driver" data-id="${Number(driver.user_id)}">Quitar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function reviewsPath() {
  return `/admin/reviews?limit=300${state.reviewsDriver ? `&driver_id=${Number(state.reviewsDriver)}` : ''}`;
}

function starsText(rating) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return '★'.repeat(value) + '☆'.repeat(5 - value);
}

function renderReviews() {
  // El filtro lista a los conductores registrados; se conserva la elección al recargar.
  reviewsDriverFilter.innerHTML = '<option value="">Todos</option>' + state.drivers.map(driver => `
    <option value="${Number(driver.user_id)}" ${String(driver.user_id) === state.reviewsDriver ? 'selected' : ''}>
      ${escapeHtml([driver.name, driver.last_name].filter(Boolean).join(' '))}
    </option>`).join('');

  const reviews = state.reviews;
  if (!reviews.length) {
    reviewsSummary.textContent = '';
    reviewsList.innerHTML = emptyNote(state.reviewsDriver ? 'Este conductor aún no tiene reseñas.' : 'Aún no hay reseñas.');
    return;
  }
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  reviewsSummary.textContent = `${reviews.length} ${reviews.length === 1 ? 'reseña' : 'reseñas'} · promedio ★ ${average.toFixed(2)}`;

  reviewsList.innerHTML = reviews.map(review => `
    <div class="route-card review-card">
      <strong class="review-stars" aria-label="${Number(review.rating)} de 5 estrellas">${starsText(review.rating)}</strong>
      <p><b>${escapeHtml(review.driver_name || 'Conductor')}</b> · calificado por ${escapeHtml(review.passenger_name || 'Pasajero')}</p>
      <p>Viaje #${Number(review.ride_id)} · ${escapeHtml(review.origin || '')} → ${escapeHtml(review.destination || '')}</p>
      ${review.badges.length ? `<p class="review-badges">${review.badges.map(badge => `<span>${escapeHtml(badge)}</span>`).join('')}</p>` : ''}
      ${review.comment ? `<p class="review-comment">“${escapeHtml(review.comment)}”</p>` : '<p class="muted">Sin comentario.</p>'}
      ${review.created_at ? `<p class="muted">${escapeHtml(new Date(`${review.created_at}Z`).toLocaleString('es-VE'))}</p>` : ''}
    </div>`).join('');
}

function renderRoutes() {
  routesList.innerHTML = state.routes.map(route => `
    <div class="route-card">
      <strong>${escapeHtml(route.origin)} → ${escapeHtml(route.destination)}</strong>
      <p>${escapeHtml(route.tag || 'Ruta disponible')}</p>
      <p>Tarifa: $${Number(route.fare_usd).toFixed(2)}</p>
      <p>Duración: ${Number(route.estimated_minutes)} min</p>
      <div class="action-group">
        <button class="small-btn" data-action="edit-route" data-id="${Number(route.id)}">Editar</button>
        <button class="small-btn danger" data-action="delete-route" data-id="${Number(route.id)}">Eliminar</button>
      </div>
    </div>
  `).join('');
}

function renderRewards() {
  rewardsList.innerHTML = state.rewards.map(reward => `
    <div class="reward-card">
      <strong>${escapeHtml(reward.title)}</strong>
      <p>${escapeHtml(reward.description || '')}</p>
      <p>Precio: ◆ ${Number(reward.cost).toFixed(2)}</p>
      <p>${reward.is_active ? 'Visible en la app' : 'Oculto'}</p>
      <div class="action-group">
        <button class="small-btn" data-action="edit-reward" data-id="${Number(reward.id)}">Editar</button>
        <button class="small-btn danger" data-action="delete-reward" data-id="${Number(reward.id)}">Eliminar</button>
      </div>
    </div>
  `).join('');
}

function openModal(title, type, payload = null) {
  modalTitle.textContent = title;
  entityForm.innerHTML = buildForm(type, payload);
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  entityForm.innerHTML = '';
}

function buildForm(type, payload) {
  if (type === 'driver') {
    const data = payload
      ? { ...payload, moto_brand_model: payload.moto.brand_model, plate: payload.moto.plate }
      : { name: '', phone: '', moto_brand_model: '', plate: '', is_available: true };

    return `
      <input type="hidden" name="type" value="driver">
      ${payload ? `<input type="hidden" name="entity_id" value="${Number(payload.user_id || payload.id)}">` : ''}
      <label>Nombre<input name="name" value="${escapeHtml(data.name)}" required></label>
      ${payload ? '' : `
      <label>Correo del conductor (con este entrará a la app)
        <input type="email" name="email" required placeholder="nombre@gmail.com">
      </label>
      <p class="empty-note">Queda sin recibir viajes hasta que entre a la app con ese correo y se ponga disponible.</p>`}
      <label>Teléfono<input name="phone" value="${escapeHtml(data.phone)}"></label>
      <label>Modelo de moto<input name="moto_brand_model" value="${escapeHtml(data.moto_brand_model)}"></label>
      <label>Placa<input name="plate" value="${escapeHtml(data.plate)}"></label>
      ${payload ? `<label>Estado
        <select name="is_available">
          <option value="true" ${data.is_available ? 'selected' : ''}>Disponible</option>
          <option value="false" ${!data.is_available ? 'selected' : ''}>Ocupado</option>
        </select>
      </label>` : ''}
      <button type="submit" class="primary-btn">Guardar</button>
    `;
  }

  if (type === 'route') {
    const data = payload || { origin: '', destination: '', fare_usd: 2.5, estimated_minutes: 12, tag: '' };
    return `
      <input type="hidden" name="type" value="route">
      ${payload ? `<input type="hidden" name="entity_id" value="${Number(payload.id)}">` : ''}
      <label>Origen<input name="origin" value="${escapeHtml(data.origin)}"></label>
      <label>Destino<input name="destination" value="${escapeHtml(data.destination)}"></label>
      <label>Tarifa<input type="number" step="0.1" name="fare_usd" value="${Number(data.fare_usd) || 2.5}"></label>
      <label>Duración (min)<input type="number" name="estimated_minutes" value="${Number(data.estimated_minutes) || 12}"></label>
      <label>Etiqueta<input name="tag" value="${escapeHtml(data.tag)}"></label>
      <button type="submit" class="primary-btn">Guardar</button>
    `;
  }

  if (type === 'credit') {
    return `
      <input type="hidden" name="type" value="credit">
      <p class="empty-note">Para un Pago Móvil que recibiste sin solicitud en la app. El código Li-XXXX está en el perfil de la persona.</p>
      <label>Código de la persona<input name="friend_code" required minlength="4" maxlength="12" placeholder="Li-AB12"></label>
      <label>Diamantes (◆ = USD)<input type="number" step="0.01" min="0.01" max="500" name="amount" required></label>
      <label>Nota (la verá en su billetera)<input name="note" maxlength="120" placeholder="Pago Móvil del lunes, ref. 123456"></label>
      <button type="submit" class="primary-btn">Acreditar</button>
    `;
  }

  if (type === 'reward') {
    const data = payload || { title: '', description: '', cost: 5, is_active: true };
    return `
      <input type="hidden" name="type" value="reward">
      ${payload ? `<input type="hidden" name="entity_id" value="${Number(payload.id)}">` : ''}
      <label>Servicio<input name="title" value="${escapeHtml(data.title)}" required minlength="3"></label>
      <label>Descripción<textarea name="description">${escapeHtml(data.description || '')}</textarea></label>
      <label>Precio en diamantes (◆ = USD)<input type="number" step="0.5" min="0.5" name="cost" value="${Number(data.cost)}"></label>
      <label>Visible en la app
        <select name="is_active">
          <option value="true" ${data.is_active ? 'selected' : ''}>Sí</option>
          <option value="false" ${!data.is_active ? 'selected' : ''}>No</option>
        </select>
      </label>
      <button type="submit" class="primary-btn">Guardar</button>
    `;
  }

  return '';
}

function handleFormSubmit(event) {
  event.preventDefault();
  const formData = new FormData(entityForm);
  const type = formData.get('type');
  const entityId = formData.get('entity_id');

  if (type === 'driver') {
    // Solo los campos del formulario: la calificación y los viajes no se tocan.
    const payload = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      moto_brand_model: formData.get('moto_brand_model'),
      plate: formData.get('plate'),
      is_available: formData.get('is_available') === 'true'
    };
    const promise = entityId
      ? requestAdmin(`/admin/drivers/${entityId}`, 'PUT', payload)
      : requestAdmin('/admin/drivers', 'POST', { ...payload, email: String(formData.get('email') || '').trim() });
    promise.then(fetchData).catch(showError);
  }

  if (type === 'route') {
    const route = {
      id: Date.now(),
      origin: formData.get('origin'),
      destination: formData.get('destination'),
      fare_usd: Number.isFinite(Number(formData.get('fare_usd'))) ? Number(formData.get('fare_usd')) : 2.5,
      estimated_minutes: Number(formData.get('estimated_minutes')) || 12,
      tag: formData.get('tag') || 'Ruta de la comunidad'
    };
    const promise = entityId
      ? requestAdmin(`/admin/routes/${entityId}`, 'PUT', route)
      : requestAdmin('/admin/routes', 'POST', route);
    promise.then(fetchData).catch(showError);
  }

  if (type === 'credit') {
    const body = {
      friend_code: String(formData.get('friend_code') || '').trim(),
      amount: Number(String(formData.get('amount')).replace(',', '.')),
      note: formData.get('note') || undefined
    };
    requestAdmin('/admin/wallet/credit', 'POST', body)
      .then(tx => {
        alert(`Acreditados ◆ ${tx.amount.toFixed(2)}.`);
        return fetchData();
      })
      .catch(showError);
  }

  if (type === 'reward') {
    const item = {
      title: formData.get('title'),
      description: formData.get('description') || null,
      cost: Number(formData.get('cost')) || 0,
      is_active: formData.get('is_active') === 'true'
    };
    const promise = entityId
      ? requestAdmin(`/admin/workshop/${entityId}`, 'PUT', item)
      : requestAdmin('/admin/workshop', 'POST', item);
    promise.then(fetchData).catch(showError);
  }

  closeModal();
}

function showError(error) {
  console.error(error);
  alert(error.message);
}

function handleActions(event) {
  const button = event.target.closest('button');
  if (!button) return;

  const action = button.dataset.action;
  const id = Number(button.dataset.id);

  if (action === 'delete-driver') {
    if (!confirm('¿Eliminar este conductor y su cuenta? No se puede deshacer.')) return;
    requestAdmin(`/admin/drivers/${id}`, 'DELETE').then(fetchData).catch(showError);
    return;
  }

  if (action === 'delete-route') {
    requestAdmin(`/admin/routes/${id}`, 'DELETE').then(fetchData).catch(showError);
    return;
  }

  if (action === 'delete-reward') {
    if (!confirm('¿Eliminar este servicio del taller?')) return;
    requestAdmin(`/admin/workshop/${id}`, 'DELETE').then(fetchData).catch(showError);
    return;
  }

  if (action === 'app-advance') {
    const app = state.applications.find(a => a.user_id === id);
    const next = app && NEXT_STEP[app.status];
    if (!next) return;
    const body = { status: next.status };
    if (next.status === 'inspeccion') {
      const date = prompt(`¿Cuándo y dónde revisarás la moto de ${app.name}?`, 'Lunes 9:00 am, estacionamiento UNC');
      if (!date) return;
      body.inspection_date = date;
    }
    if (next.status === 'aprobado' && !confirm(`La cuenta de ${app.name} quedará activa como conductor. ¿Aprobar?`)) return;
    requestAdmin(`/admin/driver-applications/${id}`, 'PUT', body).then(fetchData).catch(showError);
    return;
  }

  if (action === 'app-reject') {
    const notes = prompt('Motivo del rechazo (lo verá el conductor):');
    if (!notes) return;
    requestAdmin(`/admin/driver-applications/${id}`, 'PUT', { status: 'rechazado', notes }).then(fetchData).catch(showError);
    return;
  }

  if (action === 'wallet-approve' || action === 'wallet-reject') {
    const approve = action === 'wallet-approve';
    const note = approve ? undefined : prompt('Motivo del rechazo:') ?? null;
    if (note === null) return;
    requestAdmin(`/admin/wallet/transactions/${id}`, 'PUT', { action: approve ? 'aprobar' : 'rechazar', note: note || undefined })
      .then(fetchData).catch(showError);
    return;
  }

  if (action === 'voucher-approve' || action === 'voucher-reject') {
    const approve = action === 'voucher-approve';
    const note = approve ? undefined : prompt('Motivo del rechazo (se devuelve el Fe):');
    if (!approve && !note) return;
    requestAdmin(`/admin/vouchers/${id}`, 'PUT', { action: approve ? 'aprobar' : 'rechazar', note })
      .then(fetchData).catch(showError);
    return;
  }

  if (action === 'edit-driver') {
    const driver = state.drivers.find(d => d.user_id === id);
    if (driver) openModal('Editar conductor', 'driver', driver);
  }

  if (action === 'edit-route') {
    const route = state.routes.find(r => r.id === id);
    if (route) openModal('Editar ruta', 'route', route);
  }

  if (action === 'edit-reward') {
    const reward = state.rewards.find(r => r.id === id);
    if (reward) openModal('Editar servicio', 'reward', reward);
  }
}

async function updateAdminProfile(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const profile = await requestAdmin(`/admin/profile/${state.admin.id}`, 'PUT', {
      name: form.get('name'),
      phone: form.get('phone')
    });
    state.admin.name = profile.name;
    state.admin.email = profile.email;
    state.admin.phone = profile.phone;
    renderAdminProfile(profile);
    renderStats();
    alert('Perfil actualizado correctamente');
  } catch (error) {
    showError(error);
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      button.classList.add('active');
      const sectionId = button.dataset.section;
      document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.getElementById('add-driver-btn').addEventListener('click', () => openModal('Nuevo conductor', 'driver'));
  document.getElementById('add-route-btn').addEventListener('click', () => openModal('Nueva ruta', 'route'));
  document.getElementById('add-reward-btn').addEventListener('click', () => openModal('Nuevo servicio del taller', 'reward'));
  document.getElementById('refresh-btn').addEventListener('click', fetchData);
  reviewsDriverFilter.addEventListener('change', () => {
    state.reviewsDriver = reviewsDriverFilter.value;
    requestAdmin(reviewsPath())
      .then(reviews => {
        state.reviews = reviews;
        renderReviews();
      })
      .catch(showError);
  });
  document.getElementById('credit-btn').addEventListener('click', () => openModal('Acreditar diamantes', 'credit'));
  document.getElementById('set-bcv-btn').addEventListener('click', () => {
    const value = prompt('Tasa BCV de hoy (Bs por dólar):', state.bcv ? String(state.bcv.rate) : '');
    const rate = Number(String(value || '').replace(',', '.'));
    if (!value || !(rate > 0)) return;
    requestAdmin('/admin/rates/bcv', 'PUT', { rate }).then(fetchData).catch(showError);
  });
  document.getElementById('close-modal').addEventListener('click', closeModal);
  entityForm.addEventListener('submit', handleFormSubmit);
  document.addEventListener('click', handleActions);
  document.getElementById('profile-form').addEventListener('submit', updateAdminProfile);
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-button').addEventListener('click', () => {
    stopAlertPolling();
    adminToken = null;
    refreshToken = null;
    state.admin = null;
    dashboardApp.classList.add('hidden');
    authGate.classList.remove('hidden');
    authStatus.textContent = '';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

bindEvents();
getFirebaseConfig().catch((error) => {
  authStatus.textContent = error instanceof Error ? error.message : 'No se pudo cargar la configuración de acceso.';
});
