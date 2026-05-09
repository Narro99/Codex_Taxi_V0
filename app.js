const storageKey = 'viajes_taxi_empresa_v2';
const form = document.getElementById('trip-form');
const tabla = document.getElementById('tabla-viajes');
const mensaje = document.getElementById('mensaje');
const filtroEmpresa = document.getElementById('filtro-empresa');
const filtroViajero = document.getElementById('filtro-viajero');
const filtroTaxista = document.getElementById('filtro-taxista');
const listaViajero = document.getElementById('lista-viajero');
const listaTaxista = document.getElementById('lista-taxista');

function viajes() { return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
function save(data) { localStorage.setItem(storageKey, JSON.stringify(data)); }

function renderOrganizador() {
  const f = filtroEmpresa.value.trim().toLowerCase();
  const data = viajes().filter(v => !f || v.empresa.toLowerCase().includes(f));
  tabla.innerHTML = data.length ? '' : '<tr><td colspan="6">Sin viajes.</td></tr>';
  data.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${v.empresa}</td><td>${v.viajero}</td><td>${v.domicilio} → ${v.aeropuerto}</td><td>${v.fecha} ${v.hora}</td><td>${v.taxista}</td><td>${v.estado}</td>`;
    tabla.appendChild(tr);
  });
}

function cardTrip(v, isTaxista=false) {
  const canUpdate = isTaxista && v.estado !== 'Completado';
  return `<article class="trip"><h3>${v.domicilio} → ${v.aeropuerto}</h3><p><b>Empresa:</b> ${v.empresa}</p><p><b>Fecha:</b> ${v.fecha} ${v.hora}</p><p><b>Taxista:</b> ${v.taxista}</p><p><b>Estado:</b> ${v.estado}</p>${canUpdate ? `<button data-id="${v.id}" class="done-btn">Marcar completado</button>` : ''}</article>`;
}

function renderViajero() {
  const f = filtroViajero.value.trim().toLowerCase();
  const data = viajes().filter(v => !f || v.viajero.toLowerCase().includes(f));
  listaViajero.innerHTML = data.map(v => cardTrip(v)).join('') || '<p>Sin viajes para este viajero.</p>';
}

function renderTaxista() {
  const f = filtroTaxista.value.trim().toLowerCase();
  const data = viajes().filter(v => !f || v.taxista.toLowerCase().includes(f));
  listaTaxista.innerHTML = data.map(v => cardTrip(v, true)).join('') || '<p>Sin viajes para este taxista.</p>';
  document.querySelectorAll('.done-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const all = viajes();
      const t = all.find(v => v.id === btn.dataset.id);
      if (t) t.estado = 'Completado';
      save(all);
      renderAll();
    });
  });
}

function renderAll() { renderOrganizador(); renderViajero(); renderTaxista(); }

form.addEventListener('submit', e => {
  e.preventDefault();
  const nuevo = {
    id: crypto.randomUUID(),
    empresa: document.getElementById('empresa').value.trim(),
    viajero: document.getElementById('viajero').value.trim(),
    domicilio: document.getElementById('domicilio').value.trim(),
    aeropuerto: document.getElementById('aeropuerto').value,
    fecha: document.getElementById('fecha').value,
    hora: document.getElementById('hora').value,
    taxista: document.getElementById('taxista').value,
    estado: 'Programado'
  };
  const all = viajes(); all.push(nuevo); save(all);
  form.reset(); mensaje.textContent = 'Viaje creado y visible para viajero/taxista.';
  renderAll();
});

[filtroEmpresa, filtroViajero, filtroTaxista].forEach(el => el.addEventListener('input', renderAll));

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${tab.dataset.view}`).classList.remove('hidden');
  });
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
renderAll();
