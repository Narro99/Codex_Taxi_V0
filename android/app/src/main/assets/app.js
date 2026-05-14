const usersKey = 'taxi_users_v1';
const tripsKey = 'taxi_trips_v4';
const notifKey = 'taxi_notifs_v4';
const sessionKey = 'taxi_session_v1';

const seedUsers = [
  { username: 'org1', password: '1234', role: 'organizador', displayName: 'Organizador Demo' },
  { username: 'viajero1', password: '1234', role: 'viajero', displayName: 'viajero1' },
  { username: 'taxi1', password: '1234', role: 'taxista', displayName: 'taxi1' }
];

const byId = (id) => document.getElementById(id);
const read = (k, d = []) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function ensureSeed() { if (!localStorage.getItem(usersKey)) write(usersKey, seedUsers); }
function currentUser() { return JSON.parse(localStorage.getItem(sessionKey) || 'null'); }
function setSession(u) { localStorage.setItem(sessionKey, JSON.stringify(u)); }
function clearSession() { localStorage.removeItem(sessionKey); }

function trips() { return read(tripsKey, []); }
function saveTrips(v) { write(tripsKey, v); }
function notifs() { return read(notifKey, []); }
function saveNotifs(v) { write(notifKey, v); }

function pushNotif(role, user, text, tripId) {
  const all = notifs();
  all.unshift({ id: crypto.randomUUID(), role, user, text, tripId, date: new Date().toISOString() });
  saveNotifs(all);
}

function estado(v) { return `Viajero: ${v.confirmacionViajero ? '✅' : '⏳'} · Taxista: ${v.confirmacionTaxista ? '✅' : '⏳'}`; }

function renderOrganizer() {
  const filtro = byId('filtro-empresa').value.trim().toLowerCase();
  const tabla = byId('tabla-viajes');
  const data = trips().filter(t => !filtro || t.empresa.toLowerCase().includes(filtro));
  tabla.innerHTML = data.length ? '' : '<tr><td colspan="7">Sin viajes.</td></tr>';
  data.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${v.empresa}</td><td>${v.viajero}</td><td>${v.domicilio} → ${v.aeropuerto}</td><td>${v.fecha} ${v.hora}</td><td>${v.taxista}</td><td>${estado(v)}</td><td><button class="edit-btn" data-id="${v.id}">Modificar</button></td>`;
    tabla.appendChild(tr);
  });
  document.querySelectorAll('.edit-btn').forEach(b => b.onclick = () => loadTrip(b.dataset.id));
}

function tripCard(v, role) {
  const f = role === 'viajero' ? 'confirmacionViajero' : 'confirmacionTaxista';
  const already = v[f];
  return `<article class="trip"><h3>${v.domicilio} → ${v.aeropuerto}</h3><p><b>Empresa:</b> ${v.empresa}</p><p><b>Fecha:</b> ${v.fecha} ${v.hora}</p><p><b>Viajero:</b> ${v.viajero}</p><p><b>Taxista:</b> ${v.taxista}</p><p><b>Estado:</b> ${estado(v)}</p>${already ? '<p>Ya confirmaste.</p>' : `<button class="confirm-btn" data-id="${v.id}" data-field="${f}">Confirmar viaje</button>`}</article>`;
}

function renderMobile(role, user) {
  const key = role === 'viajero' ? 'viajero' : 'taxista';
  const listId = role === 'viajero' ? 'lista-viajero' : 'lista-taxista';
  const notifId = role === 'viajero' ? 'notif-viajero' : 'notif-taxista';
  const mine = trips().filter(v => (v[key] || '').toLowerCase() === user.displayName.toLowerCase());
  byId(listId).innerHTML = mine.map(v => tripCard(v, role)).join('') || '<p>No tienes viajes.</p>';

  const n = notifs().filter(x => x.role === role && x.user.toLowerCase() === user.displayName.toLowerCase());
  byId(notifId).innerHTML = n.map(x => `<li>${x.text}</li>`).join('') || '<li>Sin notificaciones.</li>';
}

function bindConfirm() {
  document.querySelectorAll('.confirm-btn').forEach(btn => btn.onclick = () => {
    const all = trips();
    const t = all.find(x => x.id === btn.dataset.id);
    if (!t) return;
    t[btn.dataset.field] = true;
    saveTrips(all);
    pushNotif('viajero', t.viajero, `Estado actualizado: ${estado(t)}.`, t.id);
    pushNotif('taxista', t.taxista, `Estado actualizado: ${estado(t)}.`, t.id);
    renderApp();
  });
}

function loadTrip(id) {
  const t = trips().find(x => x.id === id); if (!t) return;
  ['empresa','viajero','domicilio','aeropuerto','fecha','hora','taxista'].forEach(k => byId(k).value = t[k]);
  byId('trip-id').value = t.id;
  byId('mensaje').textContent = 'Editando reserva. Al guardar se notifica y se reinician confirmaciones.';
}

function saveFromForm() {
  const id = byId('trip-id').value;
  const payload = { empresa: byId('empresa').value.trim(), viajero: byId('viajero').value.trim(), domicilio: byId('domicilio').value.trim(), aeropuerto: byId('aeropuerto').value, fecha: byId('fecha').value, hora: byId('hora').value, taxista: byId('taxista').value };
  const all = trips();
  if (id) {
    const i = all.findIndex(x => x.id === id);
    all[i] = { ...all[i], ...payload, confirmacionViajero: false, confirmacionTaxista: false };
    saveTrips(all);
    pushNotif('viajero', payload.viajero, `Reserva modificada (${payload.fecha} ${payload.hora}). Debes reconfirmar.`, id);
    pushNotif('taxista', payload.taxista, `Reserva modificada (${payload.fecha} ${payload.hora}). Debes reconfirmar.`, id);
    byId('mensaje').textContent = 'Reserva modificada y notificaciones enviadas.';
  } else {
    const n = { id: crypto.randomUUID(), ...payload, confirmacionViajero: false, confirmacionTaxista: false };
    all.push(n); saveTrips(all);
    pushNotif('viajero', payload.viajero, `Nuevo viaje asignado (${payload.fecha} ${payload.hora}).`, n.id);
    pushNotif('taxista', payload.taxista, `Nuevo viaje asignado (${payload.fecha} ${payload.hora}).`, n.id);
    byId('mensaje').textContent = 'Viaje creado y notificaciones enviadas.';
  }
  byId('trip-form').reset(); byId('trip-id').value = '';
  renderApp();
}

function setView(role) {
  ['organizador','viajero','taxista'].forEach(r => byId(`view-${r}`).classList.add('hidden'));
  byId(`view-${role}`).classList.remove('hidden');
}

function renderApp() {
  const user = currentUser();
  if (!user) return;
  byId('session-title').textContent = `${user.role.toUpperCase()} · ${user.displayName}`;
  setView(user.role);
  if (user.role === 'organizador') renderOrganizer(); else renderMobile(user.role, user);
  bindConfirm();
}

function initAuth() {
  byId('login-form').onsubmit = (e) => {
    e.preventDefault();
    const u = byId('login-user').value.trim();
    const p = byId('login-pass').value;
    const user = read(usersKey).find(x => x.username === u && x.password === p);
    if (!user) { byId('login-msg').textContent = 'Credenciales inválidas.'; return; }
    setSession(user); byId('login-msg').textContent = '';
    byId('auth-card').classList.add('hidden'); byId('app-card').classList.remove('hidden');
    renderApp();
  };
  byId('logout-btn').onclick = () => { clearSession(); location.reload(); };
}

function initEvents() {
  byId('trip-form').onsubmit = (e) => { e.preventDefault(); saveFromForm(); };
  byId('filtro-empresa').oninput = renderApp;
}

ensureSeed();
initAuth();
initEvents();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
const user = currentUser();
if (user) { byId('auth-card').classList.add('hidden'); byId('app-card').classList.remove('hidden'); renderApp(); }
