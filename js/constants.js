/* ============================================================
   ARQ-COPY — PLANILLA DE SUELDOS
   js/constants.js
   ============================================================ */

'use strict';

/* ---- CONSTANTES LEGALES ---- */
const SUELDO_BASE       = 1230;            // Sueldo mínimo vigente (S/) — referencia legal y valor por defecto
const SUELDO_BASE_TXT   = 'S/ ' + SUELDO_BASE.toLocaleString('es-PE'); // "S/ 1,230" para etiquetas fijas
const DIAS_MES_BASE     = 30;              // Base legal peruana: 30 días/mes
const HORAS_DIARIAS     = 8;              // Jornada laboral estándar
const VALOR_HORA        = SUELDO_BASE / DIAS_MES_BASE / HORAS_DIARIAS; // S/5.125 (valor hora del mínimo legal)
/**
 * Devuelve el valor hora derivado de un sueldo base arbitrario.
 * No altera las tasas ni las reglas de cálculo (Reglas 1-3, AFP/ONP);
 * solo adapta el divisor cuando el sueldo base varía en el tiempo.
 * @param {number} [sueldoBase=SUELDO_BASE] - sueldo base del período
 * @returns {number} sueldoBase / 30 / 8
 */
function valorHoraPara(sueldoBase = SUELDO_BASE) {
  return sueldoBase / DIAS_MES_BASE / HORAS_DIARIAS;
}
const TASA_EXTRA_25     = 0.25;           // Primeras 2 h.e.
const TASA_EXTRA_35     = 0.35;           // A partir de la 3.ª h.e.
const TASA_AFP          = 0.1137;         // Descuento AFP (11.37%) — solo sobre sueldo base
const TASA_ONP          = 0.13;           // Descuento ONP (13%) — solo sobre sueldo base

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
