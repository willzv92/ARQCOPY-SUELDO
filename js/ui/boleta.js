'use strict';

/* ============================================================
   GENERAR BOLETA
   ============================================================ */
function calcularYMostrar() {
  const { nombre: nombreRaw, mes, anio, diaInicio: diaInicioV } = readState();
  const nombre = nombreRaw || 'Empleado Sin Nombre';

  // Un solo barrido de la tabla, compartido por totales y resumen
  const acum = acumularAsistencia();
  const { diasRealesMes, horasRegla, horasTrabajadas, horasEfectivas, totalExtras, totalExtras_25, totalExtras_35, deficitBruto, horasNoCubiertas } = obtenerTotalesAsistencia(acum);
  const s = calcularSueldo(horasEfectivas, horasRegla, totalExtras_25, totalExtras_35, horasNoCubiertas);

  const hoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const resumen = obtenerResumenEmpleado(acum);

  const html = renderBoleta({
    mes, anio, nombre, hoy, s, resumen,
    diasRealesMes, horasRegla, diaInicioV,
    horasEfectivas, horasNoCubiertas, deficitBruto,
  });

  document.getElementById('boletaContainer').innerHTML = html;

  document.getElementById('boletaContainer').scrollIntoView({ behavior: 'smooth' });
}

/* ============================================================
   RENDER DE LA BOLETA DE PAGO
   Presentación pura: recibe los datos ya calculados y devuelve
   el HTML. No lee el DOM ni ejecuta cálculos de negocio.
   ============================================================ */
function renderBoleta({ mes, anio, nombre, hoy, s, resumen,
                        diasRealesMes, horasRegla, diaInicioV,
                        horasEfectivas, horasNoCubiertas, deficitBruto }) {
  // ── Regla 3: sueldo proporcional a horas (horasNoCubiertas > 0)
  // Muestra el desglose: horas efectivas / horas reglamentarias
  const diasLaboralesPeriodo = DIAS_MES_BASE - (diaInicioV - 1);
  const sueldoBaseMaximo     = SUELDO_BASE * (diasLaboralesPeriodo / DIAS_MES_BASE);

  const labelSueldoBase = diaInicioV > 1
    ? `Sueldo Base Proporcional (S/ 1,130 × ${diasLaboralesPeriodo}/${DIAS_MES_BASE} días, desde día ${diaInicioV})`
    : `Sueldo Base Mensual (mes completo)`;

  const rowSueldoBase = horasNoCubiertas > 0
    ? `
      <div class="boleta-row">
        <span class="label">${labelSueldoBase}</span>
        <span class="value">${fmtSol(sueldoBaseMaximo)}</span>
      </div>
      <div class="boleta-row">
        <span class="label">
          Proporcional por horas (${horasEfectivas.toFixed(2)}h / ${horasRegla}h regl.)
        </span>
        <span class="value desc">= ${fmtSol(s.sueldoProporcional)}</span>
      </div>`
    : `
      <div class="boleta-row">
        <span class="label">${labelSueldoBase}</span>
        <span class="value">${fmtSol(sueldoBaseMaximo)}</span>
      </div>`;

  // ── Extras netas
  let rowsExtras = '';
  if (s.extras_25 > 0) {
    rowsExtras += `
      <div class="boleta-row">
        <span class="label">H. Extras al 25% (${fmtHrs(s.extras_25)} × ${fmtSol(s.valorHora * (1 + TASA_EXTRA_25))})</span>
        <span class="value extra">+ ${fmtSol(s.extras_25 * s.valorHora * (1 + TASA_EXTRA_25))}</span>
      </div>`;
  }
  if (s.extras_35 > 0) {
    rowsExtras += `
      <div class="boleta-row">
        <span class="label">H. Extras al 35% (${fmtHrs(s.extras_35)} × ${fmtSol(s.valorHora * (1 + TASA_EXTRA_35))})</span>
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
  

  // ── Ítem: Días Debe (lista detallada de días con falta total)
  const diasDebeDetalle = resumen.diasDebeList.length > 0
    ? resumen.diasDebeList.map(dd => {
        const horasTotalMin = Math.round(dd.horas * 60);
        const hh = String(Math.floor(horasTotalMin / 60)).padStart(2, '0');
        const mm = String(horasTotalMin % 60).padStart(2, '0');
        return `Día ${dd.dia} ${dd.nombre} = ${hh}:${mm} = ${dd.horas.toFixed(2)}h`;
      }).join('<br>')
    : '—';

  const diasDebeHorasTotal = resumen.diasDebeList.reduce((s, d) => s + d.horas, 0);

  // Helper para generar una tarjeta del resumen (funciona en pantalla Y en PDF con tabla)
  function tarjetaResumen(clases, labelColor, label, valueColor, value, note, noteFinal) {
    return `<div class="resumen-item ${clases}" style="border-radius:6px;padding:9px 11px;display:flex;flex-direction:column;gap:3px;border:1.5px solid ${labelColor};background:#fff0f0;">
      <span class="resumen-label" style="font-size:6pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${labelColor};display:block;">${label}</span>
      <span class="resumen-value" style="font-family:'Space Mono',monospace;font-size:8.5pt;font-weight:700;color:${valueColor};line-height:1.5;display:block;">${value}</span>
      <span class="resumen-note" style="font-size:5.5pt;color:#6b82a0;font-style:italic;display:block;">${note}</span>
      ${noteFinal ? `<span style="font-family:'Space Mono',monospace;font-size:6pt;font-weight:700;color:#e74c3c;margin-top:3px;padding-top:3px;border-top:1px dashed #e74c3c;display:block;">${noteFinal}</span>` : ''}
    </div>`;
  }

  // Construir HTML de resumen — usa tabla para máxima compatibilidad en PDF
  const resumenHTML = `
    <!-- RESUMEN DEL EMPLEADO -->
    <div class="boleta-resumen" style="margin-top:16px;padding-top:14px;border-top:1.5px solid #d0dce8;">
      <div class="boleta-section-title" style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#1e2d4a;border-bottom:1px solid #d0dce8;padding-bottom:4px;margin-bottom:10px;">📊 Resumen</div>

      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:6px 6px;">
        <tr>
          <td width="50%" style="vertical-align:top;padding:0;">
            ${tarjetaResumen('resumen-item--extra25','#e74c3c','Horas Extras 25%','#e74c3c',
              resumen.extrasPool_25 > 0 ? fmtResumenHoras(resumen.extrasPool_25) : '00:00 = 0.00h',
              'Brutas, sin descontar déficit', '')}
          </td>
          <td width="50%" style="vertical-align:top;padding:0;">
            ${tarjetaResumen('resumen-item--extra35','#e74c3c','Horas Extras 35%','#e74c3c',
              resumen.extrasPool_35 > 0 ? fmtResumenHoras(resumen.extrasPool_35) : '00:00 = 0.00h',
              'Brutas, sin descontar déficit', '')}
          </td>
        </tr>
        <tr>
          <td width="50%" style="vertical-align:top;padding:0;">
            ${tarjetaResumen('resumen-item--debe','#e74c3c','Horas Debe','#e74c3c',
              resumen.horasDebe > 0 ? fmtResumenHoras(resumen.horasDebe) : '00:00 = 0.00h',
              'Días con jornada incompleta', '')}
          </td>
          <td width="50%" style="vertical-align:top;padding:0;">
            ${tarjetaResumen('resumen-item--diasdebe','#e74c3c','Días Debe','#e74c3c',
              diasDebeDetalle,
              '',
              diasDebeHorasTotal > 0 ? 'Total: ' + fmtResumenHoras(diasDebeHorasTotal) : '')}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="vertical-align:top;padding:0;">
            <div class="resumen-item resumen-item--adescontar" style="border-radius:6px;padding:9px 11px;display:flex;flex-direction:column;gap:3px;border:1.5px solid #27ae60;background:#eafaf1;">
              <span class="resumen-label" style="font-size:6pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#27ae60;display:block;">Horas a Descontar</span>
              <span class="resumen-value" style="font-family:'Space Mono',monospace;font-size:8.5pt;font-weight:700;color:#27ae60;line-height:1.5;display:block;">${fmtResumenHoras(resumen.horasADescontar)}</span>
              <span class="resumen-note" style="font-size:5.5pt;color:#6b82a0;font-style:italic;display:block;">Horas Debe + Días Debe</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;


  return `
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
          Días laborados: ${diasRealesMes - (diaInicioV - 1)} de ${diasRealesMes}${diaInicioV > 1 ? ` (inicio día ${diaInicioV})` : ''} &nbsp;|&nbsp; Horas regl.: ${horasRegla}h
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

      <hr class="boleta-divider" />

      ${resumenHTML}

      <div class="boleta-actions">
        <button class="btn btn-ghost btn-sm" data-action="imprimir">
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
  <link rel="stylesheet" href="css/print.css"/>
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
