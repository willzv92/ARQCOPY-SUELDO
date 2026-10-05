'use strict';
/* ============================================================
   Carga de la app real (js/*.js) en un contexto vm de Node,
   con un DOM falso mínimo. Sin dependencias externas: solo
   node:fs, node:path y node:vm.
   ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..', '..');

/* Orden de carga derivado del propio index.html */
function scriptsDeLaApp() {
  const raw = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...raw.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)]
    .map(m => m[1].split('?')[0]);
}

function elemento(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    id: '',
    value: '',
    textContent: '',
    checked: false,
    selected: false,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {},
    remove() {},
    focus() {},
    dispatchEvent() { return true; },
  };
}

/* DOM falso: alcanza para readState(), acumularAsistencia(),
   obtenerTotalesAsistencia(), obtenerResumenEmpleado(),
   calcularSueldo() y obtenerDescuentosAdicionales(). */
function crearDocumento() {
  const campos = new Map();
  const filas = [];       // <tr data-dia>
  const descuentos = [];  // .descuento-item

  const doc = {
    getElementById(id) { return campos.get(id) ?? null; },
    querySelectorAll(sel) {
      if (sel === '#tbodyDias tr[data-dia]') return filas;
      if (sel === '.descuento-item') return descuentos;
      return [];
    },
    querySelector() { return null; },
    createElement(tag) { return elemento(tag); },
    addEventListener() {},
    removeEventListener() {},
    body: { appendChild() {} },
  };

  doc.set = function set(id, valor) {
    let e = campos.get(id);
    if (!e) { e = elemento('input'); e.id = id; campos.set(id, e); }
    e.value = String(valor);
    return e;
  };
  doc.get = function get(id) { return campos.get(id) ?? null; };

  /* Crea la fila de un día con sus tres inputs */
  doc.dia = function dia(n, opciones = {}) {
    const { entrada = '', salida = '', almuerzo = 0 } = opciones;
    const tr = elemento('tr');
    tr.dataset.dia = String(n);
    filas.push(tr);
    doc.set('entrada_' + n, entrada);
    doc.set('salida_' + n, salida);
    doc.set('almuerzo_' + n, almuerzo);
    return tr;
  };
  doc.limpiarDias = function () { filas.length = 0; };

  doc.descuento = function descuento(id, concepto, monto) {
    const item = elemento('div');
    item.id = 'descItem_' + id;
    descuentos.push(item);
    doc.set('descMonto_' + id, monto);
    doc.set('descConcepto_' + id, concepto);
    return item;
  };
  doc.limpiarDescuentos = function () { descuentos.length = 0; };

  return doc;
}

/* Símbolos que el bundle toca durante la carga (js/main.js -> init) */
const ELEMENTOS_BASE = [
  'nombreEmpleado', 'mes', 'anio', 'seguro', 'diaInicio', 'diaActivacion',
  'seguroInfo', 'seguroInfoText', 'grupoDiaActivacion',
  'diaInicioInfo', 'diaInicioInfoText', 'tbodyDias',
];

const EPILOGO = `
globalThis.__app = {
  SUELDO_BASE, DIAS_MES_BASE, HORAS_DIARIAS, VALOR_HORA,
  TASA_EXTRA_25, TASA_EXTRA_35, TASA_AFP, TASA_ONP, MESES, DIAS_SEMANA,
  getDiasEnMes, getDiasHabiles, esFinDeSemana,
  fmtSol, fmtHrs, fmtResumenHoras,
  readState, esDescanso, acumularAsistencia,
  obtenerTotalesAsistencia, obtenerResumenEmpleado,
  calcularSueldo, obtenerDescuentosAdicionales,
};
`;

/**
 * Carga js/*.js en orden dentro de un contexto vm.
 * @param {object} estado - pares id->valor a fijar DESPUÉS del arranque
 * @returns {{doc, app, ctx}}
 */
function cargarApp(estado = {}) {
  const doc = crearDocumento();
  ELEMENTOS_BASE.forEach(id => doc.set(id, ''));

  const sandbox = {
    document: doc,
    console,
    setTimeout, clearTimeout,
    localStorage: {
      _m: new Map(),
      getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
      setItem(k, v) { this._m.set(k, String(v)); },
      removeItem(k) { this._m.delete(k); },
    },
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);

  for (const archivo of scriptsDeLaApp()) {
    const codigo = fs.readFileSync(path.join(ROOT, archivo), 'utf8');
    vm.runInContext(codigo, ctx, { filename: archivo });
  }
  vm.runInContext(EPILOGO, ctx, { filename: '<exports>' });

  // Estado inicial (init() ya corrió y sobrescribió mes/anio)
  const porDefecto = { nombreEmpleado: 'Test', mes: '3', anio: '2026', seguro: 'afp', diaInicio: '1', diaActivacion: '1' };
  for (const [id, v] of Object.entries({ ...porDefecto, ...estado })) doc.set(id, v);

  return { doc, app: ctx.__app, ctx };
}

/**
 * Construye la tabla de un mes completo.
 * @param {object} doc
 * @param {number} mes  índice 0-11
 * @param {number} anio
 * @param {(dia:number, dow:number) => {entrada?:string, salida?:string, almuerzo?:number}|null} fn
 *        devuelve null para dejar el día sin filas (fuera de rango) o
 *        {} para un día vacío/falta.
 */
function llenarTabla(doc, mes, anio, fn) {
  doc.limpiarDias();
  const dias = new Date(anio, mes + 1, 0).getDate();
  for (let d = 1; d <= dias; d++) {
    const dow = new Date(anio, mes, d).getDay();
    const spec = fn(d, dow);
    if (spec === null) continue;
    doc.dia(d, spec || {});
  }
  return doc;
}

module.exports = { cargarApp, llenarTabla, ROOT, scriptsDeLaApp };
