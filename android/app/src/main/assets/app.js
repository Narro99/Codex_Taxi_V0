const USERS = [
  { u: 'org1', p: '1234', r: 'organizador', empresa: 'AeroMeet Empresas', logo: 'AM' },
  { u: 'org2', p: '1234', r: 'organizador', empresa: 'Norte Travel Group', logo: 'NT' },
  { u: 'viajero1', p: '1234', r: 'viajero' },
  { u: 'viajero2', p: '1234', r: 'viajero' },
  { u: 'viajero3', p: '1234', r: 'viajero' },
  { u: 'viajero4', p: '1234', r: 'viajero' },
  { u: 'taxi1', p: '1234', r: 'taxista' },
  { u: 'taxi2', p: '1234', r: 'taxista' },
  { u: 'taxi3', p: '1234', r: 'taxista' }
];

const WORKERS = [
  { user: 'viajero1', name: 'Laura Martin', phone: '+34 611 204 118', company: 'org1', homes: ['Calle Mayor 18, Madrid', 'Paseo de la Castellana 92, Madrid'] },
  { user: 'viajero2', name: 'Diego Salas', phone: '+34 622 815 442', company: 'org1', homes: ['Avenida de America 31, Madrid'] },
  { user: 'viajero3', name: 'Marta Echevarria', phone: '+34 633 490 275', company: 'org2', homes: ['Calle Ercilla 14, Bilbao'] },
  { user: 'viajero4', name: 'Unai Torres', phone: '+34 644 732 901', company: 'org2', homes: ['Paseo de Francia 6, Donostia'] }
];

const TAXISTAS = [
  { user: 'taxi1', name: 'Carlos Ruiz', phone: '+34 699 120 451' },
  { user: 'taxi2', name: 'Nerea Vidal', phone: '+34 688 305 774' },
  { user: 'taxi3', name: 'Omar Benali', phone: '+34 677 914 238' }
];

const K = {
  trips: 'trips_v6',
  notifs: 'notifs_v6',
  session: 'session_v2',
  workers: 'workers_v1',
  slots: 'driver_slots_v1',
  requests: 'trip_requests_v1'
};

const $ = id => document.getElementById(id);
const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const read = (k, d = []) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const trips = () => read(K.trips, []);
const setTrips = v => write(K.trips, v);
const notifs = () => read(K.notifs, []);
const setNotifs = v => write(K.notifs, v);
const workers = () => read(K.workers, WORKERS);
const setWorkers = v => write(K.workers, v);
const slots = () => read(K.slots, []);
const setSlots = v => write(K.slots, v);
const requests = () => read(K.requests, []);
const setRequests = v => write(K.requests, v);
const session = () => JSON.parse(localStorage.getItem(K.session) || 'null');
let activeWeekStart = weekStart(new Date());
let pendingDriverConfirmTripId = '';

function push(role, user, text, id) {
  const n = notifs();
  n.unshift({ role, user, text, id, at: new Date().toISOString() });
  setNotifs(n);
}

function estado(v) {
  return `V:${v.cv ? 'OK' : 'Pendiente'} T:${v.ct ? 'OK' : 'Pendiente'}`;
}

function pendientesDe(v) {
  const p = [];
  if (!v.cv) p.push('viajero');
  if (!v.ct) p.push('taxista');
  return p.join(', ');
}

function isConfirmed(v) {
  return Boolean(v.cv && v.ct);
}

function tripDate(v) {
  return new Date(`${v.fecha}T${v.hora || '00:00'}`);
}

function isCompleted(v) {
  return isConfirmed(v) && tripDate(v) <= new Date();
}

function companyFor(user) {
  return USERS.find(x => x.u === user && x.r === 'organizador');
}

function workerByUser(user) {
  const stored = workers().find(x => x.user === user);
  const base = WORKERS.find(x => x.user === user);
  if (stored && base) return { ...base, ...stored, phone: stored.phone || base.phone };
  return stored || base;
}

function driverByUser(user) {
  return TAXISTAS.find(x => x.user === user);
}

function workerPhone(v) {
  return v.viajeroPhone || workerByUser(v.viajero)?.phone || '';
}

function driverPhone(v) {
  return v.taxistaPhone || driverByUser(v.taxista)?.phone || '';
}

function contactLine(label, phone) {
  return phone ? `<span class="contact-line">${esc(label)}: <a href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a></span>` : '';
}

function minutes(hora) {
  const [h, m] = (hora || '00:00').split(':').map(Number);
  return (h * 60) + (m || 0);
}

function timeFromMinutes(total) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutes(hora, extra) {
  return timeFromMinutes(minutes(hora) + Number(extra || 0));
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDate(date) {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

function driverAvailability(user, fecha, hora, ignoreTripId = '') {
  if (!user || !fecha || !hora) return { busy: false, reason: 'Elige fecha y hora' };
  const start = minutes(hora);
  const end = start + 60;
  const trip = trips().find(t => t.id !== ignoreTripId && t.taxista === user && t.fecha === fecha && overlaps(start, end, minutes(t.hora), minutes(t.hora) + Number(t.ocupadoMin || 60)));
  if (trip) return { busy: true, reason: `Ocupado con ${trip.viajeroNombre || trip.viajero}` };
  const slot = slots().find(s => s.taxista === user && s.fecha === fecha && s.estado === 'ocupado' && overlaps(start, end, minutes(s.inicio), minutes(s.fin)));
  if (slot) return { busy: true, reason: `${slot.titulo || 'Bloqueado'} ${slot.inicio}-${slot.fin}` };
  return { busy: false, reason: 'Disponible' };
}

function availableDriver(fecha, hora, ignoreTripId = '', preferred = '') {
  const ordered = [
    ...TAXISTAS.filter(t => t.user === preferred),
    ...TAXISTAS.filter(t => t.user !== preferred)
  ];
  return ordered.find(t => !driverAvailability(t.user, fecha, hora, ignoreTripId).busy) || ordered[0];
}

function setBadge(id, count) {
  const el = $(id);
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('hidden', !count);
}

function renderMenuBadges() {
  const s = session();
  if (!s) return;
  if (s.r === 'organizador') {
    setBadge('badge-org-solicitudes', requests().filter(r => r.empresaId === s.u && r.status === 'pendiente').length);
    setBadge('badge-org-pendientes', trips().filter(t => t.empresaId === s.u && !isConfirmed(t)).length);
  }
  if (s.r === 'taxista') {
    setBadge('badge-taxi-viajes', trips().filter(t => t.taxista === s.u && !t.ct).length);
  }
  if (s.r === 'viajero') {
    setBadge('badge-viajero-viajes', trips().filter(t => t.viajero === s.u && !t.cv).length);
  }
}

function statusDot(label, ok) {
  return `<span class="confirm-state ${ok ? 'ok' : 'ko'}"><span></span>${label}: ${ok ? 'Confirmado' : 'Pendiente'}</span>`;
}

function durationSummary(v) {
  if (!v.duracionMin && !v.ocupadoMin) return '<span class="muted">Pendiente del taxista</span>';
  return `<span>${v.duracionMin || '-'} min trayecto<br><small>Ocupado hasta ${v.ocupadoMin ? addMinutes(v.hora, v.ocupadoMin) : '-'}</small></span>`;
}

function setView(role) {
  ['organizador', 'viajero', 'taxista'].forEach(r => $(`view-${r}`).classList.add('hidden'));
  $(`view-${role}`).classList.remove('hidden');
  const s = session();
  if (role === 'organizador') {
    const c = companyFor(s.u);
    $('panel-title').textContent = c.empresa;
    $('company-logo').textContent = c.logo;
    $('company-logo').classList.remove('hidden');
  } else {
    $('panel-title').textContent = `${role} · ${s.u}`;
    $('company-logo').classList.add('hidden');
  }
}

function setOrgTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('org-asignacion').classList.toggle('hidden', tab !== 'asignacion');
  $('org-solicitudes').classList.toggle('hidden', tab !== 'solicitudes');
  $('org-pendientes').classList.toggle('hidden', tab !== 'pendientes');
  $('org-historico').classList.toggle('hidden', tab !== 'historico');
}

function setDriverTab(tab) {
  document.querySelectorAll('.driver-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.driverTab === tab));
  $('taxi-viajes').classList.toggle('hidden', tab !== 'viajes');
  $('taxi-calendario').classList.toggle('hidden', tab !== 'calendario');
  if (tab === 'calendario') renderCalendar();
}

function setTravelerTab(tab) {
  document.querySelectorAll('.traveler-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.travelerTab === tab));
  $('viajero-viajes').classList.toggle('hidden', tab !== 'viajes');
  $('viajero-solicitud').classList.toggle('hidden', tab !== 'solicitud');
  if (tab === 'solicitud') renderTravelerRequests();
}

function fillWorkerSelect() {
  const s = session();
  const list = workers().filter(w => w.company === s.u);
  $('viajero').innerHTML = '<option value="">Trabajador</option>' + list.map(w => `<option value="${w.user}">${w.name} (${w.user})</option>`).join('');
  const names = list.map(w => `<option value="${w.user}">${w.name}</option>`).join('');
  $('f-persona').innerHTML = '<option value="">Todas las personas</option>' + names;
}

function fillAddressSelect() {
  const w = workerByUser($('viajero').value);
  const addresses = w ? w.homes : [];
  $('domicilio').innerHTML = '<option value="">Domicilio</option>' + addresses.map(a => `<option value="${a}">${a}</option>`).join('') + '<option value="__new">Anadir domicilio nuevo</option>';
  if (addresses.length) $('domicilio').value = addresses[0];
  $('new-address-row').classList.add('hidden');
}

function fillDriverSelect() {
  const fecha = $('fecha').value;
  const hora = $('hora').value;
  const editing = $('trip-id').value;
  $('taxista').innerHTML = '<option value="">Automatico segun disponibilidad</option>' + TAXISTAS.map(t => {
    const a = driverAvailability(t.user, fecha, hora, editing);
    return `<option value="${t.user}">${t.name} (${t.user}) - ${a.busy ? 'ocupado' : 'libre'}</option>`;
  }).join('');
  renderDriverStatus();
}

function fillRequestForm() {
  if (!$('request-home')) return;
  const w = workerByUser(session().u);
  const homes = w ? w.homes : [];
  $('request-home').innerHTML = '<option value="">Domicilio de recogida</option>' + homes.map(h => `<option value="${h}">${h}</option>`).join('');
  if (homes.length) $('request-home').value = homes[0];
  $('request-driver').innerHTML = '<option value="">Sin preferencia de taxista</option>' + TAXISTAS.map(t => `<option value="${t.user}">${t.name} (${t.user})</option>`).join('');
}

function renderDriverStatus() {
  const fecha = $('fecha').value;
  const hora = $('hora').value;
  const editing = $('trip-id').value;
  $('taxi-status-list').innerHTML = TAXISTAS.map(t => {
    const a = driverAvailability(t.user, fecha, hora, editing);
    return `<span class="status-pill ${a.busy ? 'busy' : 'free'}">${t.name}: ${a.reason}</span>`;
  }).join('');
}

function renderOrg() {
  fillWorkerSelect();
  fillDriverSelect();
  renderMenuBadges();
  renderOrgRequests();
  renderPendingTrips();
  renderHistory();
}

function renderOrgTable() {
  if (!$('tabla')) return;
  const s = session();
  const body = $('tabla');
  const data = trips().filter(t => t.empresaId === s.u);
  body.innerHTML = data.length ? '' : '<tr><td colspan="6">Sin viajes</td></tr>';
  data.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${v.viajeroNombre || v.viajero}</td><td>${v.domicilio} - ${v.aeropuerto}</td><td>${v.fecha} ${v.hora}</td><td>${v.taxistaNombre || v.taxista}</td><td>${estado(v)}</td><td><button data-id="${v.id}" class="edit-org">Editar</button></td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('.edit-org').forEach(b => {
    b.onclick = () => editOrgTrip(b.dataset.id);
  });
}

function editOrgTrip(id) {
  const t = trips().find(x => x.id === id);
  if (!t) return;
  $('trip-id').value = t.id;
  $('viajero').value = t.viajero;
  fillAddressSelect();
  $('domicilio').value = t.domicilio;
  $('aeropuerto').value = t.aeropuerto;
  $('fecha').value = t.fecha;
  $('hora').value = t.hora;
  fillDriverSelect();
  $('taxista').value = t.taxista;
  renderDriverStatus();
  setOrgTab('asignacion');
}

function renderHistory() {
  const s = session();
  const persona = $('f-persona').value;
  const taxista = $('f-taxista').value.trim().toLowerCase();
  const viaje = $('f-viaje').value.trim().toLowerCase();
  const body = $('historial');
  const data = trips().filter(t => {
    if (t.empresaId !== s.u) return false;
    if (!isCompleted(t)) return false;
    if (persona && t.viajero !== persona) return false;
    if (taxista && !`${t.taxista} ${t.taxistaNombre || ''}`.toLowerCase().includes(taxista)) return false;
    const tripText = `${t.id} ${t.domicilio} ${t.aeropuerto} ${t.fecha} ${t.hora}`.toLowerCase();
    return !viaje || tripText.includes(viaje);
  });
  body.innerHTML = data.length ? '' : '<tr><td colspan="5">Sin resultados</td></tr>';
  data.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(v.viajeroNombre || v.viajero)}${contactLine('Tel.', workerPhone(v))}</td><td>${esc(v.taxistaNombre || v.taxista)}${contactLine('Tel.', driverPhone(v))}</td><td>${esc(v.domicilio)} - ${esc(v.aeropuerto)}</td><td>${esc(v.fecha)} ${esc(v.hora)}</td><td>${estado(v)}</td>`;
    body.appendChild(tr);
  });
}

function renderPendingTrips() {
  const s = session();
  const body = $('pendientes');
  const data = trips().filter(t => t.empresaId === s.u && !isConfirmed(t));
  body.innerHTML = data.length ? '' : '<tr><td colspan="8">No hay viajes pendientes de confirmar</td></tr>';
  data.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(v.viajeroNombre || v.viajero)}${contactLine('Tel.', workerPhone(v))}</td><td>${esc(v.taxistaNombre || v.taxista)}${contactLine('Tel.', driverPhone(v))}</td><td>${esc(v.domicilio)} - ${esc(v.aeropuerto)}</td><td>${esc(v.fecha)} ${esc(v.hora)}</td><td>${statusDot('Viajero', v.cv)}</td><td>${statusDot('Taxista', v.ct)}</td><td>${durationSummary(v)}</td><td><button data-id="${v.id}" class="edit-pending">Editar</button></td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('.edit-pending').forEach(b => {
    b.onclick = () => editOrgTrip(b.dataset.id);
  });
}

function renderOrgRequests() {
  const s = session();
  const body = $('solicitudes-org');
  const data = requests().filter(r => r.empresaId === s.u && r.status === 'pendiente');
  body.innerHTML = data.length ? '' : '<tr><td colspan="5">No hay solicitudes pendientes</td></tr>';
  data.forEach(r => {
    const tr = document.createElement('tr');
    const preferredPhone = r.taxista ? driverPhone(r) : '';
    tr.innerHTML = `<td>${esc(r.viajeroNombre || r.viajero)}${contactLine('Tel.', workerPhone(r))}</td><td>${esc(r.domicilio)} - ${esc(r.aeropuerto)}<br>${esc(r.fecha)} ${esc(r.hora)}</td><td>${esc(r.taxistaNombre || 'Sin preferencia')}${contactLine('Tel.', preferredPhone)}</td><td>Pendiente de aceptar</td><td><button class="accept-request" data-id="${r.id}">Aceptar</button></td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('.accept-request').forEach(b => {
    b.onclick = () => acceptRequest(b.dataset.id);
  });
}

function acceptRequest(id) {
  const allReq = requests();
  const r = allReq.find(x => x.id === id);
  if (!r) return;
  const driver = availableDriver(r.fecha, r.hora, '', r.taxista);
  const allTrips = trips();
  const n = {
    id: crypto.randomUUID(),
    empresaId: r.empresaId,
    empresa: r.empresa,
    viajero: r.viajero,
    viajeroNombre: r.viajeroNombre,
    viajeroPhone: r.viajeroPhone || workerPhone(r),
    domicilio: r.domicilio,
    aeropuerto: r.aeropuerto,
    fecha: r.fecha,
    hora: r.hora,
    taxista: driver.user,
    taxistaNombre: driver.name,
    taxistaPhone: driver.phone,
    requestId: r.id,
    cv: true,
    ct: false
  };
  allTrips.push(n);
  r.status = 'aceptada';
  r.tripId = n.id;
  setTrips(allTrips);
  setRequests(allReq);
  push('viajero', r.viajero, 'Solicitud aceptada por organizador.', n.id);
  push('taxista', driver.user, 'Nuevo viaje solicitado por viajero y aceptado por organizador. Confirmar.', n.id);
  render();
}

function card(v, role) {
  const f = role === 'viajero' ? 'cv' : 'ct';
  const confirmLabel = role === 'taxista' ? 'Aceptar viaje' : 'Confirmar';
  const confirm = v[f] ? '<span class="confirmed-label">Confirmado</span>' : `<button class="confirm" data-id="${v.id}" data-f="${f}">${confirmLabel}</button>`;
  const reassign = role === 'taxista'
    ? `<details class="driver-menu"><summary>Asignar a otro conductor</summary><div class="driver-menu-list">${TAXISTAS.filter(t => t.user !== v.taxista).map(t => `<button class="reassign-option" data-id="${v.id}" data-driver="${t.user}" type="button">${t.name}<span>${t.user}</span></button>`).join('')}</div></details>`
    : '';
  const duration = role === 'taxista' && v.ct ? `<p class="muted">Trayecto ${v.duracionMin || '-'} min · ocupado hasta ${v.ocupadoMin ? addMinutes(v.hora, v.ocupadoMin) : '-'}</p>` : '';
  const contact = role === 'viajero'
    ? `<p>${esc(v.taxistaNombre || v.taxista)}${contactLine('Tel. taxista', driverPhone(v))}</p>`
    : `<p>${esc(v.viajeroNombre || v.viajero)}${contactLine('Tel. viajero', workerPhone(v))}</p>`;
  return `<article class="trip"><p><b>${esc(v.domicilio)}</b> - ${esc(v.aeropuerto)}</p><p>${esc(v.fecha)} ${esc(v.hora)} - ${estado(v)}</p>${contact}${duration}<div class="actions">${confirm}<button class="edit-address ghost" data-id="${v.id}" data-role="${role}">Modificar domicilio</button><button class="edit-time ghost" data-id="${v.id}" data-role="${role}">Modificar hora</button></div>${reassign}</article>`;
}

function resetTripConfirmation(t, role) {
  if (role === 'viajero') {
    t.cv = false;
    t.ct = false;
  }
  if (role === 'taxista') t.ct = false;
  delete t.duracionMin;
  delete t.ocupadoMin;
}

function notifyTripEdit(t, role, detail) {
  if (role === 'viajero') {
    push('viajero', t.viajero, `Has modificado ${detail}. Confirma de nuevo la peticion.`, t.id);
    push('taxista', t.taxista, `El viajero ha modificado ${detail}. Debes aceptar de nuevo.`, t.id);
  } else {
    push('taxista', t.taxista, `Has modificado ${detail}. Confirma de nuevo la peticion.`, t.id);
    push('viajero', t.viajero, `Reserva modificada por taxista: ${detail}.`, t.id);
  }
}

function renderMobile(role) {
  const me = session().u;
  const mine = trips().filter(t => t[role] === me).sort((a, b) => tripDate(a) - tripDate(b));
  const l = role === 'viajero' ? 'lista-v' : 'lista-t';
  const nl = role === 'viajero' ? 'notif-v' : 'notif-t';
  if (role === 'viajero') {
    const now = new Date();
    const upcoming = mine.filter(v => tripDate(v) > now);
    const past = mine.filter(v => tripDate(v) <= now).sort((a, b) => tripDate(b) - tripDate(a));
    $('lista-v-next').innerHTML = upcoming.map(v => card(v, role)).join('') || '<p>Sin viajes siguientes</p>';
    $('lista-v-past').innerHTML = past.map(v => card(v, role)).join('') || '<p>Sin viajes pasados</p>';
  } else {
    $(l).innerHTML = mine.map(v => card(v, role)).join('') || '<p>Sin viajes</p>';
  }
  $(nl).innerHTML = notifs().filter(n => n.role === role && n.user === me).map(n => `<li>${n.text}</li>`).join('') || '<li>Sin notificaciones</li>';
  renderMenuBadges();

  document.querySelectorAll('.confirm').forEach(b => b.onclick = () => {
    const all = trips();
    const t = all.find(x => x.id === b.dataset.id);
    if (!t) return;
    if (b.dataset.f === 'ct') {
      openDriverConfirmModal(t);
      return;
    }
    t[b.dataset.f] = true;
    setTrips(all);
    push('viajero', t.viajero, `Estado actualizado ${estado(t)}`, t.id);
    push('taxista', t.taxista, `Estado actualizado ${estado(t)}`, t.id);
    render();
  });

  document.querySelectorAll('.edit-address').forEach(b => b.onclick = () => {
    const all = trips();
    const t = all.find(x => x.id === b.dataset.id);
    if (!t) return;
    const d = prompt('Nuevo domicilio', t.domicilio);
    if (d === null) return;
    t.domicilio = d || t.domicilio;
    resetTripConfirmation(t, b.dataset.role);
    setTrips(all);
    notifyTripEdit(t, b.dataset.role, 'el domicilio');
    render();
  });

  document.querySelectorAll('.edit-time').forEach(b => b.onclick = () => {
    const all = trips();
    const t = all.find(x => x.id === b.dataset.id);
    if (!t) return;
    const h = prompt('Nueva hora (HH:MM)', t.hora);
    if (h === null) return;
    t.hora = h || t.hora;
    resetTripConfirmation(t, b.dataset.role);
    setTrips(all);
    notifyTripEdit(t, b.dataset.role, 'la hora');
    render();
  });

  document.querySelectorAll('.reassign-option').forEach(b => b.onclick = () => {
    reassignTrip(b.dataset.id, b.dataset.driver);
  });

  if (role === 'taxista') {
    renderDriverSchedule();
    renderCalendar();
  }
  if (role === 'viajero') {
    fillRequestForm();
    renderTravelerRequests();
  }
}

function renderTravelerRequests() {
  if (!$('request-list')) return;
  const me = session().u;
  const list = requests().filter(r => r.viajero === me).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $('request-list').innerHTML = list.map(r => `<article class="trip"><p><b>${esc(r.domicilio)}</b> - ${esc(r.aeropuerto)}</p><p>${esc(r.fecha)} ${esc(r.hora)} - ${esc(r.status)}</p><p>Taxista preferido: ${esc(r.taxistaNombre || 'Sin preferencia')}${contactLine('Tel. taxista', driverPhone(r))}</p></article>`).join('') || '<p>Sin solicitudes</p>';
}

function reassignTrip(id, newDriverUser) {
  const driver = driverByUser(newDriverUser);
  if (!driver) return;
  const all = trips();
  const t = all.find(x => x.id === id);
  if (!t) return;
  const previous = t.taxista;
  t.taxista = driver.user;
  t.taxistaNombre = driver.name;
  t.taxistaPhone = driver.phone;
  t.ct = false;
  delete t.duracionMin;
  delete t.ocupadoMin;
  setTrips(all);
  push('taxista', driver.user, `Viaje reasignado por ${previous}. Debes aceptar el viaje.`, t.id);
  render();
}

function renderDriverSchedule() {
  const me = session().u;
  const list = slots().filter(s => s.taxista === me).sort((a, b) => `${a.fecha}${a.inicio}`.localeCompare(`${b.fecha}${b.inicio}`));
  $('driver-slots').innerHTML = list.map(s => `<li><span><b>${esc(s.titulo || 'Evento')}</b><small>${s.fecha} ${s.inicio}-${s.fin}</small></span><button class="delete-slot ghost danger" data-id="${s.id}">Quitar</button></li>`).join('') || '<li>Sin eventos propios</li>';
  document.querySelectorAll('.delete-slot').forEach(b => b.onclick = () => {
    setSlots(slots().filter(s => s.id !== b.dataset.id));
    renderDriverSchedule();
    renderCalendar();
  });
}

function openCalendarEventEditor(fecha, hora, slotId = '') {
  const form = $('calendar-event-editor');
  const slot = slotId ? slots().find(s => s.id === slotId) : null;
  $('event-id').value = slot ? slot.id : '';
  $('event-date').value = slot ? slot.fecha : fecha;
  $('event-start').value = slot ? slot.inicio : hora;
  $('event-end').value = slot ? slot.fin : `${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}:00`;
  $('event-title').value = slot ? (slot.titulo || 'Bloqueado') : '';
  form.classList.remove('hidden');
  $('event-title').focus();
}

function renderCalendar() {
  if (!$('calendar-grid')) return;
  const me = session().u;
  const days = Array.from({ length: 7 }, (_, i) => addDays(activeWeekStart, i));
  const hours = Array.from({ length: 16 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);
  $('week-title').textContent = `Semana ${fmtDate(days[0])} - ${fmtDate(days[6])}`;
  let html = '<div class="calendar-cell calendar-corner">Hora</div>';
  html += days.map(d => `<div class="calendar-cell calendar-day">${d.toLocaleDateString('es-ES', { weekday: 'short' })}<span>${fmtDate(d)}</span></div>`).join('');
  hours.forEach(hour => {
    html += `<div class="calendar-cell calendar-hour">${hour}</div>`;
    days.forEach(day => {
      const fecha = dateKey(day);
      const trip = trips().find(t => t.taxista === me && t.fecha === fecha && overlaps(minutes(hour), minutes(hour) + 60, minutes(t.hora), minutes(t.hora) + Number(t.ocupadoMin || 60)));
      const slot = slots().find(s => s.taxista === me && s.fecha === fecha && overlaps(minutes(hour), minutes(hour) + 60, minutes(s.inicio), minutes(s.fin)));
      const cls = trip ? 'has-trip' : slot ? 'blocked' : 'empty';
      const label = trip ? `${trip.hora}-${addMinutes(trip.hora, trip.ocupadoMin || 60)} ${trip.viajeroNombre || trip.viajero}` : slot ? `${slot.inicio}-${slot.fin} ${slot.titulo || 'Evento'}` : '+ Crear evento';
      html += `<button class="calendar-cell calendar-slot ${cls}" data-fecha="${fecha}" data-hora="${hour}" data-slot-id="${slot ? slot.id : ''}" type="button">${esc(label)}</button>`;
    });
  });
  $('calendar-grid').innerHTML = html;
  document.querySelectorAll('.calendar-slot').forEach(b => {
    b.onclick = () => {
      if (b.dataset.slotId) {
        openCalendarEventEditor(b.dataset.fecha, b.dataset.hora, b.dataset.slotId);
        return;
      }
      if (b.classList.contains('has-trip')) return;
      openCalendarEventEditor(b.dataset.fecha, b.dataset.hora);
    };
  });
}

function updateDriverConfirmPreview() {
  const t = trips().find(x => x.id === pendingDriverConfirmTripId);
  if (!t) return;
  const duration = Number($('confirm-duration').value || 0);
  const until = duration > 0 ? addMinutes(t.hora, duration) : '--:--';
  $('confirm-busy-until').textContent = `Ocupado hasta ${until}`;
  $('confirm-summary').textContent = duration > 0
    ? `Si aceptas este viaje, tu calendario quedara bloqueado de ${t.hora} a ${until}.`
    : 'Introduce una duracion estimada para calcular la ocupacion.';
}

function openDriverConfirmModal(t) {
  pendingDriverConfirmTripId = t.id;
  $('driver-confirm-trip-id').value = t.id;
  $('confirm-origin').textContent = t.domicilio;
  $('confirm-destination').textContent = t.aeropuerto;
  $('confirm-date').textContent = t.fecha;
  $('confirm-time').textContent = t.hora;
  $('confirm-duration').value = t.duracionMin || 30;
  $('driver-confirm-title').textContent = `${t.domicilio} - ${t.aeropuerto}`;
  $('driver-confirm-modal').classList.remove('hidden');
  updateDriverConfirmPreview();
  $('confirm-duration').focus();
}

function closeDriverConfirmModal() {
  pendingDriverConfirmTripId = '';
  $('driver-confirm-modal').classList.add('hidden');
  $('driver-confirm-form').reset();
}

function render() {
  const s = session();
  if (!s) return;
  setView(s.r);
  if (s.r === 'organizador') renderOrg();
  if (s.r === 'viajero') renderMobile('viajero');
  if (s.r === 'taxista') renderMobile('taxista');
}

$('login-form').onsubmit = e => {
  e.preventDefault();
  const u = $('user').value.trim();
  const p = $('pass').value;
  const f = USERS.find(x => x.u === u && x.p === p);
  if (!f) {
    $('auth-msg').textContent = 'Credenciales invalidas';
    return;
  }
  localStorage.setItem(K.session, JSON.stringify(f));
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  render();
};

$('logout').onclick = () => {
  localStorage.removeItem(K.session);
  location.reload();
};

document.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => setOrgTab(b.dataset.tab));
document.querySelectorAll('.driver-tab-btn').forEach(b => b.onclick = () => setDriverTab(b.dataset.driverTab));
document.querySelectorAll('.traveler-tab-btn').forEach(b => b.onclick = () => setTravelerTab(b.dataset.travelerTab));
$('prev-week').onclick = () => {
  activeWeekStart = addDays(activeWeekStart, -7);
  renderCalendar();
};
$('next-week').onclick = () => {
  activeWeekStart = addDays(activeWeekStart, 7);
  renderCalendar();
};
$('cancel-event').onclick = () => {
  $('calendar-event-editor').classList.add('hidden');
  $('calendar-event-editor').reset();
  $('event-id').value = '';
};
$('calendar-event-editor').onsubmit = e => {
  e.preventDefault();
  const me = session().u;
  const id = $('event-id').value;
  const payload = {
    taxista: me,
    fecha: $('event-date').value,
    inicio: $('event-start').value,
    fin: $('event-end').value,
    titulo: $('event-title').value.trim(),
    estado: 'ocupado'
  };
  if (minutes(payload.fin) <= minutes(payload.inicio)) {
    alert('La hora de fin debe ser posterior al inicio.');
    return;
  }
  const all = slots();
  if (id) {
    const i = all.findIndex(s => s.id === id);
    if (i >= 0) all[i] = { ...all[i], ...payload };
  } else {
    all.push({ id: crypto.randomUUID(), ...payload });
  }
  setSlots(all);
  $('calendar-event-editor').reset();
  $('event-id').value = '';
  $('calendar-event-editor').classList.add('hidden');
  renderCalendar();
  renderDriverSchedule();
};
$('confirm-duration').addEventListener('input', updateDriverConfirmPreview);
$('driver-confirm-close').onclick = closeDriverConfirmModal;
$('driver-confirm-cancel').onclick = closeDriverConfirmModal;
$('driver-confirm-form').onsubmit = e => {
  e.preventDefault();
  const all = trips();
  const t = all.find(x => x.id === $('driver-confirm-trip-id').value);
  const duration = Number($('confirm-duration').value);
  if (!t || !duration || duration <= 0) {
    alert('Introduce una duracion estimada valida.');
    return;
  }
  t.duracionMin = duration;
  t.ocupadoMin = duration;
  t.ct = true;
  setTrips(all);
  push('viajero', t.viajero, `El taxista ha aceptado el viaje. Ocupado hasta ${addMinutes(t.hora, duration)}.`, t.id);
  push('taxista', t.taxista, `Has aceptado el viaje. Ocupado hasta ${addMinutes(t.hora, duration)}.`, t.id);
  closeDriverConfirmModal();
  render();
};
['fecha', 'hora'].forEach(id => $(id).addEventListener('change', fillDriverSelect));
$('viajero').addEventListener('change', fillAddressSelect);
$('domicilio').addEventListener('change', () => {
  $('new-address-row').classList.toggle('hidden', $('domicilio').value !== '__new');
});
$('save-address').onclick = () => {
  const user = $('viajero').value;
  const value = $('new-address').value.trim();
  if (!user || !value) return;
  const all = workers();
  const w = all.find(x => x.user === user);
  if (!w.homes.includes(value)) w.homes.push(value);
  setWorkers(all);
  fillAddressSelect();
  $('domicilio').value = value;
  $('new-address').value = '';
};
['f-persona', 'f-taxista', 'f-viaje'].forEach(id => $(id).addEventListener('input', renderHistory));

$('request-form').onsubmit = e => {
  e.preventDefault();
  const worker = workerByUser(session().u);
  if (!worker) return;
  const company = companyFor(worker.company);
  const driver = driverByUser($('request-driver').value);
  const domicilio = $('request-new-home').value.trim() || $('request-home').value;
  const all = requests();
  const r = {
    id: crypto.randomUUID(),
    empresaId: worker.company,
    empresa: company.empresa,
    viajero: worker.user,
    viajeroNombre: worker.name,
    viajeroPhone: worker.phone,
    domicilio,
    aeropuerto: $('request-airport').value.trim(),
    fecha: $('request-date').value,
    hora: $('request-time').value,
    taxista: driver ? driver.user : '',
    taxistaNombre: driver ? driver.name : '',
    taxistaPhone: driver ? driver.phone : '',
    status: 'pendiente',
    createdAt: new Date().toISOString()
  };
  all.push(r);
  setRequests(all);
  push('organizador', worker.company, `Nueva solicitud de viaje de ${worker.name}.`, r.id);
  $('request-form').reset();
  $('request-msg').textContent = 'Solicitud enviada al organizador.';
  fillRequestForm();
  renderTravelerRequests();
};

$('trip-form').onsubmit = e => {
  e.preventDefault();
  const s = session();
  const id = $('trip-id').value;
  const worker = workerByUser($('viajero').value);
  let driver = driverByUser($('taxista').value);
  const domicilio = $('domicilio').value === '__new' ? $('new-address').value.trim() : $('domicilio').value;
  if (!driver) driver = availableDriver($('fecha').value, $('hora').value, id);
  const availability = driverAvailability(driver.user, $('fecha').value, $('hora').value, id);
  if (availability.busy && !confirm(`El taxista figura ocupado: ${availability.reason}. Quieres asignarlo igualmente?`)) return;
  const p = {
    empresaId: s.u,
    empresa: companyFor(s.u).empresa,
    viajero: worker.user,
    viajeroNombre: worker.name,
    viajeroPhone: worker.phone,
    domicilio,
    aeropuerto: $('aeropuerto').value.trim(),
    fecha: $('fecha').value,
    hora: $('hora').value,
    taxista: driver.user,
    taxistaNombre: driver.name,
    taxistaPhone: driver.phone
  };
  const all = trips();
  if (id) {
    const i = all.findIndex(x => x.id === id);
    all[i] = { ...all[i], ...p, cv: false, ct: false };
    delete all[i].duracionMin;
    delete all[i].ocupadoMin;
    push('viajero', p.viajero, 'Reserva modificada por organizador. Reconfirmar.', id);
    push('taxista', p.taxista, 'Reserva modificada por organizador. Reconfirmar.', id);
  } else {
    const n = { id: crypto.randomUUID(), ...p, cv: false, ct: false };
    all.push(n);
    push('viajero', p.viajero, 'Nuevo viaje asignado.', n.id);
    push('taxista', p.taxista, 'Nuevo viaje asignado.', n.id);
  }
  setTrips(all);
  $('trip-form').reset();
  $('trip-id').value = '';
  $('mensaje').textContent = 'Guardado.';
  render();
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
if (session()) {
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  render();
}
