#!/usr/bin/env node
/* ============================================================
   FASE 0 — GOLDEN MASTER
   Captura (o verifica) el comportamiento completo de la app
   bajo jsdom para garantizar que ningún refactor cambia los
   resultados finales.

   Uso:
     node tests/harness/golden.js --capture   (reescribe fixtures)
     node tests/harness/golden.js --verify    (compara y sale con 1 si hay diff)
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(__dirname, '..', 'fixtures', 'golden.json');

/* ------------------------------------------------------------
   NORMALIZACIÓN — elimina todo lo no determinista
   ------------------------------------------------------------ */
function normalize(html) {
  return String(html)
    .replace(/Emitida:\s*[^<]*/g, 'Emitida: <FECHA>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------
   CONSTRUCCIÓN DE LA APP EN jsdom
   ------------------------------------------------------------ */
function createApp() {
  const raw = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // Orden de carga derivado del propio index.html (scripts clásicos).
  const scriptSrcs = [...raw.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)]
    .map(m => m[1]);

  const html = raw
    .replace(/<script src="js\/[^"]+"><\/script>/g, '')
    .replace(/<link[^>]+fonts\.[^>]+>/g, '');

  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {}); // window.print / fonts no implementados
  vc.on('error', () => {});
  vc.on('warn', () => {});

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    virtualConsole: vc,
  });

  const w = dom.window;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = () => {};
  w.alert = () => {};
  w.confirm = () => true;

  for (const src of scriptSrcs) {
    const file = path.join(ROOT, src.split('?')[0]);
    const script = w.document.createElement('script');
    script.textContent = fs.readFileSync(file, 'utf8');
    w.document.body.appendChild(script);
  }

  if (typeof w.generarDias !== 'function') {
    throw new Error('No se pudieron exponer las funciones de js/*.js en el DOM');
  }
  if (typeof w.calcularYMostrar !== 'function') {
    throw new Error('js/main.js no se cargó (ACCIONES/arranque ausente)');
  }
  return dom;
}

/* ------------------------------------------------------------
   HELPERS DE CONFIGURACIÓN
   ------------------------------------------------------------ */
function setVal(w, id, v) {
  const el = w.document.getElementById(id);
  if (el) el.value = v;
}

function getVal(w, id) {
  const el = w.document.getElementById(id);
  return el ? el.value : null;
}

function totalDias(mes, anio) {
  return new Date(anio, mes + 1, 0).getDate();
}

function diaSemana(mes, anio, d) {
  return new Date(anio, mes, d).getDay();
}

/** Aplica una función-patrón (d, diaSemana) -> [ent, sal, alm] | null */
function aplicarPatron(w, def, fn) {
  const total = totalDias(def.mes, def.anio);
  for (let d = 1; d <= total; d++) {
    const ent = w.document.getElementById('entrada_' + d);
    if (!ent) continue; // fila "No laboró"
    const sal = w.document.getElementById('salida_' + d);
    const alm = w.document.getElementById('almuerzo_' + d);
    const spec = fn(d, diaSemana(def.mes, def.anio, d));
    if (!spec) {
      ent.value = '';
      sal.value = '';
      alm.value = '0';
    } else {
      ent.value = spec[0];
      sal.value = spec[1];
      alm.value = String(spec[2]);
    }
    w.calcularFila(d);
  }
}

/**
 * Calcula el horario de un día según la configuración del escenario.
 * `finDeSemana`: 'descanso' (00:00–08:00, 8h pagadas) | 'vacio' | función
 */
function horarioDia(def, d, ds) {
  const cfg = def.dias || {};
  const sobresale = cfg.sobresale || {};
  const excepciones = new Set(cfg.excepto || []);

  if (sobresale[d]) return sobresale[d](d, ds);
  if (excepciones.has(d)) return PATRONES.falta();
  if (esLaboral(ds)) return (cfg.laborables || PATRONES.ochoHoras)(d, ds);

  const fd = cfg.finDeSemana || 'vacio';
  if (fd === 'descanso') return PATRONES.descanso();
  if (fd === 'vacio') return PATRONES.falta();
  return fd(d, ds);
}

function agregarDescuento(w, concepto, monto) {
  w.agregarDescuento();
  const items = w.document.querySelectorAll('.descuento-item');
  const id = items[items.length - 1].id.replace('descItem_', '');
  w.document.getElementById('descConcepto_' + id).value = concepto;
  w.document.getElementById('descMonto_' + id).value = String(monto);
  w.actualizarTotalDescuentos();
}

/* ------------------------------------------------------------
   PATRONES DE JORNADA
   ------------------------------------------------------------ */
const esLaboral = (ds) => ds !== 0 && ds !== 6;

const PATRONES = {
  // 8h exactas: 08:00→17:00 menos 60 min de almuerzo
  ochoHoras: () => ['08:00', '17:00', 60],
  // 10h - 1h almuerzo = 9h → 1h extra (25%)
  extraCorta: () => ['08:00', '19:00', 60],
  // 13h - 1h almuerzo = 12h → 2h@25% + 2h@35%
  extraLarga: () => ['08:00', '21:00', 60],
  // Día de descanso legal: 00:00→08:00 sin almuerzo
  descanso: () => ['00:00', '08:00', 0],
  // Sin registro
  falta: () => null,
};

/* ------------------------------------------------------------
   ESCENARIOS
   ------------------------------------------------------------ */
function escenarios() {
  const base = { anio: 2026, diaInicio: 1, seguro: 'ninguno', diaActivacion: 1 };

  return [
    {
      id: '01-regla1-jornada-8h-afp',
      ...base,
      mes: 3,
      seguro: 'afp',
      nombre: 'Escenario Uno AFP',
      dias: { laborables: PATRONES.ochoHoras, finDeSemana: 'descanso' },
    },
    {
      id: '02-regla1-jornada-8h-onp',
      ...base,
      mes: 3,
      seguro: 'onp',
      nombre: 'Escenario Dos ONP',
      dias: { laborables: PATRONES.ochoHoras, finDeSemana: 'descanso' },
    },
    {
      id: '03-regla1-jornada-8h-sin-seguro',
      ...base,
      mes: 3,
      nombre: 'Escenario Tres Sin Seguro',
      dias: { laborables: PATRONES.ochoHoras, finDeSemana: 'descanso' },
    },
    {
      id: '04-extras-solo-25',
      ...base,
      mes: 3,
      seguro: 'afp',
      nombre: 'Escenario Cuatro Extras 25',
      dias: { laborables: PATRONES.extraCorta, finDeSemana: 'descanso' },
    },
    {
      id: '05-extras-25-y-35',
      ...base,
      mes: 3,
      seguro: 'afp',
      nombre: 'Escenario Cinco Extras 25 y 35',
      dias: { laborables: PATRONES.extraLarga, finDeSemana: 'descanso' },
    },
    {
      id: '06-regla3-faltas-totales',
      ...base,
      mes: 3,
      seguro: 'afp',
      nombre: 'Escenario Seis Faltas',
      dias: {
        laborables: PATRONES.ochoHoras,
        finDeSemana: 'descanso',
        excepto: [6, 13, 20, 27], // 4 lunes sin registro → 32h de déficit
      },
    },
    {
      id: '07-regla2-compensacion-extras',
      ...base,
      mes: 3,
      seguro: 'afp',
      nombre: 'Escenario Siete Compensación',
      dias: {
        laborables: PATRONES.ochoHoras,
        finDeSemana: 'descanso',
        excepto: [6, 13, 20], // 24h de déficit
        // 8 días con 12h → 32h de extras que cubren el déficit y sobran 8h@25%
        sobresale: {
          7: PATRONES.extraLarga,
          8: PATRONES.extraLarga,
          9: PATRONES.extraLarga,
          14: PATRONES.extraLarga,
          15: PATRONES.extraLarga,
          16: PATRONES.extraLarga,
          21: PATRONES.extraLarga,
          22: PATRONES.extraLarga,
        },
      },
    },
    {
      id: '08-inicio-dia-15-proporcional',
      ...base,
      mes: 3,
      diaInicio: 15,
      seguro: 'afp',
      nombre: 'Escenario Ocho Inicio Día 15',
      dias: { laborables: PATRONES.ochoHoras, finDeSemana: 'descanso' },
    },
    {
      id: '09-activacion-seguro-dia-10',
      ...base,
      mes: 3,
      seguro: 'afp',
      diaActivacion: 10,
      nombre: 'Escenario Nueve Activación Día 10',
      dias: { laborables: PATRONES.ochoHoras, finDeSemana: 'descanso' },
    },
    {
      id: '10-descuentos-adicionales',
      ...base,
      mes: 3,
      seguro: 'onp',
      nombre: 'Escenario Diez Descuentos',
      dias: { laborables: PATRONES.ochoHoras, finDeSemana: 'descanso' },
      descuentos: [
        ['Adelanto de sueldo', 150],
        ['Consumo de productos', 42.5],
      ],
    },
    {
      id: '11-dias-de-descanso-laborables',
      ...base,
      mes: 3,
      seguro: 'afp',
      nombre: 'Escenario Once Descansos',
      dias: {
        laborables: PATRONES.ochoHoras,
        finDeSemana: 'descanso',
        sobresale: {
          7: PATRONES.descanso,
          14: PATRONES.descanso,
          21: PATRONES.descanso,
          28: PATRONES.descanso,
        },
      },
    },
    {
      id: '12-mixto-completo',
      ...base,
      mes: 5,
      diaInicio: 5,
      seguro: 'afp',
      diaActivacion: 8,
      nombre: 'Escenario Doce Mixto',
      dias: {
        laborables: PATRONES.ochoHoras,
        finDeSemana: 'descanso',
        excepto: [9, 22],
        sobresale: {
          10: PATRONES.extraLarga,
          16: PATRONES.descanso,
          23: PATRONES.extraCorta,
        },
      },
      descuentos: [['Adelanto de sueldo', 200]],
    },
    {
      id: '13-comportamiento-default-findes-vacios',
      ...base,
      mes: 3,
      seguro: 'afp',
      nombre: 'Escenario Trece Fines de Semana Vacíos',
      // Estado por defecto de la app: fines de semana sin registrar
      dias: { laborables: PATRONES.ochoHoras, finDeSemana: 'vacio' },
    },
    {
      id: '14-replica-horario-a-todo-el-mes',
      ...base,
      mes: 3,
      seguro: 'afp',
      nombre: 'Escenario Catorce Réplica de Horario',
      // Equivalente al toggle "Replicar horario del primer día a todos"
      dias: { laborables: PATRONES.extraCorta, finDeSemana: PATRONES.extraCorta },
    },
  ];
}

/* ------------------------------------------------------------
   EJECUCIÓN DE UN ESCENARIO
   ------------------------------------------------------------ */
function ejecutar(def) {
  const dom = createApp();
  const w = dom.window;

  setVal(w, 'nombreEmpleado', def.nombre);
  setVal(w, 'mes', String(def.mes));
  setVal(w, 'anio', String(def.anio));
  setVal(w, 'seguro', def.seguro);
  setVal(w, 'diaInicio', String(def.diaInicio));
  w.actualizarInfoSeguro();
  setVal(w, 'diaActivacion', String(def.diaActivacion));
  w.actualizarInfoDiaInicio();

  w.generarDias();

  aplicarPatron(w, def, (d, ds) => horarioDia(def, d, ds));

  (def.descuentos || []).forEach(([c, m]) => agregarDescuento(w, c, m));

  const totals = w.obtenerTotalesAsistencia();
  const sueldo = w.calcularSueldo(
    totals.horasEfectivas,
    totals.horasRegla,
    totals.totalExtras_25,
    totals.totalExtras_35,
    totals.horasNoCubiertas
  );
  const resumen = w.obtenerResumenEmpleado();

  w.calcularYMostrar();
  w.actualizarStats();

  // Badges por fila (calcularFila)
  const filas = {};
  w.document.querySelectorAll('#tbodyDias tr[data-dia]').forEach((tr) => {
    const d = tr.dataset.dia;
    filas[d] = {
      trab: normalizeText(w.document.getElementById('horasTrab_' + d)?.textContent),
      extra: normalizeText(w.document.getElementById('horasExtra_' + d)?.textContent),
    };
  });

  const boletaHTML = w.document.getElementById('boletaContainer').innerHTML;

  w.imprimirBoleta();
  const iframe = w.document.getElementById('iframePrint');
  let printStyle = '';
  let printBody = '';
  if (iframe && iframe.contentDocument) {
    const doc = iframe.contentDocument;
    // Desde la fase 4 el CSS de impresión vive en css/print.css y el iframe
    // lo referencia con <link>. jsdom no descarga recursos externos, así que
    // se lee el archivo desde disco para seguir pudiéndolo comparar.
    const link = doc.querySelector('link[href$="print.css"]');
    if (link) {
      printStyle = fs.readFileSync(path.join(ROOT, link.getAttribute('href')), 'utf8');
    } else {
      const st = doc.querySelector('style');
      printStyle = st ? st.textContent : '';
    }
    printBody = doc.body ? doc.body.innerHTML : '';
  }

  const resultado = {
    config: {
      mes: def.mes,
      anio: def.anio,
      diaInicio: def.diaInicio,
      seguro: def.seguro,
      diaActivacion: def.diaActivacion,
      nombre: def.nombre,
      descuentos: def.descuentos || [],
    },
    textos: {
      labelPeriodo: normalizeText(getVal(w, 'labelPeriodo') || w.document.getElementById('labelPeriodo').textContent),
      seguroInfo: normalizeText(w.document.getElementById('seguroInfoText').textContent),
      diaInicioInfo: normalizeText(w.document.getElementById('diaInicioInfoText').textContent),
      totalHorasTrab: normalizeText(w.document.getElementById('totalHorasTrab').textContent),
      totalHorasExtra: normalizeText(w.document.getElementById('totalHorasExtra').textContent),
      descuentoTotal: normalizeText(w.document.getElementById('descuentoTotalVal').textContent),
    },
    totals,
    sueldo,
    resumen,
    filas,
    statsHTML: normalize(w.document.getElementById('statsGrid').innerHTML),
    boletaHTML: normalize(boletaHTML),
    printStyle: printStyle.replace(/\s+/g, ' ').trim(),
    printBody: normalize(printBody),
  };

  dom.window.close();
  return resultado;
}

/* ------------------------------------------------------------
   CAPTURE / VERIFY
   ------------------------------------------------------------ */
function main() {
  const mode = process.argv[2] || '--verify';

  const datos = {
    _meta: {
      generado: new Date().toISOString(),
      node: process.version,
      escenarios: 0,
      // El CSS de impresión es idéntico en todos los escenarios: se guarda una sola vez
      printCSS: '',
    },
    escenarios: {},
  };

  for (const def of escenarios()) {
    process.stderr.write('  · ' + def.id + ' ... ');
    datos.escenarios[def.id] = ejecutar(def);
    process.stderr.write('ok\n');
  }
  datos._meta.escenarios = Object.keys(datos.escenarios).length;

  // Deduplicar el CSS de impresión (debe ser idéntico en todos los escenarios)
  const estilos = new Set(Object.values(datos.escenarios).map((e) => e.printStyle));
  if (estilos.size > 1) {
    process.stderr.write('✘ El CSS de impresión difiere entre escenarios.\n');
    process.exit(3);
  }
  datos._meta.printCSS = [...estilos][0] || '';
  for (const e of Object.values(datos.escenarios)) delete e.printStyle;

  if (mode === '--capture') {
    fs.mkdirSync(path.dirname(FIXTURES), { recursive: true });
    fs.writeFileSync(FIXTURES, JSON.stringify(datos, null, 2) + '\n', 'utf8');
    process.stderr.write(
      `\n✔ Fixtures capturados: ${datos._meta.escenarios} escenarios → ${path.relative(ROOT, FIXTURES)}\n`
    );
    return;
  }

  // --verify
  if (!fs.existsSync(FIXTURES)) {
    process.stderr.write('✘ No existen fixtures. Ejecuta: npm run golden:capture\n');
    process.exit(2);
  }
  const esperado = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));
  const fallos = [];

  if (datos._meta.printCSS !== esperado._meta.printCSS) {
    fallos.push('_meta.printCSS: el CSS de impresión cambió');
  }
  for (const id of Object.keys(esperado.escenarios)) {
    if (!datos.escenarios[id]) fallos.push(`${id}: existe en fixtures pero ya no se ejecuta`);
  }

  for (const [id, actual] of Object.entries(datos.escenarios)) {
    const previsto = esperado.escenarios[id];
    if (!previsto) {
      fallos.push(`${id}: no existe en fixtures`);
      continue;
    }
    const a = JSON.stringify(actual, null, 2);
    const b = JSON.stringify(previsto, null, 2);
    if (a !== b) {
      const ra = a.split('\n');
      const rb = b.split('\n');
      for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
        if (ra[i] !== rb[i]) {
          fallos.push(`${id}: línea ${i + 1}\n      esperado: ${rb[i]}\n      actual:   ${ra[i]}`);
          break;
        }
      }
    }
  }

  if (fallos.length) {
    process.stderr.write(`\n✘ ${fallos.length} diferencia(s):\n`);
    fallos.forEach((f) => process.stderr.write('  - ' + f + '\n'));
    process.exit(1);
  }
  process.stderr.write(`\n✔ ${datos._meta.escenarios} escenarios idénticos a los fixtures.\n`);
}

main();
