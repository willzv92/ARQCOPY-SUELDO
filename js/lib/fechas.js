'use strict';

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
