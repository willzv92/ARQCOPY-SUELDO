/* ============================================================
   ARQ-COPY — PLANILLA DE SUELDOS
   NÚCLEO — ASISTENCIA, TOTALES Y RESUMEN
   ============================================================ */

'use strict';

function esDescanso(entrada, salida, almuerzo) {
  // Día de descanso: entrada 12:00am (00:00), salida 08:00am, sin almuerzo
  // Muestra 8h trabajadas pero columna extras = "Descanso"
  return entrada === '00:00' && salida === '08:00' && almuerzo === 0;
}

/* ============================================================
   ÚNICO BARRIDO DE LA TABLA DE ASISTENCIA
   Recorre las filas UNA sola vez y clasifica cada día en uno de
   tres estados:
     'falta'    → sin registro válido (8h de déficit)
     'descanso' → 00:00–08:00 sin almuerzo (8h exactas, sin extras)
     'ok'       → horas reales registradas
   Todas las proyecciones (totales de la tabla, resumen del
   empleado, stats y boleta) se derivan de aquí, de modo que no
   pueden divergir entre sí.
   ============================================================ */
function acumularAsistencia() {
  const { mes, anio, diaInicio } = readState();
  const diasRealesMes = getDiasEnMes(mes, anio);
  const diasLaborales = diasRealesMes - (diaInicio - 1); // días que el empleado debía trabajar
  const horasRegla    = diasLaborales * HORAS_DIARIAS;   // horas "perfectas" del período

  const detalle = [];

  document.querySelectorAll('#tbodyDias tr[data-dia]').forEach(fila => {
    const d = parseInt(fila.dataset.dia);
    if (!d) return;

    // Días previos al inicio laboral → no generan déficit ni horas
    if (d < diaInicio) return;

    const entrada  = document.getElementById(`entrada_${d}`)?.value;
    const salida   = document.getElementById(`salida_${d}`)?.value;
    const almuerzo = parseInt(document.getElementById(`almuerzo_${d}`)?.value) || 0;
    const nombre   = DIAS_SEMANA[new Date(anio, mes, d).getDay()];

    // Día sin registro válido → falta completa → 8h de déficit
    if (!entrada || !salida || entrada >= salida) {
      detalle.push({ dia: d, nombre, estado: 'falta', horas: 0 });
      return;
    }

    // Día de descanso (00:00–08:00, 0 almuerzo) → 8h exactas
    if (esDescanso(entrada, salida, almuerzo)) {
      detalle.push({ dia: d, nombre, estado: 'descanso', horas: HORAS_DIARIAS });
      return;
    }

    const [eh, em] = entrada.split(':').map(Number);
    const [sh, sm] = salida.split(':').map(Number);
    const horas    = Math.max(0, ((sh * 60 + sm) - (eh * 60 + em) - almuerzo) / 60);

    detalle.push({ dia: d, nombre, estado: 'ok', horas });
  });

  return { diasRealesMes, diasLaborales, horasRegla, detalle };
}

/* ============================================================
   OBTENER TOTALES DE LA TABLA
   Regla 1: Cumple 8h todos los días → sueldo base S/1,130 + extras.
   Regla 2: Días faltantes → primero cubrir con horas extras (tramo
            35% primero, luego 25%). Si se cubren → sueldo completo.
   Regla 3: Sin extras o insuficientes → sueldo proporcional a horas
            reales / (díasMes × 8h).
   ============================================================ */
function obtenerTotalesAsistencia(acum) {
  const { diasRealesMes, horasRegla, detalle } = acum || acumularAsistencia();

  let horasTrabajadas  = 0;  // horas brutas reales (incluyendo extras)
  let horasBase        = 0;  // horas base por día, cap 8h/día (para sueldo proporcional)
  let extrasPool_25    = 0;  // h.e. al 25% disponibles antes de compensar
  let extrasPool_35    = 0;  // h.e. al 35% disponibles antes de compensar
  let deficitBruto     = 0;  // horas que faltan para cubrir la jornada

  detalle.forEach(({ estado, horas }) => {
    if (estado === 'falta') {
      deficitBruto += HORAS_DIARIAS;
      return;
    }

    if (estado === 'descanso') {
      horasTrabajadas += HORAS_DIARIAS;
      horasBase       += HORAS_DIARIAS;
      return;
    }

    horasTrabajadas += horas;
    // horasBase cuenta cada día como máximo 8h: las extras NO se suman aquí
    horasBase += Math.min(horas, HORAS_DIARIAS);

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

  // Redondear a 4 decimales para evitar falsos déficits por punto flotante
  const horasNoCubiertas = Math.round(deficitRestante * 10000) / 10000;

  // Extras netas: las que sobran del pool tras compensar el déficit.
  // INVARIANTE: por construcción horasBase + deficitBruto === horasRegla
  // (cada día aporta exactamente HORAS_DIARIAS a uno de los dos acumuladores).
  // Por eso "horasBase >= horasRegla" obliga a déficit nulo y la rama de
  // reclasificación que existía aquí era inalcanzable: se eliminó.
  const totalExtras_25 = extrasPool_25;
  const totalExtras_35 = extrasPool_35;
  const totalExtras    = totalExtras_25 + totalExtras_35;

  // Horas efectivas para el sueldo proporcional (Regla 3).
  // Se usa horasBase (máx. 8h/día) + horas extras usadas para compensar déficit.
  // Así las extras no se cuentan doble: se suman solo en la parte de compensación.
  // Cuando no hay déficit residual se fija en horasRegla.
  const horasEfectivas = horasNoCubiertas > 0
    ? Math.min(horasBase, horasRegla) + (usado_35 + usado_25)
    : horasRegla;

  return {
    diasRealesMes,
    horasRegla,
    horasTrabajadas,
    horasBase,
    horasEfectivas,
    totalExtras,
    totalExtras_25,
    totalExtras_35,
    deficitBruto,
    horasNoCubiertas,
  };
}

/* ============================================================
   OBTENER RESUMEN DEL EMPLEADO (Días trabajados, faltados, horas)
   Proyección derivada del MISMO barrido que obtenerTotalesAsistencia:
   recorre acum.detalle en lugar de volver a interpretar el DOM.
   ============================================================ */
function obtenerResumenEmpleado(acum) {
  const { detalle } = acum || acumularAsistencia();

  // Acumuladores — mismas reglas que obtenerTotalesAsistencia
  let extrasPool_25  = 0;   // h.e. brutas al 25% (antes de compensación)
  let extrasPool_35  = 0;   // h.e. brutas al 35% (antes de compensación)
  let horasDebe      = 0;   // déficit de días con registro parcial (< 8h)
  const diasDebeList = [];  // días sin ningún registro válido

  detalle.forEach(({ dia, nombre, estado, horas }) => {
    // Sin registro válido → falta total (+8h de déficit)
    if (estado === 'falta') {
      diasDebeList.push({ dia, nombre, horas: HORAS_DIARIAS });
      return;
    }

    // Día de descanso → 8h exactas, sin extras ni déficit
    if (estado === 'descanso') return;

    if (horas > HORAS_DIARIAS) {
      // Extras brutas del día: primeras 2h → 25%, resto → 35%
      const extras = horas - HORAS_DIARIAS;
      extrasPool_25 += Math.min(extras, 2);
      extrasPool_35 += Math.max(0, extras - 2);
    } else if (horas < HORAS_DIARIAS) {
      // Déficit parcial → horasDebe (jornada incompleta)
      horasDebe += (HORAS_DIARIAS - horas);
    }
  });

  // Horas a descontar = déficit parcial + días completos sin registro
  const horasDiasDebe   = diasDebeList.reduce((s, d) => s + d.horas, 0);
  const horasADescontar = Math.round((horasDebe + horasDiasDebe) * 10000) / 10000;

  return {
    extrasPool_25,    // brutas al 25% sin descontar déficit
    extrasPool_35,    // brutas al 35% sin descontar déficit
    horasDebe,        // horas faltantes en días con registro parcial
    diasDebeList,     // días sin registro (incluyendo fines de semana sin marcar)
    horasADescontar,  // total a descontar
  };
}
