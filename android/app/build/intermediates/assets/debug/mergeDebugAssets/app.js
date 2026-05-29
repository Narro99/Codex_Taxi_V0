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
  { user: 'viajero1', name: 'Laura Martin', company: 'org1', homes: ['Calle Mayor 18, Madrid', 'Paseo de la Castellana 92, Madrid'] },
  { user: 'viajero2', name: 'Diego Salas', company: 'org1', homes: ['Avenida de America 31, Madrid'] },
  { user: 'viajero3', name: 'Marta Echevarria', company: 'org2', homes: ['Calle Ercilla 14, Bilbao'] },
  { user: 'viajero4', name: 'Unai Torres', company: 'org2', homes: ['Paseo de Francia 6, Donostia'] }
];

const TAXISTAS = [
  { user: 'taxi1', name: 'Carlos Ruiz' },
  { user: 'taxi2', name: 'Nerea Vidal' },
  { user: 'taxi3', name: 'Omar Benali' }
];

const K = {
  trips: 'trips_v6',
  notifs: 'notifs_v6',
  session: 'session_v2',
  workers: 'workers_v1',
  slots: 'driver_slots_v1'
};

const $ = id => document.getElementById(id);
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
const session = () => JSON.parse(localStorage.getItem(K.session) || 'null');

function push(role, user, text, id) {
  const n = notifs();
  n.unshift({ role, user, text, id, at: new Date().toISOString() });
  setNotifs(n);
}

function estado(v) {
  return `V:${v.cv ? 'OK' : 'Pendiente'} T:${v.ct ? 'OK' : 'Pendiente'}`;
}

function companyFor(user) {
  return USERS.find(x => x.u === user && x.r === 'organizador');
}

function workerByUser(user) {
  return workers().find(x => x.user === user);
}

function driverByUser(user) {
  return TAXISTAS.find(x => x.user === user);
}

function minutes(hora) {
  const [h, m] = (hora || '00:00').split(':').map(Number);
  return (h * 60) + (m || 0);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function driverAvailability(user, fecha, hora, ignoreTripId = '') {
  if (!user || !fecha || !hora) return { busy: false, reason: 'Elige fecha y hora' };
  const start = minutes(hora);
  const end = start + 60;
  const trip = trips().find(t => t.id !== ignoreTripId && t.taxista === user && t.fecha === fecha && overlaps(start, end, minutes(t.hora), minutes(t.hora) + 60));
  if (trip) return { busy: true, reason: `Ocupado con ${trip.viajeroNombre || trip.viajero}` };
  const slot = slots().find(s => s.taxista === user && s.fecha === fecha && s.estado === 'ocupado' && overlaps(start, end, minutes(s.inicio), minutes(s.fin)));
  if (slot) return { busy: true, reason: `Bloqueado ${slot.inicio}-${slot.fin}` };
  return { busy: false, reason: 'Disponible' };
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
  $('org-historico').classList.toggle('hidden', tab !== 'historico');
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
  $('taxista').innerHTML = '<option value="">Taxista</option>' + TAXISTAS.map(t => {
    const a = driverAvailability(t.user, fecha, hora, editing);
    return `<option value="${t.user}">${t.name} (${t.user}) - ${a.busy ? 'ocupado' : 'libre'}</option>`;
  }).join('');
  renderDriverStatus();
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
  renderOrgTable();
  renderHistory();
}

function renderOrgTable() {
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
    b.onclick = () => {
      const t = trips().find(x => x.id === b.dataset.id);
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
    };
  });
}

function renderHistory() {
  const s = session();
  const persona = $('f-persona').value;
  const taxista = $('f-taxista').value.trim().toLowerCase();
  const viaje = $('f-viaje').value.trim().toLowerCase();
  const body = $('historial');
  const data = trips().filter(t => {
    if (t.empresaId !== s.u) return false;
    if (persona && t.viajero !== persona) return false;
    if (taxista && !`${t.taxista} ${t.taxistaNombre || ''}`.toLowerCase().includes(taxista)) return false;
    const tripText = `${t.id} ${t.domicilio} ${t.aeropuerto} ${t.fecha} ${t.hora}`.toLowerCase();
    return !viaje || tripText.includes(viaje);
  });
  body.innerHTML = data.length ? '' : '<tr><td colspan="5">Sin resultados</td></tr>';
  data.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${v.viajeroNombre || v.viajero}</td><td>${v.taxistaNombre || v.taxista}</td><td>${v.domicilio} - ${v.aeropuerto}</td><td>${v.fecha} ${v.hora}</td><td>${estado(v)}</td>`;
    body.appendChild(tr);
  });
}

function card(v, role) {
  const f = role === 'viajero' ? 'cv' : 'ct';
  return `<article class="trip"><p><b>${v.domicilio}</b> - ${v.aeropuerto}</p><p>${v.fecha} ${v.hora} · ${estado(v)}</p><button class="confirm" data-id="${v.id}" data-f="${f}">Confirmar</button><button class="edit-mobile" data-id="${v.id}" data-role="${role}">Modificar domicilio/hora</button></article>`;
}

function renderMobile(role) {
  const me = session().u;
  const mine = trips().filter(t => t[role] === me);
  const l = role === 'viajero' ? 'lista-v' : 'lista-t';
  const nl = role === 'viajero' ? 'notif-v' : 'notif-t';
  $(l).innerHTML = mine.map(v => card(v, role)).join('') || '<p>Sin viajes</p>';
  $(nl).innerHTML = notifs().filter(n => n.role === role && n.user === me).map(n => `<li>${n.text}</li>`).join('') || '<li>Sin notificaciones</li>';

  document.querySelectorAll('.confirm').forEach(b => b.onclick = () => {
    const all = trips();
    const t = all.find(x => x.id === b.dataset.id);
    if (!t) return;
    t[b.dataset.f] = true;
    setTrips(all);
    push('viajero', t.viajero, `Estado actualizado ${estado(t)}`, t.id);
    push('taxista', t.taxista, `Estado actualizado ${estado(t)}`, t.id);
    render();
  });

  document.querySelectorAll('.edit-mobile').forEach(b => b.onclick = () => {
    const all = trips();
    const t = all.find(x => x.id === b.dataset.id);
    if (!t) return;
    const d = prompt('Nuevo domicilio', t.domicilio);
    if (d === null) return;
    const h = prompt('Nueva hora (HH:MM)', t.hora);
    if (h === null) return;
    t.domicilio = d || t.domicilio;
    t.hora = h || t.hora;
    t.cv = false;
    t.ct = false;
    setTrips(all);
    push('viajero', t.viajero, `Reserva modificada por ${b.dataset.role}. Reconfirmar.`, t.id);
    push('taxista', t.taxista, `Reserva modificada por ${b.dataset.role}. Reconfirmar.`, t.id);
    render();
  });

  if (role === 'taxista') renderDriverSchedule();
}

function renderDriverSchedule() {
  const me = session().u;
  const list = slots().filter(s => s.taxista === me).sort((a, b) => `${a.fecha}${a.inicio}`.localeCompare(`${b.fecha}${b.inicio}`));
  $('driver-slots').innerHTML = list.map(s => `<li><span>${s.fecha} ${s.inicio}-${s.fin}</span><button class="delete-slot" data-id="${s.id}">Quitar</button></li>`).join('') || '<li>Sin franjas bloqueadas</li>';
  document.querySelectorAll('.delete-slot').forEach(b => b.onclick = () => {
    setSlots(slots().filter(s => s.id !== b.dataset.id));
    renderDriverSchedule();
  });
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

$('trip-form').onsubmit = e => {
  e.preventDefault();
  const s = session();
  const id = $('trip-id').value;
  const worker = workerByUser($('viajero').value);
  const driver = driverByUser($('taxista').value);
  const domicilio = $('domicilio').value === '__new' ? $('new-address').value.trim() : $('domicilio').value;
  const availability = driverAvailability($('taxista').value, $('fecha').value, $('hora').value, id);
  if (availability.busy && !confirm(`El taxista figura ocupado: ${availability.reason}. Quieres asignarlo igualmente?`)) return;
  const p = {
    empresaId: s.u,
    empresa: companyFor(s.u).empresa,
    viajero: worker.user,
    viajeroNombre: worker.name,
    domicilio,
    aeropuerto: $('aeropuerto').value.trim(),
    fecha: $('fecha').value,
    hora: $('hora').value,
    taxista: driver.user,
    taxistaNombre: driver.name
  };
  const all = trips();
  if (id) {
    const i = all.findIndex(x => x.id === id);
    all[i] = { ...all[i], ...p, cv: false, ct: false };
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

$('slot-form').onsubmit = e => {
  e.preventDefault();
  const all = slots();
  all.push({
    id: crypto.randomUUID(),
    taxista: session().u,
    fecha: $('slot-fecha').value,
    inicio: $('slot-inicio').value,
    fin: $('slot-fin').value,
    estado: 'ocupado'
  });
  setSlots(all);
  $('slot-form').reset();
  renderDriverSchedule();
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
if (session()) {
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  render();
}
