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
  return body.idToken;
}

async function requestAdmin(path, method = 'GET', body) {
  if (!adminToken) throw new Error('Inicia sesión como administrador para continuar.');
  const headers = new Headers({ Authorization: `Bearer ${adminToken}` });
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

    const [driversRes, routesRes, workshopRes, applicationsRes, walletRes, vouchersRes] = await Promise.all([
      requestAdmin('/admin/drivers'),
      requestAdmin('/routes'),
      requestAdmin('/admin/workshop'),
      requestAdmin('/admin/driver-applications'),
      requestAdmin('/admin/wallet/pending'),
      requestAdmin('/admin/vouchers')
    ]);
    // La tasa no debe impedir que cargue el resto del panel.
    state.bcv = await requestAdmin('/rates/bcv').catch(() => null);

    state.drivers = driversRes;
    state.routes = routesRes;
    state.rewards = workshopRes;
    state.applications = applicationsRes.filter(a => a.status !== 'rechazado');
    state.wallet = walletRes;
    state.vouchers = vouchersRes;

    renderStats();
    renderApprovals();
    renderDrivers();
    renderRoutes();
    renderRewards();
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
  statPendingCount.textContent = String(state.applications.length + state.wallet.length + state.vouchers.length);
  statRoutesCount.textContent = String(state.routes.length);
  const bcv = state.bcv;
  document.getElementById('stat-bcv').textContent = bcv ? `Bs ${bcv.rate.toFixed(2)}` : '—';
  document.getElementById('stat-bcv-meta').textContent = bcv
    ? `· ${bcv.is_current ? 'hoy' : bcv.date}${bcv.source === 'manual' ? ' · manual' : ''}`
    : '· sin datos';
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
      <p>${escapeHtml(item.user_name)} · ${escapeHtml(item.user_email)}</p>
      ${item.reference ? `<p>${item.kind === 'recarga' ? 'Referencia' : 'Pagar a'}: ${escapeHtml(item.reference)}</p>` : ''}
      ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ''}
      <p>${escapeHtml(new Date(item.created_at).toLocaleString('es-VE'))}</p>
      <div class="action-group">
        <button class="small-btn" data-action="wallet-approve" data-id="${Number(item.id)}">Aprobar</button>
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

  // La evidencia es privada: se descarga con el token y se muestra como blob.
  vouchersList.querySelectorAll('img[data-voucher]').forEach(async img => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/vouchers/${img.dataset.voucher}/evidence`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (response.ok) img.src = URL.createObjectURL(await response.blob());
    } catch {
      img.alt = 'No se pudo cargar la foto';
    }
  });
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
      <label>Nombre<input name="name" value="${escapeHtml(data.name)}"></label>
      <label>Teléfono<input name="phone" value="${escapeHtml(data.phone)}"></label>
      <label>Modelo de moto<input name="moto_brand_model" value="${escapeHtml(data.moto_brand_model)}"></label>
      <label>Placa<input name="plate" value="${escapeHtml(data.plate)}"></label>
      <label>Estado
        <select name="is_available">
          <option value="true" ${data.is_available ? 'selected' : ''}>Disponible</option>
          <option value="false" ${!data.is_available ? 'selected' : ''}>Ocupado</option>
        </select>
      </label>
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
      : requestAdmin('/admin/drivers', 'POST', { ...payload, email: formData.get('email') || `driver-${Date.now()}@lithio.local` });
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
      email: form.get('email'),
      phone: form.get('phone')
    });
    state.admin.name = profile.name;
    state.admin.email = profile.email;
    state.admin.phone = profile.phone;
    renderAdminProfile(profile);
    document.getElementById('profile-form').elements.city.value = form.get('city');
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
    adminToken = null;
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
