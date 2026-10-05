'use strict';

/* ============================================================
   GUARDAR / CARGAR AVANCE
   Persiste en localStorage bajo la clave 'arqcopy_avances'.
   Cada avance incluye: nombre, mes, año, seguro y los valores
   de entrada/salida/almuerzo de cada día.
   ============================================================ */
const STORAGE_KEY = 'arqcopy_avances';

function obtenerAvancesGuardados() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function guardarAvancesEnStorage(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

/* Guarda el estado actual */
function guardarAvance() {
  const { nombre, mes, anio, seguro, diaActivacion } = readState();
  const filas   = document.querySelectorAll('#tbodyDias tr[data-dia]');

  if (!filas.length) {
    mostrarStatus('⚠ Genera los días del mes primero', true);
    return;
  }

  // Capturar valores de cada fila
  const dias = [];
  filas.forEach(fila => {
    const d = parseInt(fila.dataset.dia);
    dias.push({
      dia:      d,
      entrada:  document.getElementById(`entrada_${d}`)?.value  || '',
      salida:   document.getElementById(`salida_${d}`)?.value   || '',
      almuerzo: document.getElementById(`almuerzo_${d}`)?.value || '0',
    });
  });

  // Capturar descuentos adicionales
  const descuentos = [];
  document.querySelectorAll('.descuento-item').forEach(item => {
    const id = item.id.replace('descItem_', '');
    descuentos.push({
      concepto: document.getElementById(`descConcepto_${id}`)?.value || '',
      monto:    document.getElementById(`descMonto_${id}`)?.value   || '0',
    });
  });

  const avance = {
    id:        Date.now(),
    nombre:    nombre || '(Sin nombre)',
    mes,
    anio,
    seguro,
    diaActivacion,
    dias,
    descuentos,
    guardadoEn: new Date().toLocaleString('es-PE'),
  };

  const lista = obtenerAvancesGuardados();
  // Reemplazar si ya existe uno con mismo nombre+mes+año
  const idx = lista.findIndex(a => a.nombre === avance.nombre && a.mes === mes && a.anio === anio);
  if (idx >= 0) {
    lista[idx] = avance;
  } else {
    lista.unshift(avance); // más reciente primero
  }

  guardarAvancesEnStorage(lista);
  mostrarStatus(`✓ Guardado: ${avance.nombre} — ${MESES[mes]} ${anio}`);
}

/* Muestra el mensaje de estado bajo los botones */
function mostrarStatus(msg, esError = false) {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = esError ? 'var(--danger)' : 'var(--success)';
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), 3500);
}

/* Abre el modal con la lista de avances guardados */
function abrirModalCargar() {
  const lista      = obtenerAvancesGuardados();
  const modal      = document.getElementById('modalCargar');
  const contenedor = document.getElementById('listaAvances');

  if (!lista.length) {
    contenedor.innerHTML = `
      <div class="modal-empty">
        <div class="modal-empty-icon">📂</div>
        <p>No hay avances guardados todavía.</p>
      </div>`;
  } else {
    contenedor.innerHTML = lista.map(a => `
      <div class="avance-item" id="avItem_${a.id}">
        <div class="avance-info">
          <span class="avance-nombre">${a.nombre}</span>
          <span class="avance-meta">${MESES[a.mes]} ${a.anio} &nbsp;·&nbsp; ${a.guardadoEn}</span>
        </div>
        <button class="btn-cargar" data-action="cargar-avance" data-id="${a.id}">
          ↩ Cargar
        </button>
        <button class="btn-borrar" data-action="borrar-avance" data-id="${a.id}" title="Eliminar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>`).join('');
  }

  modal.classList.add('abierto');
}

/* Cierra el modal — click en el fondo oscuro o botón X */
function cerrarModalCargar(e) {
  // Si se pasó un evento, solo cerrar si el click fue en el overlay (fondo), no en el box
  if (e && e.target !== document.getElementById('modalCargar')) return;
  document.getElementById('modalCargar').classList.remove('abierto');
}

/* Carga un avance guardado y reconstruye la pantalla */
function cargarAvance(id) {
  const lista  = obtenerAvancesGuardados();
  const avance = lista.find(a => a.id === id);
  if (!avance) return;

  // Restaurar datos del empleado
  document.getElementById('nombreEmpleado').value = avance.nombre !== '(Sin nombre)' ? avance.nombre : '';
  document.getElementById('mes').value            = avance.mes;
  document.getElementById('anio').value           = avance.anio;
  document.getElementById('seguro').value         = avance.seguro;
  const diaActEl = document.getElementById('diaActivacion');
  if (diaActEl) diaActEl.value = avance.diaActivacion ?? 1;
  const diaIniEl2 = document.getElementById('diaInicio');
  if (diaIniEl2) diaIniEl2.value = avance.diaInicio ?? 1;
  actualizarInfoSeguro();

  // Regenerar la tabla de días (crea los inputs)
  generarDias();

  // Restaurar valores fila a fila después de que el DOM esté listo
  requestAnimationFrame(() => {
    avance.dias.forEach(({ dia, entrada, salida, almuerzo }) => {
      const entEl = document.getElementById(`entrada_${dia}`);
      const salEl = document.getElementById(`salida_${dia}`);
      const almEl = document.getElementById(`almuerzo_${dia}`);
      if (!entEl) return;
      entEl.value = entrada;
      salEl.value = salida;
      almEl.value = almuerzo;
      calcularFila(dia);
    });

    // Restaurar descuentos adicionales
    document.getElementById('listaDescuentos').innerHTML = '';
    descuentoIdCounter = 0;
    avance.descuentos?.forEach(({ concepto, monto }) => {
      agregarDescuento();
      const id = descuentoIdCounter;
      const cEl = document.getElementById(`descConcepto_${id}`);
      const mEl = document.getElementById(`descMonto_${id}`);
      if (cEl) cEl.value = concepto;
      if (mEl) mEl.value = monto;
    });
    actualizarTotalDescuentos();

    cerrarModalCargar();
    mostrarStatus(`✓ Cargado: ${avance.nombre} — ${MESES[avance.mes]} ${avance.anio}`);
    document.getElementById('stepAsistencia').scrollIntoView({ behavior: 'smooth' });
  });
}

/* Elimina un avance del storage y refresca el modal */
function borrarAvance(id) {
  const lista    = obtenerAvancesGuardados().filter(a => a.id !== id);
  guardarAvancesEnStorage(lista);
  abrirModalCargar(); // refrescar lista
}

/* ============================================================
   EXPORTAR / IMPORTAR AVANCE (JSON)
   ============================================================ */
function exportarAvance() {
  const { nombre, mes, anio, seguro, diaActivacion, diaInicio } = readState();
  const filas         = document.querySelectorAll('#tbodyDias tr[data-dia]');

  if (!filas.length) {
    mostrarStatus('⚠ Genera los días del mes primero', true);
    return;
  }

  const dias = [];
  filas.forEach(fila => {
    const d = parseInt(fila.dataset.dia);
    if (d < diaInicio) return; // skip días no laborados
    dias.push({
      dia:      d,
      entrada:  document.getElementById('entrada_' + d)?.value  || '',
      salida:   document.getElementById('salida_'  + d)?.value  || '',
      almuerzo: document.getElementById('almuerzo_' + d)?.value || '0',
    });
  });

  const descuentos = [];
  document.querySelectorAll('.descuento-item').forEach(item => {
    const id = item.id.replace('descItem_', '');
    descuentos.push({
      concepto: document.getElementById('descConcepto_' + id)?.value || '',
      monto:    document.getElementById('descMonto_'    + id)?.value || '0',
    });
  });

  const avance = {
    nombre: nombre || '(Sin nombre)',
    mes, anio, seguro, diaActivacion, diaInicio,
    dias, descuentos,
    exportadoEn: new Date().toLocaleString('es-PE'),
  };

  const blob = new Blob([JSON.stringify(avance, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'arqcopy_' + (nombre || 'avance').replace(/\s+/g, '_') + '_' + MESES[mes] + anio + '.json';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  mostrarStatus('✓ Exportado: ' + avance.nombre + ' — ' + MESES[mes] + ' ' + anio);
}

function importarAvance(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    let avance;
    try {
      avance = JSON.parse(e.target.result);
    } catch (err) {
      mostrarStatus('⚠ Archivo inválido', true);
      return;
    }

    document.getElementById('nombreEmpleado').value = avance.nombre !== '(Sin nombre)' ? avance.nombre : '';
    document.getElementById('mes').value            = avance.mes;
    document.getElementById('anio').value           = avance.anio;
    document.getElementById('seguro').value         = avance.seguro;
    const diaActEl = document.getElementById('diaActivacion');
    if (diaActEl) diaActEl.value = avance.diaActivacion != null ? avance.diaActivacion : 1;
    const diaIniEl = document.getElementById('diaInicio');
    if (diaIniEl) diaIniEl.value = avance.diaInicio != null ? avance.diaInicio : 1;
    actualizarInfoSeguro();

    generarDias();

    requestAnimationFrame(function() {
      (avance.dias || []).forEach(function(item) {
        const entEl = document.getElementById('entrada_'  + item.dia);
        const salEl = document.getElementById('salida_'   + item.dia);
        const almEl = document.getElementById('almuerzo_' + item.dia);
        if (!entEl) return;
        entEl.value = item.entrada;
        salEl.value = item.salida;
        almEl.value = item.almuerzo;
        calcularFila(item.dia);
      });

      document.getElementById('listaDescuentos').innerHTML = '';
      descuentoIdCounter = 0;
      (avance.descuentos || []).forEach(function(d) {
        agregarDescuento();
        const id  = descuentoIdCounter;
        const cEl = document.getElementById('descConcepto_' + id);
        const mEl = document.getElementById('descMonto_'    + id);
        if (cEl) cEl.value = d.concepto;
        if (mEl) mEl.value = d.monto;
      });
      actualizarTotalDescuentos();
      mostrarStatus('✓ Importado: ' + avance.nombre + ' — ' + MESES[avance.mes] + ' ' + avance.anio);
      document.getElementById('stepAsistencia').scrollIntoView({ behavior: 'smooth' });
    });
  };
  reader.readAsText(file);
  event.target.value = '';
}
