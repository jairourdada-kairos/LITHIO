const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8000/api`;

const state = {
  drivers: [],
  routes: [],
  rewards: [],
  admin: {
    name: 'Jairo Eduardo Urdaneta González',
    email: 'jairourdada@gmail.com',
    phone: '04124091527',
    city: 'Caracas'
  }
};

const statusText = document.getElementById('api-status');
const driversTableBody = document.getElementById('drivers-table-body');
const routesList = document.getElementById('routes-list');
const rewardsList = document.getElementById('rewards-list');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const entityForm = document.getElementById('entity-form');

const statAdminName = document.getElementById('stat-admin-name');
const statDriversCount = document.getElementById('stat-drivers-count');
const statStarCoins = document.getElementById('stat-star-coins');
const statRoutesCount = document.getElementById('stat-routes-count');

function setApiStatus(online) {
  const dot = document.querySelector('.pulse-dot');
  dot.classList.toggle('online', online);
  statusText.textContent = online ? 'Sistema online' : 'Conectando...';
}

async function fetchData() {
  try {
    setApiStatus(false);

    const [driversRes, routesRes, rewardsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/drivers`),
      fetch(`${API_BASE_URL}/routes`),
      fetch(`${API_BASE_URL}/gamification/rewards`)
    ]);

    if (!driversRes.ok || !routesRes.ok || !rewardsRes.ok) {
      throw new Error('No se pudo cargar los datos del backend');
    }

    state.drivers = (await driversRes.json()).filter(d => !['Carlos Silva', 'Alejandro Díaz'].includes(d.name));
    state.routes = await routesRes.json();
    state.rewards = await rewardsRes.json();

    renderStats();
    renderDrivers();
    renderRoutes();
    renderRewards();
    setApiStatus(true);
  } catch (error) {
    console.error(error);
    setApiStatus(false);
    statusText.textContent = 'Sin conexión';
  }
}

async function requestAdmin(path, method, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'La operación no se pudo completar');
  }
  return response.status === 204 ? null : response.json();
}

function renderStats() {
  statAdminName.textContent = state.admin.name.split(' ')[0];
  statDriversCount.textContent = String(state.drivers.length);
  statStarCoins.textContent = '0';
  statRoutesCount.textContent = String(state.routes.length);
}

function renderDrivers() {
  if (!state.drivers.length) {
    driversTableBody.innerHTML = '<tr><td colspan="4">No hay conductores registrados.</td></tr>';
    return;
  }

  driversTableBody.innerHTML = state.drivers.map(driver => `
    <tr>
      <td>
        <div class="driver-meta">
          <div class="avatar">${driver.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>${driver.name}</strong><br>
            <small>${driver.xp_level}</small>
          </div>
        </div>
      </td>
      <td>
        <strong>${driver.moto_brand_model}</strong><br>
        <small>Placa: ${driver.plate}</small>
      </td>
      <td>
        <span class="status-badge ${driver.is_available ? 'status-available' : 'status-busy'}">
          ${driver.is_available ? 'Disponible' : 'Ocupado'}
        </span>
      </td>
      <td>
        <div class="action-group">
          <button class="small-btn" data-action="edit-driver" data-id="${driver.user_id}">Editar</button>
          <button class="small-btn danger" data-action="delete-driver" data-id="${driver.user_id}">Quitar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderRoutes() {
  routesList.innerHTML = state.routes.map(route => `
    <div class="route-card">
      <strong>${route.origin} → ${route.destination}</strong>
      <p>${route.tag || 'Ruta disponible'}</p>
      <p>Tarifa: $${route.fare_usd}</p>
      <p>Duración: ${route.estimated_minutes} min</p>
      <div class="action-group">
        <button class="small-btn" data-action="edit-route" data-id="${route.id}">Editar</button>
        <button class="small-btn danger" data-action="delete-route" data-id="${route.id}">Eliminar</button>
      </div>
    </div>
  `).join('');
}

function renderRewards() {
  rewardsList.innerHTML = state.rewards.map(reward => `
    <div class="reward-card">
      <strong>${reward.title}</strong>
      <p>${reward.description}</p>
      <p>Precio: ${reward.points_cost} Fe</p>
      <p>Descuento: ${reward.discount_percent}%</p>
      <div class="action-group">
        <button class="small-btn" data-action="edit-reward" data-id="${reward.id}">Editar</button>
        <button class="small-btn danger" data-action="delete-reward" data-id="${reward.id}">Eliminar</button>
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
    const data = payload || {
      name: '', phone: '', moto_brand_model: '', plate: '', is_available: true, rating_avg: 5, trips_count: 0, xp_level: 'Conductor UNC'
    };

    return `
      <input type="hidden" name="type" value="driver">
      ${payload ? `<input type="hidden" name="entity_id" value="${payload.user_id || payload.id}">` : ''}
      <label>Nombre<input name="name" value="${data.name || ''}"></label>
      <label>Teléfono<input name="phone" value="${data.phone || ''}"></label>
      <label>Modelo de moto<input name="moto_brand_model" value="${data.moto_brand_model || ''}"></label>
      <label>Placa<input name="plate" value="${data.plate || ''}"></label>
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
      ${payload ? `<input type="hidden" name="entity_id" value="${payload.id}">` : ''}
      <label>Origen<input name="origin" value="${data.origin || ''}"></label>
      <label>Destino<input name="destination" value="${data.destination || ''}"></label>
      <label>Tarifa<input type="number" step="0.1" name="fare_usd" value="${data.fare_usd || 2.5}"></label>
      <label>Duración (min)<input type="number" name="estimated_minutes" value="${data.estimated_minutes || 12}"></label>
      <label>Etiqueta<input name="tag" value="${data.tag || ''}"></label>
      <button type="submit" class="primary-btn">Guardar</button>
    `;
  }

  if (type === 'reward') {
    const data = payload || { title: '', description: '', points_cost: 100, discount_percent: 20 };
    return `
      <input type="hidden" name="type" value="reward">
      ${payload ? `<input type="hidden" name="entity_id" value="${payload.id}">` : ''}
      <label>Título<input name="title" value="${data.title || ''}"></label>
      <label>Descripción<textarea name="description">${data.description || ''}</textarea></label>
      <label>Coste en Fe<input type="number" name="points_cost" value="${data.points_cost || 100}"></label>
      <label>Descuento %<input type="number" name="discount_percent" value="${data.discount_percent || 20}"></label>
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
    const driver = {
      user_id: Date.now(),
      name: formData.get('name'),
      phone: formData.get('phone'),
      moto_brand_model: formData.get('moto_brand_model'),
      plate: formData.get('plate'),
      is_available: formData.get('is_available') === 'true',
      rating_avg: Number(formData.get('rating_avg')) || 5,
      trips_count: Number(formData.get('trips_count')) || 0,
      xp_level: 'Conductor UNC'
    };
    const payload = {
      name: driver.name,
      phone: driver.phone,
      moto_brand_model: driver.moto_brand_model,
      plate: driver.plate,
      is_available: driver.is_available,
      rating_avg: driver.rating_avg,
      trips_count: driver.trips_count,
      xp_level: driver.xp_level
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
    const reward = {
      id: Date.now(),
      title: formData.get('title'),
      description: formData.get('description'),
      points_cost: Number(formData.get('points_cost')) || 100,
      discount_percent: Number(formData.get('discount_percent')) || 20,
      icon: 'star-circle',
      is_active: true
    };
    const promise = entityId
      ? requestAdmin(`/admin/rewards/${entityId}`, 'PUT', reward)
      : requestAdmin('/admin/rewards', 'POST', reward);
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
    requestAdmin(`/admin/drivers/${id}`, 'DELETE').then(fetchData).catch(showError);
    return;
  }

  if (action === 'delete-route') {
    requestAdmin(`/admin/routes/${id}`, 'DELETE').then(fetchData).catch(showError);
    return;
  }

  if (action === 'delete-reward') {
    requestAdmin(`/admin/rewards/${id}`, 'DELETE').then(fetchData).catch(showError);
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
    if (reward) openModal('Editar recompensa', 'reward', reward);
  }
}

async function updateAdminProfile(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const profile = await requestAdmin('/admin/profile/1', 'PUT', {
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone')
    });
    state.admin.name = profile.name;
    state.admin.email = profile.email;
    state.admin.phone = profile.phone;
    state.admin.city = form.get('city');
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
  document.getElementById('add-reward-btn').addEventListener('click', () => openModal('Nueva recompensa', 'reward'));
  document.getElementById('close-modal').addEventListener('click', closeModal);
  entityForm.addEventListener('submit', handleFormSubmit);
  document.addEventListener('click', handleActions);
  document.getElementById('profile-form').addEventListener('submit', updateAdminProfile);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

bindEvents();
fetchData();
