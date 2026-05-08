// ============================================================
//  HábitosApp – Frontend (Vanilla JS + fetch)
// ============================================================

const API = '/api';

// ── Helpers ──────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function getUsuario() {
  const u = localStorage.getItem('usuario');
  return u ? JSON.parse(u) : null;
}

function setUsuario(usuario) {
  localStorage.setItem('usuario', JSON.stringify(usuario));
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

function showMsg(id, texto, tipo = 'error') {
  const el = document.getElementById(id);
  el.textContent = texto;
  el.className = tipo === 'ok' ? 'msg-ok' : 'msg-error';
}
function hideMsg(id) {
  const el = document.getElementById(id);
  el.className = 'msg-error hidden';
}

// ── Navegación de vistas ──────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
}

function showTab(tabId, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── AUTH ──────────────────────────────────────────────────────

async function doLogin() {
  hideMsg('login-error');
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showMsg('login-error', 'Completá email y contraseña.');
    return;
  }

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showMsg('login-error', data.error || 'Error al iniciar sesión.');
      return;
    }

    setToken(data.token);
    setUsuario(data.usuario);
    iniciarDashboard();

  } catch (err) {
    showMsg('login-error', 'Error de conexión con el servidor.');
  }
}

async function doRegister() {
  hideMsg('register-error');
  hideMsg('register-ok');
  const nombre   = document.getElementById('reg-nombre').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  if (!nombre || !email || !password) {
    showMsg('register-error', 'Completá todos los campos.');
    return;
  }
  if (password.length < 6) {
    showMsg('register-error', 'La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showMsg('register-error', data.error || 'Error al registrarse.');
      return;
    }

    showMsg('register-ok', '¡Cuenta creada! Ahora podés iniciar sesión.', 'ok');
    setTimeout(() => showView('login'), 1800);

  } catch (err) {
    showMsg('register-error', 'Error de conexión con el servidor.');
  }
}

function doLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  showView('login');
}

// ── DASHBOARD ─────────────────────────────────────────────────

function iniciarDashboard() {
  const u = getUsuario();
  document.getElementById('sidebar-nombre').textContent = u ? u.nombre : '';
  showView('dashboard');
  showTab('tab-habitos', document.querySelector('.nav-btn'));
  cargarHabitos();
  cargarCategorias();
}

// ── HABITOS ───────────────────────────────────────────────────

async function cargarHabitos() {
  hideMsg('msg-dashboard');
  const lista = document.getElementById('lista-habitos');
  lista.innerHTML = '<p class="empty-state">Cargando...</p>';

  try {
    const res  = await fetch(`${API}/habitos`, { headers: authHeaders() });
    const data = await res.json();

    if (!res.ok) {
      showMsg('msg-dashboard', data.error || 'Error al cargar hábitos.');
      lista.innerHTML = '';
      return;
    }

    if (data.length === 0) {
      lista.innerHTML = '<p class="empty-state">No tenés hábitos aún. ¡Creá el primero!</p>';
      return;
    }

    lista.innerHTML = data.map(renderHabitoCard).join('');

  } catch (err) {
    showMsg('msg-dashboard', 'Error de conexión.');
    lista.innerHTML = '';
  }
}

function renderHabitoCard(h) {
  const pct     = Math.min(Math.round((h.dias_completados / h.meta_dias) * 100), 100);
  const lleno   = pct >= 100 ? 'completado' : '';
  const inactivo = !h.activo ? '<span class="badge-inactivo">Inactivo</span>' : '';

  return `
    <div class="habito-card" id="card-${h.id}">
      <div class="habito-card-top">
        <div class="habito-icono-nombre">
          <span class="habito-icono">${h.categoria_icono || '📌'}</span>
          <div>
            <div class="habito-nombre">${escHtml(h.nombre)}</div>
            <div class="habito-categoria">${escHtml(h.categoria_nombre)}</div>
          </div>
        </div>
        ${inactivo}
      </div>

      ${h.descripcion ? `<div class="habito-desc">${escHtml(h.descripcion)}</div>` : ''}

      <div class="progreso-label">
        <span>${h.dias_completados} días completados</span>
        <span>${pct}%</span>
      </div>
      <div class="progreso-bar">
        <div class="progreso-fill ${lleno}" style="width:${pct}%"></div>
      </div>
      <div class="habito-meta">Meta: ${h.meta_dias} días · ${capitalizar(h.frecuencia)}</div>

      <div class="habito-btns">
        ${h.activo
          ? `<button class="btn-sm btn-completar" onclick="completarHabito(${h.id})">✔ Completar hoy</button>`
          : ''}
        <button class="btn-sm btn-editar"    onclick="editarHabito(${h.id})">✏ Editar</button>
        <button class="btn-sm btn-historial" onclick="verHistorial(${h.id}, '${escHtml(h.nombre)}')">📅 Historial</button>
        <button class="btn-sm btn-eliminar"  onclick="eliminarHabito(${h.id})">🗑 Eliminar</button>
      </div>
    </div>`;
}

async function completarHabito(id) {
  try {
    const res  = await fetch(`${API}/habitos/${id}/completar`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ nota: '' })
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error al registrar cumplimiento.');
      return;
    }
    alert(data.mensaje);
    cargarHabitos();
  } catch (err) {
    alert('Error de conexión.');
  }
}

async function eliminarHabito(id) {
  if (!confirm('¿Querés eliminar este hábito? Esta acción no se puede deshacer.')) return;

  try {
    const res  = await fetch(`${API}/habitos/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error al eliminar.');
      return;
    }
    cargarHabitos();
  } catch (err) {
    alert('Error de conexión.');
  }
}

// ── FORMULARIO Crear / Editar ────────────────────────────────

async function cargarCategorias() {
  try {
    const res  = await fetch(`${API}/habitos/categorias`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;

    const sel = document.getElementById('habito-categoria');
    sel.innerHTML = data.map(c =>
      `<option value="${c.id}">${c.icono} ${c.nombre}</option>`
    ).join('');
  } catch (_) {}
}

function mostrarFormNuevo() {
  document.getElementById('habito-id').value          = '';
  document.getElementById('habito-nombre').value      = '';
  document.getElementById('habito-descripcion').value = '';
  document.getElementById('habito-frecuencia').value  = 'diario';
  document.getElementById('habito-meta').value        = '30';
  document.getElementById('habito-fecha').value       = hoy();
  document.getElementById('form-titulo').textContent  = 'Nuevo Hábito';
  hideMsg('form-error');
  hideMsg('form-ok');

  showTab('tab-nuevo', null);
  // Activar botón correcto en sidebar
  document.querySelectorAll('.nav-btn').forEach((b, i) => {
    b.classList.toggle('active', i === 1);
  });
}

async function editarHabito(id) {
  try {
    const res  = await fetch(`${API}/habitos/${id}`, { headers: authHeaders() });
    const h    = await res.json();
    if (!res.ok) { alert(h.error); return; }

    document.getElementById('habito-id').value          = h.id;
    document.getElementById('habito-nombre').value      = h.nombre;
    document.getElementById('habito-descripcion').value = h.descripcion || '';
    document.getElementById('habito-categoria').value   = h.id_categoria;
    document.getElementById('habito-frecuencia').value  = h.frecuencia;
    document.getElementById('habito-meta').value        = h.meta_dias;
    document.getElementById('habito-fecha').value       = h.fecha_inicio;
    document.getElementById('form-titulo').textContent  = 'Editar Hábito';
    hideMsg('form-error');
    hideMsg('form-ok');

    showTab('tab-nuevo', null);
    document.querySelectorAll('.nav-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 1);
    });
  } catch (err) {
    alert('Error de conexión.');
  }
}

async function guardarHabito() {
  hideMsg('form-error');
  hideMsg('form-ok');

  const id          = document.getElementById('habito-id').value;
  const nombre      = document.getElementById('habito-nombre').value.trim();
  const descripcion = document.getElementById('habito-descripcion').value.trim();
  const id_categoria = document.getElementById('habito-categoria').value;
  const frecuencia  = document.getElementById('habito-frecuencia').value;
  const meta_dias   = document.getElementById('habito-meta').value;
  const fecha_inicio = document.getElementById('habito-fecha').value;

  if (!nombre || !id_categoria) {
    showMsg('form-error', 'El nombre y la categoría son obligatorios.');
    return;
  }

  const body = { nombre, descripcion, id_categoria: parseInt(id_categoria),
                 frecuencia, meta_dias: parseInt(meta_dias), fecha_inicio };

  try {
    const url    = id ? `${API}/habitos/${id}` : `${API}/habitos`;
    const method = id ? 'PUT' : 'POST';

    const res  = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      showMsg('form-error', data.error || 'Error al guardar.');
      return;
    }

    showMsg('form-ok', id ? 'Hábito actualizado correctamente.' : 'Hábito creado correctamente.', 'ok');
    setTimeout(() => {
      showTab('tab-habitos', document.querySelector('.nav-btn'));
      cargarHabitos();
    }, 1200);

  } catch (err) {
    showMsg('form-error', 'Error de conexión.');
  }
}

function cancelarForm() {
  showTab('tab-habitos', document.querySelector('.nav-btn'));
}

// ── HISTORIAL ─────────────────────────────────────────────────

async function verHistorial(id, nombre) {
  document.getElementById('modal-titulo').textContent = `Historial: ${nombre}`;
  document.getElementById('modal-body').innerHTML     = '<p class="empty-state">Cargando...</p>';
  document.getElementById('modal-historial').classList.remove('hidden');

  try {
    const res  = await fetch(`${API}/habitos/${id}/registros`, { headers: authHeaders() });
    const data = await res.json();

    if (!res.ok) {
      document.getElementById('modal-body').innerHTML = '<p class="empty-state">Error al cargar.</p>';
      return;
    }

    if (data.length === 0) {
      document.getElementById('modal-body').innerHTML =
        '<p class="empty-state">Sin registros todavía.</p>';
      return;
    }

    document.getElementById('modal-body').innerHTML = data.map(r => `
      <div class="registro-item">
        <div>
          <div class="registro-fecha">${formatFecha(r.fecha)}</div>
          ${r.nota ? `<div class="registro-nota">${escHtml(r.nota)}</div>` : ''}
        </div>
        <span class="registro-ok">✔ Completado</span>
      </div>`).join('');

  } catch (_) {
    document.getElementById('modal-body').innerHTML = '<p class="empty-state">Error de conexión.</p>';
  }
}

function cerrarModal() {
  document.getElementById('modal-historial').classList.add('hidden');
}

// ── Utils ─────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalizar(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function hoy() {
  return new Date().toISOString().split('T')[0];
}

function formatFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Botón "Nuevo Hábito" en sidebar ───────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Redirigir al tab-nuevo cuando se hace click en ➕
  document.querySelectorAll('.nav-btn')[1].addEventListener('click', mostrarFormNuevo);

  // Cerrar modal clickeando fuera
  document.getElementById('modal-historial').addEventListener('click', function (e) {
    if (e.target === this) cerrarModal();
  });

  // Si ya hay token, ir directo al dashboard
  if (getToken()) {
    iniciarDashboard();
  } else {
    showView('login');
  }

  // Valor por defecto para fecha en formulario
  document.getElementById('habito-fecha').value = hoy();
});