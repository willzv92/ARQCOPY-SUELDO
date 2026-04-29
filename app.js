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
  const tipo        = document.getElementById('seguro').value;
  const banner      = document.getElementById('seguroInfo');
  const texto       = document.getElementById('seguroInfoText');
  const grupodia    = document.getElementById('grupoDiaActivacion');
  const diaEl       = document.getElementById('diaActivacion');

  // Mostrar / ocultar campo de día de activación
  if (tipo !== 'ninguno') {
    grupodia.style.display = 'flex';
  } else {
    grupodia.style.display = 'none';
    banner.style.display   = 'none';
    return;
  }

  const dia   = parseInt(diaEl.value) || 1;
  const tasa  = tipo === 'afp' ? TASA_AFP : TASA_ONP;
  const label = tipo === 'afp' ? 'AFP (11.37%)' : 'ONP (13%)';

  let baseCalculo, descCalc;
  if (dia <= 1) {
    baseCalculo = SUELDO_BASE;
    descCalc    = SUELDO_BASE * tasa;
    banner.style.display = 'flex';
    texto.textContent = `${label}: descuento sobre sueldo base completo S/ 1,130 → descuento = ${fmtSol(descCalc)}.`;
  } else {
    baseCalculo = SUELDO_BASE * ((DIAS_MES_BASE - (dia - 1)) / DIAS_MES_BASE);
    descCalc    = baseCalculo * tasa;
    banner.style.display = 'flex';
    texto.textContent = `${label}: activación día ${dia} → base proporcional = S/ 1,130 × (${DIAS_MES_BASE - (dia - 1)}/${DIAS_MES_BASE}) = ${fmtSol(baseCalculo)} → descuento = ${fmtSol(descCalc)}.`;
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
   Regla 1: Cumple 8h todos los días → sueldo base S/1,130 + extras.
   Regla 2: Días faltantes → primero cubrir con horas extras (tramo
            35% primero, luego 25%). Si se cubren → sueldo completo.
   Regla 3: Sin extras o insuficientes → sueldo proporcional a horas
            reales / (díasMes × 8h).
   ============================================================ */
function obtenerTotalesAsistencia() {
  const mes           = parseInt(document.getElementById('mes').value);
  const anio          = parseInt(document.getElementById('anio').value);
  const diasRealesMes = getDiasEnMes(mes, anio);
  const horasRegla    = diasRealesMes * HORAS_DIARIAS; // horas "perfectas" del mes

  const filas = document.querySelectorAll('#tbodyDias tr[data-dia]');

  let horasTrabajadas  = 0;  // horas reales con registro
  let extrasPool_25    = 0;  // h.e. al 25% disponibles antes de compensar
  let extrasPool_35    = 0;  // h.e. al 35% disponibles antes de compensar
  let deficitBruto     = 0;  // horas que faltan para cubrir la jornada

  filas.forEach(fila => {
    const d = fila.dataset.dia;
    if (!d) return;

    const entrada  = document.getElementById(`entrada_${d}`)?.value;
    const salida   = document.getElementById(`salida_${d}`)?.value;
    const almuerzo = parseInt(document.getElementById(`almuerzo_${d}`)?.value) || 0;

    // Día sin registro válido → falta completa → 8h de déficit
    if (!entrada || !salida || entrada >= salida) {
      deficitBruto += HORAS_DIARIAS;
      return;
    }

    // Día de descanso (00:00–08:00, 0 almuerzo) → 8h exactas
    if (esDescanso(entrada, salida, almuerzo)) {
      horasTrabajadas += HORAS_DIARIAS;
      return;
    }

    const [eh, em] = entrada.split(':').map(Number);
    const [sh, sm] = salida.split(':').map(Number);
    const horas    = Math.max(0, ((sh * 60 + sm) - (eh * 60 + em) - almuerzo) / 60);

    horasTrabajadas += horas;

    if (horas > HORAS_DIARIAS) {
      // Extras del día — corte diario: primeras 2h → 25%, resto → 35%
      const extras = horas - HORAS_DIARIAS;
      extrasPool_25 += Math.min(extras, 2);
      extrasPool_35 += Math.max(0, extras - 2);
    } else if (horas < HORAS_DIARIAS) {
      deficitBruto += (HORAS_DIARIAS - horas);
    }
  });

  // ── COMPENSACIÓN (Regla 2):
  // Las extras cubren el déficit. Orden: tramo 35% primero (más caro),
  // luego tramo 25%. Las horas extras usadas NO se pagan.
  let deficitRestante = deficitBruto;

  const usado_35 = Math.min(deficitRestante, extrasPool_35);
  extrasPool_35   -= usado_35;
  deficitRestante -= usado_35;

  const usado_25 = Math.min(deficitRestante, extrasPool_25);
  extrasPool_25   -= usado_25;
  deficitRestante -= usado_25;

  // Extras netas (las que quedan tras compensar el déficit)
  const totalExtras_25 = extrasPool_25;
  const totalExtras_35 = extrasPool_35;
  const totalExtras    = totalExtras_25 + totalExtras_35;

  // Horas de déficit que las extras NO pudieron cubrir (Regla 3)
  const horasNoCubiertas = deficitRestante;

  // Horas efectivas = trabajadas + extras usadas para compensar
  // (para mostrar en stats, no para el cálculo de sueldo)
  const horasEfectivas = horasTrabajadas + (deficitBruto - horasNoCubiertas);

  return {
    diasRealesMes,
    horasRegla,
    horasTrabajadas,
    horasEfectivas,
    totalExtras,
    totalExtras_25,
    totalExtras_35,
    deficitBruto,
    horasNoCubiertas,
  };
}

/* ============================================================
   CÁLCULO DE SUELDO
   Regla 1: horasNoCubiertas = 0 → sueldo = S/1,130 + extras.
   Regla 2: horasNoCubiertas = 0 (cubiertas por extras) → ídem.
   Regla 3: horasNoCubiertas > 0 → sueldo proporcional a horas
            reales: (horasEfectivas / horasRegla) × 1,130 + extras.
   Seguro AFP/ONP: SIEMPRE sobre S/1,130 fijo.
   ============================================================ */
function calcularSueldo(horasEfectivas, horasRegla, totalExtras_25, totalExtras_35, horasNoCubiertas) {
  const tipoSeguro = document.getElementById('seguro').value;
  const valorHora  = VALOR_HORA; // S/ 1,130 / 30 / 8

  // Sueldo base proporcional
  // - Si no hay déficit residual → S/ 1,130 completo (reglas 1 y 2)
  // - Si hay déficit → proporcional a horas efectivas (regla 3)
  const sueldoProporcional = horasNoCubiertas > 0
    ? (horasEfectivas / horasRegla) * SUELDO_BASE
    : SUELDO_BASE;

  // Pago horas extras netas
  const extras_25  = totalExtras_25;
  const extras_35  = totalExtras_35;
  const pagoExtras =
    extras_25 * valorHora * (1 + TASA_EXTRA_25) +
    extras_35 * valorHora * (1 + TASA_EXTRA_35);

  const bruto = sueldoProporcional + pagoExtras;

  // ── Seguro: base siempre S/ 1,130, pero proporcional si activación ≠ día 1
  let descuentoSeguro = 0;
  let labelSeguro     = 'No Inscrito';
  let tasaSeguro      = 0;
  let baseSeguro      = SUELDO_BASE;          // base sobre la que se aplica el %
  let diaActivacion   = 1;
  let esProporcionado = false;

  if (tipoSeguro === 'afp' || tipoSeguro === 'onp') {
    tasaSeguro    = tipoSeguro === 'afp' ? TASA_AFP : TASA_ONP;
    diaActivacion = parseInt(document.getElementById('diaActivacion')?.value) || 1;

    if (diaActivacion > 1) {
      // Proporcional: S/ 1,130 × (30 − (día − 1)) / 30
      const diasEfectivos = DIAS_MES_BASE - (diaActivacion - 1);
      baseSeguro    = SUELDO_BASE * (diasEfectivos / DIAS_MES_BASE);
      esProporcionado = true;
    }

    descuentoSeguro = baseSeguro * tasaSeguro;

    const pct   = (tasaSeguro * 100).toFixed(2);
    const tipo  = tipoSeguro === 'afp' ? 'AFP' : 'ONP';
    labelSeguro = esProporcionado
      ? `${tipo} (${pct}%) — activación día ${diaActivacion}`
      : `${tipo} (${pct}%)`;
  }

  const descuentosAdicionales = obtenerDescuentosAdicionales();
  const totalDescAdicional    = descuentosAdicionales.reduce((s, d) => s + d.monto, 0);

  const neto = bruto - descuentoSeguro - totalDescAdicional;

  return {
    valorHora,
    sueldoProporcional,
    horasNoCubiertas,
    extras_25,
    extras_35,
    pagoExtras,
    bruto,
    descuentoSeguro,
    labelSeguro,
    tasaSeguro,
    baseSeguro,
    diaActivacion,
    esProporcionado,
    descuentosAdicionales,
    totalDescAdicional,
    neto,
  };
}

/* ============================================================
   STATS (resumen en tiempo real)
   ============================================================ */
function actualizarStats() {
  const statsGrid = document.getElementById('statsGrid');
  if (!statsGrid) return;

  const { diasRealesMes, horasRegla, horasTrabajadas, horasEfectivas, totalExtras, totalExtras_25, totalExtras_35, deficitBruto, horasNoCubiertas } = obtenerTotalesAsistencia();
  const s = calcularSueldo(horasEfectivas, horasRegla, totalExtras_25, totalExtras_35, horasNoCubiertas);

  statsGrid.innerHTML = `
    <div class="stat-card">
      <span class="stat-label">Días del Mes</span>
      <span class="stat-value c-blue">${diasRealesMes}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Valor Hora</span>
      <span class="stat-value c-blue">${fmtSol(VALOR_HORA)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">H. Extras Netas</span>
      <span class="stat-value c-orange">${totalExtras.toFixed(2)}h</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Pago H. Extras</span>
      <span class="stat-value c-orange">${fmtSol(s.pagoExtras)}</span>
    </div>
    ${horasNoCubiertas > 0 ? `
    <div class="stat-card">
      <span class="stat-label">Horas sin cubrir</span>
      <span class="stat-value c-danger">${horasNoCubiertas.toFixed(2)}h</span>
    </div>` : ''}
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

  const { diasRealesMes, horasRegla, horasTrabajadas, horasEfectivas, totalExtras, totalExtras_25, totalExtras_35, deficitBruto, horasNoCubiertas } = obtenerTotalesAsistencia();
  const s = calcularSueldo(horasEfectivas, horasRegla, totalExtras_25, totalExtras_35, horasNoCubiertas);

  const hoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // ── Regla 3: sueldo proporcional a horas (horasNoCubiertas > 0)
  // Muestra el desglose: horas efectivas / horas reglamentarias
  const rowSueldoBase = horasNoCubiertas > 0
    ? `
      <div class="boleta-row">
        <span class="label">Sueldo Base Mensual (S/ 1,130 referencia)</span>
        <span class="value">${fmtSol(SUELDO_BASE)}</span>
      </div>
      <div class="boleta-row">
        <span class="label">
          Proporcional por horas (${horasEfectivas.toFixed(2)}h / ${horasRegla}h regl.)
        </span>
        <span class="value desc">= ${fmtSol(s.sueldoProporcional)}</span>
      </div>`
    : `
      <div class="boleta-row">
        <span class="label">Sueldo Base Mensual (mes completo)</span>
        <span class="value">${fmtSol(SUELDO_BASE)}</span>
      </div>`;

  // ── Extras netas
  let rowsExtras = '';
  if (s.extras_25 > 0) {
    rowsExtras += `
      <div class="boleta-row">
        <span class="label">H. Extras al 25% (${fmtHrs(s.extras_25)} × ${fmtSol(s.valorHora * 1.25)})</span>
        <span class="value extra">+ ${fmtSol(s.extras_25 * s.valorHora * (1 + TASA_EXTRA_25))}</span>
      </div>`;
  }
  if (s.extras_35 > 0) {
    rowsExtras += `
      <div class="boleta-row">
        <span class="label">H. Extras al 35% (${fmtHrs(s.extras_35)} × ${fmtSol(s.valorHora * 1.35)})</span>
        <span class="value extra">+ ${fmtSol(s.extras_35 * s.valorHora * (1 + TASA_EXTRA_35))}</span>
      </div>`;
  }

  // ── Nota de extras usadas para compensar déficit (informativa)
  const horasCompensadas = deficitBruto - horasNoCubiertas;
  const rowCompensacion = horasCompensadas > 0 ? `
      <div class="boleta-row">
        <span class="label" style="color:var(--muted);font-style:italic;">
          H. Extras usadas para cubrir déficit (${fmtHrs(horasCompensadas)}) — no se pagan
        </span>
        <span class="value" style="color:var(--muted);">—</span>
      </div>` : '';

  // ── Seguro
  let seccionSeguro = '';
  if (s.descuentoSeguro > 0) {
    if (s.esProporcionado) {
      const diasEfectivos = DIAS_MES_BASE - (s.diaActivacion - 1);
      seccionSeguro = `
      <div class="boleta-row">
        <span class="label">${s.labelSeguro} — base: S/ 1,130 × (${diasEfectivos}/${DIAS_MES_BASE} días desde día ${s.diaActivacion}) = ${fmtSol(s.baseSeguro)}</span>
        <span class="value desc">- ${fmtSol(s.descuentoSeguro)}</span>
      </div>`;
    } else {
      seccionSeguro = `
      <div class="boleta-row">
        <span class="label">${s.labelSeguro} sobre S/ 1,130 (inscrito desde día 1)</span>
        <span class="value desc">- ${fmtSol(s.descuentoSeguro)}</span>
      </div>`;
    }
  }

  // ── Descuentos adicionales
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
          Días del mes: ${diasRealesMes} &nbsp;|&nbsp; Horas regl.: ${horasRegla}h
          &nbsp;|&nbsp;
          Valor hora: ${fmtSol(VALOR_HORA)}
        </p>
      </div>

      <!-- INGRESOS -->
      <div style="margin-bottom:20px;">
        <div class="boleta-section-title ingreso">📥 Ingresos</div>
        ${rowSueldoBase}
        ${rowCompensacion}
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
  const nombre  = document.getElementById('nombreEmpleado').value.trim();
  const mes     = parseInt(document.getElementById('mes').value);
  const anio    = parseInt(document.getElementById('anio').value);
  const seguro  = document.getElementById('seguro').value;
  const diaActivacion = parseInt(document.getElementById('diaActivacion')?.value) || 1;
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
        <button class="btn-cargar" onclick="cargarAvance(${a.id})">
          ↩ Cargar
        </button>
        <button class="btn-borrar" onclick="borrarAvance(${a.id})" title="Eliminar">
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
