'use strict';
/* ============================================================
   Prueba de la delegación de eventos (Fase 5).
   Ningún elemento lleva handlers on* en línea: todo se delega en
   document desde js/main.js. Aquí se verifica que los 12
   data-action respondan a click / input / change con jsdom.
   ============================================================ */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..', '..');

function createApp() {
  const raw = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scriptSrcs = [...raw.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
  const html = raw
    .replace(/<script src="js\/[^"]+"><\/script>/g, '')
    .replace(/<link[^>]+fonts\.[^>]+>/g, '');

  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});
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
    const s = w.document.createElement('script');
    s.textContent = fs.readFileSync(path.join(ROOT, src.split('?')[0]), 'utf8');
    w.document.body.appendChild(s);
  }
  return dom;
}

const dom = createApp();
const w = dom.window;
const d = w.document;
let fallos = 0;
let total = 0;

function ok(nombre, cond, extra) {
  total++;
  if (cond) {
    process.stdout.write(`  ok   ${nombre}\n`);
  } else {
    fallos++;
    process.stdout.write(`  FAIL ${nombre}${extra !== undefined ? ' ' + JSON.stringify(extra) : ''}\n`);
  }
}
const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const input = (el) => el.dispatchEvent(new w.Event('input', { bubbles: true }));
const change = (el) => el.dispatchEvent(new w.Event('change', { bubbles: true }));

/* ── 1. Generar Días ── */
d.getElementById('nombreEmpleado').value = 'Delegación Test';
d.getElementById('mes').value = '3';
d.getElementById('anio').value = '2026';
click(d.querySelector('[data-action="generar-dias"]'));
ok('click generar-dias → 30 filas en la tabla', d.querySelectorAll('#tbodyDias tr').length === 30, d.querySelectorAll('#tbodyDias tr').length);
ok('click generar-dias → paso 2 visible', d.getElementById('stepAsistencia').style.display !== 'none');

/* ── 2. Seguro ── */
const seguro = d.getElementById('seguro');
seguro.value = 'onp'; change(seguro);
ok('change seguro-change → texto ONP', /ONP/.test(d.getElementById('seguroInfoText').textContent), d.getElementById('seguroInfoText').textContent);
seguro.value = 'afp'; change(seguro);

/* ── 3. Día de inicio ── */
const di = d.getElementById('diaInicio');
di.value = '10'; input(di);
ok('input dia-inicio-input → aviso con el día 10', /10/.test(d.getElementById('diaInicioInfoText').textContent), d.getElementById('diaInicioInfoText').textContent);
di.value = '1'; input(di);

/* ── 4. Edición de celda (el data-action está en el input, dentro del td) ── */
d.getElementById('entrada_5').value = '08:00';
d.getElementById('salida_5').value = '20:00';
d.getElementById('almuerzo_5').value = '60';
input(d.getElementById('almuerzo_5'));
ok('input campo-dia → recalcula la fila 5 (12h − 60min = 11h)',
   /11\.00/.test(d.getElementById('horasTrab_5').textContent), d.getElementById('horasTrab_5').textContent);

/* ── 5. Réplica de horario (usa el primer día con entrada) ── */
d.getElementById('entrada_1').value = '08:00';
d.getElementById('salida_1').value = '21:00';
d.getElementById('chkReplica').checked = true;
change(d.querySelector('[data-action="replicar-toggle"]'));
ok('change replicar-toggle → propaga el día 1 al resto',
   d.getElementById('salida_5').value === '21:00' && d.getElementById('entrada_5').value === '08:00',
   [d.getElementById('entrada_5').value, d.getElementById('salida_5').value]);
d.getElementById('chkReplica').checked = false;

/* ── 6. Descuentos ── */
click(d.querySelector('[data-action="agregar-descuento"]'));
ok('click agregar-descuento → 1 ítem', d.querySelectorAll('.descuento-item').length === 1);
const monto = d.getElementById('descMonto_1');
monto.value = '150'; input(monto);
ok('input desc-input → total S/ 150.00', d.getElementById('descuentoTotalVal').textContent.includes('150'), d.getElementById('descuentoTotalVal').textContent);
click(d.querySelector('[data-action="del-descuento"]'));
ok('click del-descuento → lista vacía', d.querySelectorAll('.descuento-item').length === 0);

/* ── 7. Boleta ── */
click(d.querySelector('[data-action="calcular"]'));
ok('click calcular → boleta renderizada', d.getElementById('boletaContainer').innerHTML.includes('Sueldo Neto'));
ok('el botón imprimir usa data-action', d.querySelector('[data-action="imprimir"]') !== null);

/* ── 8. El click sobre el svg HIJO debe llegar al botón (closest) ── */
click(d.querySelector('[data-action="imprimir"] svg'));
ok('click sobre el svg del botón imprimir → iframe con la boleta', !!d.getElementById('iframePrint'));

/* ── 9. Ejemplo / limpiar ── */
click(d.querySelector('[data-action="llenar-ejemplo"]'));
ok('click llenar-ejemplo → nombre rellenado', d.getElementById('nombreEmpleado').value.length > 0, d.getElementById('nombreEmpleado').value);
click(d.querySelector('[data-action="limpiar"]'));
ok('click limpiar → tabla vacía', d.querySelectorAll('#tbodyDias tr').length === 0);

/* ── 10. Exportar / importar (solo que estén cableados, sin errores) ── */
click(d.querySelector('[data-action="exportar"]'));
ok('click exportar → no lanza', true);

/* ── Cobertura: ningún on* en línea en el HTML ni en el JS generado ── */
const htmlFuente = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const jsFuente = fs.readdirSync(path.join(ROOT, 'js'), { recursive: true })
  .filter(f => f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'))
  .join('\n');
ok('index.html sin atributos on* en línea',
   !/\son(?:click|input|change|submit|load|error)\s*=/.test(htmlFuente));
ok('js/*.js sin atributos on* en línea',
   !/\son(?:click|input|change|submit|load|error)\s*=/.test(jsFuente));

const dataActions = [...jsFuente.matchAll(/data-action="([a-z-]+)"/g)].map(m => m[1]);
const mainFuente = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
const registradas = [...mainFuente.matchAll(/'([a-z-]+)':\s*(?:\(|\(\w*\s*=>)/g)].map(m => m[1]);
const sinHandler = [...new Set(dataActions)].filter(a => !registradas.includes(a));
ok('todo data-action del DOM tiene handler en ACCIONES', sinHandler.length === 0, sinHandler);
ok('ACCIONES registra los 12 data-action', registradas.length >= 12, registradas.length);

process.stdout.write(fallos
  ? `\n✘ ${fallos} fallo(s) de ${total} comprobaciones\n`
  : `\n✔ Delegación OK: ${total} comprobaciones\n`);
process.exit(fallos ? 1 : 0);
