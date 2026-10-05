/* ============================================================
   ARQ-COPY — PLANILLA DE SUELDOS
   UI — TABLA DE ASISTENCIA (PASO 2)
   ============================================================ */

'use strict';

function generarDias() {
  const { mes, anio, diaInicio } = readState();
  const total = getDiasEnMes(mes, anio);

  // Mostrar secciones
  document.getElementById('stepAsistencia').style.display  = 'block';
  document.getElementById('stepDescuentos').style.display  = 'block';
  document.getElementById('stepResumen').style.display     = 'block';
  document.getElementById('btnEjemplo').style.display      = 'inline-flex';

  // Etiqueta del período
  const inicioLabel = diaInicio > 1 ? ` — inicio laboral: día ${diaInicio}` : '';
  document.getElementById('labelPeriodo').textContent =
    `${MESES[mes]} ${anio} — ${total} días (${getDiasHabiles(mes, anio)} días hábiles)${inicioLabel}`;

  // Construir filas de la tabla
  const tbody = document.getElementById('tbodyDias');
  tbody.innerHTML = '';

  for (let d = 1; d <= total; d++) {
    const fecha       = new Date(anio, mes, d);
    const diaSem      = fecha.getDay();
    const esFinde     = diaSem === 0 || diaSem === 6;
    const nombreD     = DIAS_SEMANA[diaSem];
    const noLaborado  = d < diaInicio; // días previos al inicio → no se cobran

    const tr = document.createElement('tr');
    tr.dataset.dia       = d;
    tr.dataset.finde     = esFinde;
    tr.dataset.noLaboro  = noLaborado;
    if (esFinde)    tr.classList.add('weekend');
    if (noLaborado) tr.classList.add('no-laborado');

    if (noLaborado) {
      // Fila bloqueada: no tiene inputs editables
      tr.innerHTML = `
        <td>
          <div class="day-label">
            <span class="day-num">${d}</span>
            <span class="day-name">${nombreD}</span>
          </div>
        </td>
        <td colspan="3" style="text-align:center;">
          <span class="hours-badge badge-no-laborado">No laboró</span>
        </td>
        <td id="horasTrab_${d}"><span class="hours-badge badge-no-laborado">—</span></td>
        <td id="horasExtra_${d}"><span class="hours-badge badge-no-laborado">—</span></td>
      `;
    } else {
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
                 data-action="campo-dia" data-dia="${d}" />
        </td>
        <td>
          <input type="time" id="salida_${d}"
                 value="${esFinde ? '' : '18:00'}"
                 data-action="campo-dia" data-dia="${d}" />
        </td>
        <td>
          <input type="number" class="table-number" id="almuerzo_${d}"
                 value="${esFinde ? '0' : '60'}" min="0" max="240"
                 data-action="campo-dia" data-dia="${d}" />
        </td>
        <td id="horasTrab_${d}">
          <span class="hours-badge badge-absent">—</span>
        </td>
        <td id="horasExtra_${d}">
          <span class="hours-badge badge-extra" style="opacity:0.35;">0h</span>
        </td>
      `;
    }
    tbody.appendChild(tr);
  }

  // Calcular solo las filas laborables con valores predeterminados
  for (let d = diaInicio; d <= total; d++) {
    calcularFila(d);
  }

  const acum = acumularAsistencia();
  actualizarTotalesTabla(acum);
  actualizarStats(acum);
  document.getElementById('stepAsistencia').scrollIntoView({ behavior: 'smooth' });
}

/* ============================================================
   CÁLCULO DE FILA INDIVIDUAL
   ============================================================ */
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
   TOTALES AL PIE DE LA TABLA
   Proyección del mismo barrido: horas brutas del mes y extras
   brutas (sin compensar déficit).
   ============================================================ */
function actualizarTotalesTabla(acum) {
  const celTot   = document.getElementById('totalHorasTrab');
  const celExtra = document.getElementById('totalHorasExtra');
  const bar      = document.getElementById('totalesBar');
  if (!celTot || !celExtra || !bar) return;

  const { detalle } = acum || acumularAsistencia();

  let sumTrab  = 0;
  let sumExtra = 0;
  let hayDatos = false;

  detalle.forEach(({ estado, horas }) => {
    if (estado === 'falta') return;
    hayDatos = true;
    sumTrab += horas;
    if (estado === 'ok' && horas > HORAS_DIARIAS) {
      sumExtra += horas - HORAS_DIARIAS;
    }
  });

  if (!hayDatos) { bar.style.display = 'none'; return; }

  bar.style.display  = 'flex';
  celTot.textContent   = fmtHrs(sumTrab);
  celExtra.textContent = sumExtra > 0 ? '+' + fmtHrs(sumExtra) : '0h';
}

/* ============================================================
   STATS (resumen en tiempo real)
   ============================================================ */
function actualizarStats(acum) {
  const statsGrid = document.getElementById('statsGrid');
  if (!statsGrid) return;

  const a = acum || acumularAsistencia();
  actualizarTotalesTabla(a);

  const { diasRealesMes, horasRegla, horasTrabajadas, horasEfectivas, totalExtras, totalExtras_25, totalExtras_35, deficitBruto, horasNoCubiertas } = obtenerTotalesAsistencia(a);
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
  const activo    = document.getElementById('chkReplica').checked;
  if (!activo) return;
  const { diaInicio } = readState();

  const filas = Array.from(document.querySelectorAll('#tbodyDias tr[data-dia]'));

  // Determinar día fuente
  let dRef = diaFuente;
  if (!dRef) {
    for (const fila of filas) {
      const d = parseInt(fila.dataset.dia);
      if (d < diaInicio) continue;
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
    if (d < diaInicio) return; // skip días no laborados
    if (d === dRef) return;
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
