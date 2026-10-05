'use strict';

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
   HELPERS DE FORMATO PARA EL RESUMEN
   ============================================================ */
// Convierte horas decimales → "hh:mm = h.hh"
function fmtResumenHoras(hDecimal) {
  const totalMin = Math.round(hDecimal * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  const hhStr = String(hh).padStart(2, '0');
  const mmStr = String(mm).padStart(2, '0');
  return `${hhStr}:${mmStr} = ${hDecimal.toFixed(2)}h`;
}
