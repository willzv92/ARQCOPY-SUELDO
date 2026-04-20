/* ============================================================
   ARQ-COPY — PLANILLA DE SUELDOS
   app.js
   ============================================================ */

'use strict';

/* ---- CONSTANTES LEGALES ---- */
const SUELDO_BASE       = 1130;            // Sueldo mínimo vigente (S/)
const DIAS_MES_BASE     = 30;              // Base legal peruana: 30 días/mes
const HORAS_DIARIAS     = 8;              // Jornada laboral estándar
const VALOR_HORA        = SUELDO_BASE / DIAS_MES_BASE / HORAS_DIARIAS; // S/4.708...
const TASA_EXTRA_25     = 0.25;           // Primeras 2 h.e.
const TASA_EXTRA_35     = 0.35;           // A partir de la 3.ª h.e.
const TASA_AFP          = 0.1137;         // Descuento AFP (11.37%) — solo sobre sueldo base
const TASA_ONP          = 0.13;           // Descuento ONP (13%) — solo sobre sueldo base

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
(function init() {
  // Poblar selector de años
  const selectAnio = document.getElementById('anio');
  for (let y = 2026; y <= 2126; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === 2026) opt.selected = true;
    selectAnio.appendChild(opt);
  }

  // Seleccionar mes actual
  document.getElementById('mes').value = new Date().getMonth();

  // Info seguro inicial
  actualizarInfoSeguro();
})();

/* ============================================================
   HELPERS DE FECHA
   ============================================================ */
function getDiasEnMes(mes, anio) {
  return new Date(anio, mes + 1, 0).getDate();
}

function getDiasHabiles(mes, anio) {
  const total = getDiasEnMes(mes, anio);
  let habiles = 0;
  for (let d = 1; d <= total; d++) {
    const diaSem = new Date(anio, mes, d).getDay();
    if (diaSem !== 0 && diaSem !== 6) habiles++;
  }
  return habiles;
}

function esFinDeSemana(mes, anio, dia) {
  const d = new Date(anio, mes, dia).getDay();
  return d === 0 || d === 6;
}

/* ============================================================
   HELPERS DE FORMATO
   ============================================================ */
function fmtSol(n) {
  return 'S/ ' + n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtHrs(h) {
  return h.toFixed(2) + 'h';
}

/* ============================================================
   INFO DE SEGURO SOCIAL
   ============================================================ */
function actualizarInfoSeguro() {
  const tipo   = document.getElementById('seguro').value;
  const banner = document.getElementById('seguroInfo');
  const texto  = document.getElementById('seguroInfoText');

  if (tipo === 'afp') {
    banner.style.display = 'flex';
    texto.textContent = 'AFP: descuento del 11.37% sobre el sueldo bruto (aportes al fondo de pensiones privado).';
  } else if (tipo === 'onp') {
    banner.style.display = 'flex';
    texto.textContent = 'ONP: descuento del 13% sobre el sueldo bruto (Sistema Nacional de Pensiones).';
  } else {
    banner.style.display = 'none';
  }
}

/* ============================================================
   GENERACIÓN DE DÍAS DEL MES
   ============================================================ */
function generarDias() {
  const mes    = parseInt(document.getElementById('mes').value);
  const anio   = parseInt(document.getElementById('anio').value);
  const total  = getDiasEnMes(mes, anio);

  // Mostrar secciones
  document.getElementById('stepAsistencia').style.display  = 'block';
  document.getElementById('stepDescuentos').style.display  = 'block';
  document.getElementById('stepResumen').style.display     = 'block';
  document.getElementById('btnEjemplo').style.display      = 'inline-flex';

  // Etiqueta del período
  document.getElementById('labelPeriodo').textContent =
    `${MESES[mes]} ${anio} — ${total} días (${getDiasHabiles(mes, anio)} días hábiles)`;

  // Construir filas de la tabla
  const tbody = document.getElementById('tbodyDias');
  tbody.innerHTML = '';

  for (let d = 1; d <= total; d++) {
    const fecha    = new Date(anio, mes, d);
    const diaSem   = fecha.getDay();
    const esFinde  = diaSem === 0 || diaSem === 6;
    const nombreD  = DIAS_SEMANA[diaSem];

    const tr = document.createElement('tr');
    tr.dataset.dia   = d;
    tr.dataset.finde = esFinde;
    if (esFinde) tr.classList.add('weekend');

    tr.innerHTML = `
      <td>
        <div class="day-label">
          <span class="day-num">${d}</span>
          <span class="day-name">${nombreD}</span>
        </div>
      </td>
      <td>
        <input type="time" id="entrada_${d}"
               value="${esFinde ? '' : '08:00'}"
               oninput="onCampoChange(${d})" />
      </td>
      <td>
        <input type="time" id="salida_${d}"
               value="${esFinde ? '' : '18:00'}"
               oninput="onCampoChange(${d})" />
      </td>
      <td>
        <input type="number" class="table-number" id="almuerzo_${d}"
               value="${esFinde ? '0' : '60'}" min="0" max="240"
               oninput="onCampoChange(${d})" />
      </td>
      <td id="horasTrab_${d}">
        <span class="hours-badge badge-absent">—</span>
      </td>
      <td id="horasExtra_${d}">
        <span class="hours-badge badge-extra" style="opacity:0.35;">0h</span>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Calcular todas las filas con valores predeterminados
  for (let d = 1; d <= total; d++) {
    calcularFila(d);
  }

  actualizarStats();
  document.getElementById('stepAsistencia').scrollIntoView({ behavior: 'smooth' });
}

/* ============================================================
   CÁLCULO DE FILA INDIVIDUAL
   ============================================================ */
function esDescanso(entrada, salida, almuerzo) {
  // Día de descanso: entrada 12:00am (00:00), salida 08:00am, sin almuerzo
  // Muestra 8h trabajadas pero columna extras = "Descanso"
  return entrada === '00:00' && salida === '08:00' && almuerzo === 0;
}

function calcularFila(dia) {
  const entrada  = document.getElementById(`entrada_${dia}`)?.value;
  const salida   = document.getElementById(`salida_${dia}`)?.value;
  const almuerzo = parseInt(document.getElementById(`almuerzo_${dia}`)?.value) || 0;

  const celTrab  = document.getElementById(`horasTrab_${dia}`);
  const celExtra = document.getElementById(`horasExtra_${dia}`);
  if (!celTrab || !celExtra) return;

  if (!entrada || !salida || entrada >= salida) {
    celTrab.innerHTML  = `<span class="hours-badge badge-absent">—</span>`;
    celExtra.innerHTML = `<span class="hours-badge badge-absent">—</span>`;
    actualizarStats();
    return;
  }

  // Día de descanso: 8h trabajadas, extras = "Descanso" en verde
  if (esDescanso(entrada, salida, almuerzo)) {
    celTrab.innerHTML  = `<span class="hours-badge badge-normal">8.00h</span>`;
    celExtra.innerHTML = `<span class="hours-badge badge-descanso">Descanso</span>`;
    actualizarStats();
    return;
  }

  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = salida.split(':').map(Number);
  const minutos  = (sh * 60 + sm) - (eh * 60 + em) - almuerzo;
  const horas    = Math.max(0, minutos / 60);
  const extras   = Math.max(0, horas - HORAS_DIARIAS);

  celTrab.innerHTML = `<span class="hours-badge badge-normal">${fmtHrs(horas)}</span>`;
  celExtra.innerHTML = extras > 0
    ? `<span class="hours-badge badge-extra">+${fmtHrs(extras)}</span>`
    : `<span class="hours-badge badge-extra" style="opacity:0.35;">0h</span>`;

  actualizarStats();
}

/* ============================================================
   OBTENER TOTALES DE LA TABLA
   Las horas extras se cortan POR DÍA: primeras 2h → 25%, resto → 35%
   ============================================================ */
function obtenerTotalesAsistencia() {
  const filas = document.querySelectorAll('#tbodyDias tr');
  let diasTrabajados = 0, totalHorasTrab = 0;
  let totalExtras = 0;      // total bruto (para mostrar en stats)
  let totalExtras_25 = 0;   // horas a pagar al 25% (acumulado de todos los días)
  let totalExtras_35 = 0;   // horas a pagar al 35% (acumulado de todos los días)

  filas.forEach(fila => {
    const d = fila.dataset.dia;
    if (!d) return;

    const entrada  = document.getElementById(`entrada_${d}`)?.value;
    const salida   = document.getElementById(`salida_${d}`)?.value;
    const almuerzo = parseInt(document.getElementById(`almuerzo_${d}`)?.value) || 0;

    if (!entrada || !salida || entrada >= salida) return;

    // Día de descanso: cuenta como día trabajado con 8h, sin extras
    if (esDescanso(entrada, salida, almuerzo)) {
      diasTrabajados++;
      totalHorasTrab += HORAS_DIARIAS;
      return;
    }

    const [eh, em] = entrada.split(':').map(Number);
    const [sh, sm] = salida.split(':').map(Number);
    const horas  = Math.max(0, ((sh * 60 + sm) - (eh * 60 + em) - almuerzo) / 60);
    const extras = Math.max(0, horas - HORAS_DIARIAS);

    // Corte diario: primeras 2h extras al 25%, el resto al 35%
    const dia_25 = Math.min(extras, 2);
    const dia_35 = Math.max(0, extras - 2);

    diasTrabajados++;
    totalHorasTrab += horas;
    totalExtras    += extras;
    totalExtras_25 += dia_25;
    totalExtras_35 += dia_35;
  });

  return { diasTrabajados, totalHorasTrab, totalExtras, totalExtras_25, totalExtras_35 };
}

/* ============================================================
   CÁLCULO DE SUELDO
   ============================================================ */
function calcularSueldo(diasTrabajados, totalExtras, totalExtras_25, totalExtras_35) {
  const tipoSeguro = document.getElementById('seguro').value;

  // Sueldo proporcional: base legal 30 días/mes
  const valorDia           = SUELDO_BASE / DIAS_MES_BASE;
  const sueldoProporcional = valorDia * diasTrabajados;

  // Valor hora: S/ 1130 / 30 / 8
  const valorHora = VALOR_HORA;

  // Horas extras ya separadas por día (primeras 2h/día al 25%, resto al 35%)
  const extras_25  = totalExtras_25;
  const extras_35  = totalExtras_35;
  const pagoExtras =
    extras_25 * valorHora * (1 + TASA_EXTRA_25) +
    extras_35 * valorHora * (1 + TASA_EXTRA_35);

  const bruto = sueldoProporcional + pagoExtras;

  // Descuento seguro social: SOLO sobre sueldo proporcional (base), NO sobre extras
  let descuentoSeguro = 0;
  let labelSeguro     = 'No Inscrito';
  let tasaSeguro      = 0;

  if (tipoSeguro === 'afp') {
    tasaSeguro      = TASA_AFP;
    descuentoSeguro = sueldoProporcional * tasaSeguro;
    labelSeguro     = `AFP (${(tasaSeguro * 100).toFixed(2)}%)`;
  } else if (tipoSeguro === 'onp') {
    tasaSeguro      = TASA_ONP;
    descuentoSeguro = sueldoProporcional * tasaSeguro;
    labelSeguro     = `ONP (${(tasaSeguro * 100).toFixed(2)}%)`;
  }

  // Descuentos adicionales
  const descuentosAdicionales = obtenerDescuentosAdicionales();
  const totalDescAdicional    = descuentosAdicionales.reduce((s, d) => s + d.monto, 0);

  const neto = bruto - descuentoSeguro - totalDescAdicional;

  return {
    valorDia,
    sueldoProporcional,
    valorHora,
    extras_25,
    extras_35,
    pagoExtras,
    bruto,
    descuentoSeguro,
    labelSeguro,
    tasaSeguro,
    descuentosAdicionales,
    totalDescAdicional,
    neto
  };
}

/* ============================================================
   STATS (resumen en tiempo real)
   ============================================================ */
function actualizarStats() {
  const statsGrid = document.getElementById('statsGrid');
  if (!statsGrid) return;

  const { diasTrabajados, totalHorasTrab, totalExtras, totalExtras_25, totalExtras_35 } = obtenerTotalesAsistencia();
  const s = calcularSueldo(diasTrabajados, totalExtras, totalExtras_25, totalExtras_35);

  statsGrid.innerHTML = `
    <div class="stat-card">
      <span class="stat-label">Días Trabajados</span>
      <span class="stat-value c-blue">${diasTrabajados}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Valor Hora</span>
      <span class="stat-value c-blue">${fmtSol(VALOR_HORA)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Horas Extras</span>
      <span class="stat-value c-orange">${totalExtras.toFixed(2)}h</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Pago H. Extras</span>
      <span class="stat-value c-orange">${fmtSol(s.pagoExtras)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Sueldo Bruto</span>
      <span class="stat-value">${fmtSol(s.bruto)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Sueldo Neto</span>
      <span class="stat-value c-green">${fmtSol(s.neto)}</span>
    </div>
  `;
}

/* ============================================================
   DESCUENTOS ADICIONALES
   ============================================================ */
let descuentoIdCounter = 0;

function agregarDescuento() {
  const id       = ++descuentoIdCounter;
  const lista    = document.getElementById('listaDescuentos');

  const div = document.createElement('div');
  div.className  = 'descuento-item';
  div.id         = `descItem_${id}`;
  div.innerHTML  = `
    <input type="text" placeholder="Concepto (ej: Adelanto de sueldo, Consumo productos)" id="descConcepto_${id}" />
    <div class="amount-wrap">
      <input type="number" placeholder="0.00" min="0" step="0.01"
             id="descMonto_${id}" oninput="actualizarTotalDescuentos()" />
    </div>
    <button class="btn-remove" onclick="eliminarDescuento(${id})" title="Eliminar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
      </svg>
    </button>
  `;
  lista.appendChild(div);
  actualizarTotalDescuentos();
  document.getElementById(`descConcepto_${id}`).focus();
}

function eliminarDescuento(id) {
  const el = document.getElementById(`descItem_${id}`);
  if (el) el.remove();
  actualizarTotalDescuentos();
}

function obtenerDescuentosAdicionales() {
  const items = document.querySelectorAll('.descuento-item');
  const resultado = [];
  items.forEach(item => {
    const id      = item.id.replace('descItem_', '');
    const monto   = parseFloat(document.getElementById(`descMonto_${id}`)?.value) || 0;
    const concepto = document.getElementById(`descConcepto_${id}`)?.value?.trim() || 'Sin concepto';
    if (monto > 0) resultado.push({ concepto, monto });
  });
  return resultado;
}

function actualizarTotalDescuentos() {
  const lista  = obtenerDescuentosAdicionales();
  const total  = lista.reduce((s, d) => s + d.monto, 0);
  const rowEl  = document.getElementById('descuentoTotalRow');
  const valEl  = document.getElementById('descuentoTotalVal');

  if (rowEl && valEl) {
    rowEl.style.display = lista.length > 0 ? 'flex' : 'none';
    valEl.textContent   = fmtSol(total);
  }

  actualizarStats();
}

/* ============================================================
   GENERAR BOLETA
   ============================================================ */
function calcularYMostrar() {
  const nombre = document.getElementById('nombreEmpleado').value.trim() || 'Empleado Sin Nombre';
  const mes    = parseInt(document.getElementById('mes').value);
  const anio   = parseInt(document.getElementById('anio').value);

  const { diasTrabajados, totalHorasTrab, totalExtras, totalExtras_25, totalExtras_35 } = obtenerTotalesAsistencia();
  const s = calcularSueldo(diasTrabajados, totalExtras, totalExtras_25, totalExtras_35);

  const hoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // Filas de horas extras
  let rowsExtras = '';
  if (s.extras_25 > 0) {
    rowsExtras += `
      <div class="boleta-row">
        <span class="label">
          H. Extras al 25% (${fmtHrs(s.extras_25)} × ${fmtSol(s.valorHora * 1.25)})
        </span>
        <span class="value extra">+ ${fmtSol(s.extras_25 * s.valorHora * (1 + TASA_EXTRA_25))}</span>
      </div>`;
  }
  if (s.extras_35 > 0) {
    rowsExtras += `
      <div class="boleta-row">
        <span class="label">
          H. Extras al 35% (${fmtHrs(s.extras_35)} × ${fmtSol(s.valorHora * 1.35)})
        </span>
        <span class="value extra">+ ${fmtSol(s.extras_35 * s.valorHora * (1 + TASA_EXTRA_35))}</span>
      </div>`;
  }

  let seccionSeguro = '';
  if (s.descuentoSeguro > 0) {
    seccionSeguro = `
      <div class="boleta-row">
        <span class="label">${s.labelSeguro} sobre sueldo base (no aplica a h. extras)</span>
        <span class="value desc">- ${fmtSol(s.descuentoSeguro)}</span>
      </div>`;
  }

  // Descuentos adicionales
  let rowsDescAdicional = '';
  s.descuentosAdicionales.forEach(d => {
    rowsDescAdicional += `
      <div class="boleta-row">
        <span class="label">${d.concepto}</span>
        <span class="value desc">- ${fmtSol(d.monto)}</span>
      </div>`;
  });

  const hayDescuentos = s.descuentoSeguro > 0 || s.totalDescAdicional > 0;

  document.getElementById('boletaContainer').innerHTML = `
    <div class="boleta">

      <div class="boleta-header">
        <div>
          <div class="boleta-brand">Arq<span>-Copy</span></div>
          <div class="boleta-tipo">Boleta de Pago</div>
        </div>
        <div class="boleta-periodo-text">
          Período: ${MESES[mes]} ${anio}<br>
          Emitida: ${hoy}
        </div>
      </div>

      <div class="boleta-empleado">
        <h3>👤 ${nombre}</h3>
        <p>
          Seguro: ${s.labelSeguro}
          &nbsp;|&nbsp;
          Base legal: ${DIAS_MES_BASE} días/mes
          &nbsp;|&nbsp;
          Días trabajados: ${diasTrabajados}
          &nbsp;|&nbsp;
          Valor hora: ${fmtSol(VALOR_HORA)}
        </p>
      </div>

      <!-- INGRESOS -->
      <div style="margin-bottom:20px;">
        <div class="boleta-section-title ingreso">📥 Ingresos</div>

        <div class="boleta-row">
          <span class="label">Sueldo Base Mensual</span>
          <span class="value">${fmtSol(SUELDO_BASE)}</span>
        </div>
        <div class="boleta-row">
          <span class="label">Sueldo Proporcional (${diasTrabajados} días × ${fmtSol(s.valorDia)}/día)</span>
          <span class="value">${fmtSol(s.sueldoProporcional)}</span>
        </div>
        ${rowsExtras}

        <div class="boleta-subtotal">
          <span>Total Ingresos (Bruto)</span>
          <span class="value">${fmtSol(s.bruto)}</span>
        </div>
      </div>

      <!-- DESCUENTOS -->
      ${hayDescuentos ? `
      <div style="margin-bottom:20px;">
        <div class="boleta-section-title descuento">📤 Descuentos</div>
        ${seccionSeguro}
        ${rowsDescAdicional}
        <div class="boleta-subtotal">
          <span>Total Descuentos</span>
          <span class="value" style="color:var(--danger);">- ${fmtSol(s.descuentoSeguro + s.totalDescAdicional)}</span>
        </div>
      </div>` : ''}

      <hr class="boleta-divider" />

      <div class="boleta-total">
        <span class="label">💰 Sueldo Neto a Pagar</span>
        <span class="value">${fmtSol(s.neto)}</span>
      </div>

      <div class="boleta-actions">
        <button class="btn btn-ghost btn-sm" onclick="imprimirBoleta()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Imprimir / Guardar PDF
        </button>
      </div>
    </div>
  `;

  document.getElementById('boletaContainer').scrollIntoView({ behavior: 'smooth' });
}

/* ============================================================
   LLENAR EJEMPLO
   ============================================================ */
function llenarEjemplo() {
  const mes  = parseInt(document.getElementById('mes').value);
  const anio = parseInt(document.getElementById('anio').value);
  const total = getDiasEnMes(mes, anio);

  // Horarios variados para días laborales
  const salidaOpciones = ['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30'];

  for (let d = 1; d <= total; d++) {
    const esFinde = esFinDeSemana(mes, anio, d);

    const entEl = document.getElementById(`entrada_${d}`);
    const salEl = document.getElementById(`salida_${d}`);
    const almEl = document.getElementById(`almuerzo_${d}`);
    if (!entEl) continue;

    if (esFinde) {
      entEl.value = '';
      salEl.value = '';
      almEl.value = '0';
    } else {
      entEl.value = '08:00';
      salEl.value = salidaOpciones[d % salidaOpciones.length];
      almEl.value = '60';
    }
    calcularFila(d);
  }

  if (!document.getElementById('nombreEmpleado').value.trim()) {
    document.getElementById('nombreEmpleado').value = 'Juan Carlos Flores Ríos';
  }

  // Ejemplo de descuentos
  const lista = document.getElementById('listaDescuentos');
  if (lista && lista.children.length === 0) {
    agregarDescuento();
    setTimeout(() => {
      const firstId = descuentoIdCounter;
      const cEl = document.getElementById(`descConcepto_${firstId}`);
      const mEl = document.getElementById(`descMonto_${firstId}`);
      if (cEl) cEl.value = 'Adelanto de sueldo';
      if (mEl) { mEl.value = '150'; actualizarTotalDescuentos(); }
    }, 50);
  }
}

/* ============================================================
   LIMPIAR TODO
   ============================================================ */
function limpiarTodo() {
  if (!confirm('¿Desea limpiar todos los datos ingresados?')) return;

  document.getElementById('nombreEmpleado').value = '';
  document.getElementById('mes').value  = new Date().getMonth();
  document.getElementById('anio').value = 2026;
  document.getElementById('seguro').value = 'ninguno';
  actualizarInfoSeguro();

  document.getElementById('stepAsistencia').style.display  = 'none';
  document.getElementById('stepDescuentos').style.display  = 'none';
  document.getElementById('stepResumen').style.display     = 'none';
  document.getElementById('btnEjemplo').style.display      = 'none';

  document.getElementById('tbodyDias').innerHTML      = '';
  document.getElementById('listaDescuentos').innerHTML = '';
  document.getElementById('boletaContainer').innerHTML = '';
  document.getElementById('statsGrid').innerHTML       = '';

  const totalRow = document.getElementById('descuentoTotalRow');
  if (totalRow) totalRow.style.display = 'none';

  descuentoIdCounter = 0;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   REPLICAR HORARIO A TODOS LOS DÍAS
   ============================================================ */

/**
 * Propaga los valores de un día fuente a todos los demás días.
 * Se llama cuando el usuario cambia cualquier campo de un día
 * mientras el toggle está activo, O cuando activa el toggle.
 * @param {number|null} diaFuente - día que disparó el cambio;
 *   si es null se toma el primer día con entrada definida.
 */
function replicarHorario(diaFuente) {
  const activo = document.getElementById('chkReplica').checked;
  if (!activo) return;

  const filas = Array.from(document.querySelectorAll('#tbodyDias tr[data-dia]'));

  // Determinar día fuente
  let dRef = diaFuente;
  if (!dRef) {
    for (const fila of filas) {
      const d = parseInt(fila.dataset.dia);
      if (document.getElementById(`entrada_${d}`)?.value) { dRef = d; break; }
    }
  }
  if (!dRef) return; // no hay ningún día con datos aún

  const entradaRef  = document.getElementById(`entrada_${dRef}`)?.value  || '';
  const salidaRef   = document.getElementById(`salida_${dRef}`)?.value   || '';
  const almuerzoRef = document.getElementById(`almuerzo_${dRef}`)?.value || '60';

  if (!entradaRef) return;

  filas.forEach(fila => {
    const d = parseInt(fila.dataset.dia);
    if (d === dRef) return; // el fuente ya está calculado
    const entEl = document.getElementById(`entrada_${d}`);
    const salEl = document.getElementById(`salida_${d}`);
    const almEl = document.getElementById(`almuerzo_${d}`);
    if (!entEl) return;
    entEl.value = entradaRef;
    salEl.value = salidaRef;
    almEl.value = almuerzoRef;
    calcularFila(d);
  });
}

/* Se llama desde oninput de cualquier campo de la tabla */
function onCampoChange(dia) {
  calcularFila(dia);
  replicarHorario(dia);
}

/* ============================================================
   IMPRIMIR / GUARDAR PDF
   Usa un iframe oculto dentro de la misma página.
   No requiere ventanas emergentes.
   ============================================================ */
function imprimirBoleta() {
  const boletaEl = document.querySelector('#boletaContainer .boleta');
  if (!boletaEl) { alert('Primero genera la boleta de pago.'); return; }

  // Clonar la boleta y quitar el botón de imprimir
  const clone = boletaEl.cloneNode(true);
  clone.querySelector('.boleta-actions')?.remove();
  const boletaHTML = clone.outerHTML;

  const estilos = `
    @page { size: A4 portrait; margin: 12mm 14mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; background: #fff;
      font-family: 'DM Sans', sans-serif;
      font-size: 10pt; color: #1e2d4a;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .boleta {
      width: 100%; border: 1.5px solid #1e2d4a;
      border-radius: 10px; padding: 10mm 11mm; background: #fff;
    }
    .boleta-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 10px; margin-bottom: 12px; border-bottom: 2px solid #d0dce8;
    }
    .boleta-brand { font-size: 18pt; font-weight: 700; color: #1e2d4a; letter-spacing: -0.03em; }
    .boleta-brand span { color: #f47c51; }
    .boleta-tipo { font-family: 'Space Mono', monospace; font-size: 6.5pt; letter-spacing: 0.14em; color: #6b82a0; text-transform: uppercase; margin-top: 3px; }
    .boleta-periodo-text { font-family: 'Space Mono', monospace; font-size: 7.5pt; color: #6b82a0; text-align: right; line-height: 1.8; }
    .boleta-empleado { background: #f0f4f8; border-radius: 8px; padding: 10px 13px; margin-bottom: 14px; }
    .boleta-empleado h3 { font-size: 12pt; font-weight: 700; color: #1e2d4a; margin-bottom: 4px; }
    .boleta-empleado p { font-size: 7.5pt; color: #6b82a0; line-height: 1.7; }
    .boleta-section-title { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; padding-bottom: 4px; }
    .boleta-section-title.ingreso   { color: #3a8bbf; border-bottom: 1px solid #d0eaf7; }
    .boleta-section-title.descuento { color: #e74c3c; border-bottom: 1px solid #facccc; }
    .boleta-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 5px 0; border-bottom: 1px dashed #e8eef5; }
    .boleta-row:last-child { border-bottom: none; }
    .boleta-row .label { color: #6b82a0; font-size: 9pt; }
    .boleta-row .value { font-family: 'Space Mono', monospace; font-weight: 700; font-size: 9pt; color: #1e2d4a; white-space: nowrap; }
    .boleta-row .value.extra { color: #f47c51; }
    .boleta-row .value.desc  { color: #e74c3c; }
    .boleta-subtotal { display: flex; justify-content: space-between; padding: 8px 0 2px; font-weight: 700; font-size: 9.5pt; border-top: 1.5px solid #d0dce8; margin-top: 4px; }
    .boleta-subtotal .value { font-family: 'Space Mono', monospace; font-size: 9.5pt; }
    .boleta-divider { border: none; border-top: 2px solid #d0dce8; margin: 12px 0; }
    div[style*="margin-bottom:20px"], div[style*="margin-bottom: 20px"] { margin-bottom: 12px !important; }
    .boleta-total { background: #1e2d4a !important; border-radius: 8px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
    .boleta-total .label { color: #5ab4e0 !important; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; }
    .boleta-total .value { font-family: 'Space Mono', monospace; font-size: 15pt; font-weight: 700; color: #fff !important; }
    .boleta-actions { display: none !important; }
  `;

  // Eliminar iframe previo si existe
  const previo = document.getElementById('iframePrint');
  if (previo) previo.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'iframePrint';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Boleta Arq-Copy</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
  <style>${estilos}</style>
</head>
<body>${boletaHTML}</body>
</html>`);
  doc.close();

  // Esperar a que las fuentes carguen, luego imprimir
  iframe.onload = function () {
    const iwin = iframe.contentWindow;
    if (iwin.document.fonts && iwin.document.fonts.ready) {
      iwin.document.fonts.ready.then(function () {
        iwin.focus();
        iwin.print();
      });
    } else {
      setTimeout(function () {
        iwin.focus();
        iwin.print();
      }, 600);
    }
  };
}
