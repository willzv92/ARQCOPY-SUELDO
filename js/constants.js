/* ============================================================
   ARQ-COPY — PLANILLA DE SUELDOS
   js/constants.js
   ============================================================ */

'use strict';

/* ---- CONSTANTES LEGALES ---- */
const SUELDO_BASE       = 1230;            // Sueldo mínimo vigente (S/)
const SUELDO_BASE_TXT   = 'S/ ' + SUELDO_BASE.toLocaleString('es-PE'); // "S/ 1,230" para etiquetas fijas
const DIAS_MES_BASE     = 30;              // Base legal peruana: 30 días/mes
const HORAS_DIARIAS     = 8;              // Jornada laboral estándar
const VALOR_HORA        = SUELDO_BASE / DIAS_MES_BASE / HORAS_DIARIAS; // S/5.125...
const TASA_EXTRA_25     = 0.25;           // Primeras 2 h.e.
const TASA_EXTRA_35     = 0.35;           // A partir de la 3.ª h.e.
const TASA_AFP          = 0.1137;         // Descuento AFP (11.37%) — solo sobre sueldo base
const TASA_ONP          = 0.13;           // Descuento ONP (13%) — solo sobre sueldo base

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
