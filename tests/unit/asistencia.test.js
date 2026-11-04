'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp, llenarTabla } = require('./helpers/app');

const MES = 3;      // abril 2026 → 30 días
const ANIO = 2026;
const OK = { entrada: '08:00', salida: '17:00', almuerzo: 60 };  // 8h exactas
const VACIO = { entrada: '', salida: '', almuerzo: 0 };

/* Prepara la app con el estado por defecto y devuelve helpers */
function app(estado = {}) {
  const { doc, app: api } = cargarApp(estado);
  return {
    doc,
    api,
    /* fn(d, dow) puede devolver un spec o null (fila no creada) */
    llenar: (fn) => llenarTabla(doc, MES, ANIO, fn),
    totales: () => api.obtenerTotalesAsistencia(),
    resumen: () => api.obtenerResumenEmpleado(),
  };
}

test('esDescanso reconoce 00:00–08:00 sin almuerzo', () => {
  const { api } = app();
  assert.equal(api.esDescanso('00:00', '08:00', 0), true);
  assert.equal(api.esDescanso('00:00', '08:00', 60), false);
  assert.equal(api.esDescanso('08:00', '17:00', 60), false);
  assert.equal(api.esDescanso('00:00', '09:00', 0), false);
  assert.equal(api.esDescanso('', '', 0), false);
});

test('mes completo 8h → Regla 1: sin extras, sin déficit', () => {
  const t = app();
  t.llenar(() => ({ ...OK }));

  const acum = t.api.acumularAsistencia();
  assert.equal(acum.diasRealesMes, 30);
  assert.equal(acum.diasLaborales, 30);
  assert.equal(acum.horasRegla, 240);
  assert.equal(acum.detalle.length, 30);
  assert.ok(acum.detalle.every(d => d.estado === 'ok' && d.horas === 8));

  const tot = t.api.obtenerTotalesAsistencia(acum);
  assert.equal(tot.horasTrabajadas, 240);
  assert.equal(tot.horasBase, 240);
  assert.equal(tot.deficitBruto, 0);
  assert.equal(tot.horasNoCubiertas, 0);
  assert.equal(tot.totalExtras, 0);
  assert.equal(tot.horasEfectivas, 240);

  const r = t.api.obtenerResumenEmpleado(acum);
  assert.equal(r.horasADescontar, 0);
  assert.equal(r.diasDebeList.length, 0);
});

test('días de descanso aportan 8h exactas sin extras', () => {
  const t = app();
  t.llenar((d) => (d % 6 === 0)
    ? { entrada: '00:00', salida: '08:00', almuerzo: 0 }
    : { ...OK });

  const acum = t.api.acumularAsistencia();
  const descansos = acum.detalle.filter(d => d.estado === 'descanso');
  assert.equal(descansos.length, 5); // 6,12,18,24,30 de abril 2026

  const tot = t.api.obtenerTotalesAsistencia(acum);
  assert.equal(tot.horasBase, 240);
  assert.equal(tot.deficitBruto, 0);
  assert.equal(tot.totalExtras, 0);
  assert.equal(tot.horasNoCubiertas, 0);
});

test('extras del día: primeras 2h al 25%, resto al 35%', () => {
  const t = app();
  // Día 5: 08:00–20:00 − 60min = 11h → 3 extras (2 al 25% + 1 al 35%)
  t.llenar((d) => (d === 5 ? { entrada: '08:00', salida: '20:00', almuerzo: 60 } : { ...OK }));

  const tot = t.totales();
  assert.equal(tot.totalExtras_25, 2);
  assert.equal(tot.totalExtras_35, 1);
  assert.equal(tot.totalExtras, 3);
  assert.equal(tot.deficitBruto, 0);
  assert.equal(tot.horasTrabajadas, 29 * 8 + 11);
  assert.equal(tot.horasBase, 240); // cap 8h/día: las extras no suman
});

test('corte diario de extras: el 35% se reinicia cada día', () => {
  const t = app();
  // Dos días con 11h → 3 extras cada uno (2+1), no 4+2
  t.llenar((d) => (d === 5 || d === 12
    ? { entrada: '08:00', salida: '20:00', almuerzo: 60 }
    : { ...OK }));

  const tot = t.totales();
  assert.equal(tot.totalExtras_25, 4);
  assert.equal(tot.totalExtras_35, 2);
  assert.equal(tot.totalExtras, 6);
});

test('Regla 2: las extras cubren el déficit (35% primero, luego 25%)', () => {
  const t = app();
  // Día 5:  13h → extras 5 (2@25 + 3@35)
  // Día 10:  4h → déficit 4
  t.llenar((d) => {
    if (d === 5) return { entrada: '08:00', salida: '22:00', almuerzo: 60 };
    if (d === 10) return { entrada: '08:00', salida: '13:00', almuerzo: 60 };
    return { ...OK };
  });

  const tot = t.totales();
  assert.equal(tot.deficitBruto, 4);
  assert.equal(tot.horasNoCubiertas, 0);
  // Día 5 aporta 3@35 y 2@25 → se gastan 3@35 y 1@25 → sobra 1@25
  assert.equal(tot.totalExtras_35, 0);
  assert.equal(tot.totalExtras_25, 1);
  assert.equal(tot.horasEfectivas, 240); // sin déficit residual → fijo en horasRegla
});

test('Regla 3: extras insuficientes → déficit residual positivo', () => {
  const t = app();
  // Día 5:  11h → extras 3 (2@25 + 1@35)
  // Día 10:  4h → déficit 4 → solo se cubren 3
  t.llenar((d) => {
    if (d === 5) return { entrada: '08:00', salida: '20:00', almuerzo: 60 };
    if (d === 10) return { entrada: '08:00', salida: '13:00', almuerzo: 60 };
    return { ...OK };
  });

  const tot = t.totales();
  assert.equal(tot.deficitBruto, 4);
  assert.equal(tot.horasNoCubiertas, 1);
  assert.equal(tot.totalExtras_25, 0);
  assert.equal(tot.totalExtras_35, 0);
  assert.equal(tot.horasBase, 236);
  assert.equal(tot.horasEfectivas, 236 + 3); // horasBase + extras usadas
});

test('Regla 3: medio mes sin registro → media jornada proporcional', () => {
  const t = app();
  t.llenar((d) => (d >= 16 ? { ...VACIO } : { ...OK }));

  const tot = t.totales();
  assert.equal(tot.horasRegla, 240);
  assert.equal(tot.horasBase, 120);
  assert.equal(tot.deficitBruto, 120);
  assert.equal(tot.horasNoCubiertas, 120);
  assert.equal(tot.horasEfectivas, 120);
  assert.equal(tot.totalExtras, 0);

  const r = t.resumen();
  assert.equal(r.diasDebeList.length, 15);
  assert.equal(r.horasADescontar, 120);
});

test('día de inicio > 1 acorta el período (no genera déficit)', () => {
  const t = app({ diaInicio: '10' });
  t.llenar((d) => (d < 10 ? { ...VACIO } : { ...OK }));

  const acum = t.api.acumularAsistencia();
  assert.equal(acum.diasRealesMes, 30);
  assert.equal(acum.diasLaborales, 21);          // 30 − 9
  assert.equal(acum.horasRegla, 168);
  assert.equal(acum.detalle.length, 21);         // los días 1-9 ni aparecen
  assert.equal(acum.detalle[0].dia, 10);

  const tot = t.api.obtenerTotalesAsistencia(acum);
  assert.equal(tot.deficitBruto, 0);
  assert.equal(tot.horasNoCubiertas, 0);
  assert.equal(tot.horasBase, 168);
});

test('INVARIANTE: horasBase + deficitBruto === horasRegla', () => {
  const patrones = [
    () => ({ ...OK }),
    () => ({ ...VACIO }),
    (d) => (d % 3 === 0 ? { ...VACIO } : { ...OK }),
    (d) => (d % 5 === 0 ? { entrada: '08:00', salida: '20:00', almuerzo: 60 } : { ...OK }),
    (d) => (d % 7 === 0 ? { entrada: '09:00', salida: '14:30', almuerzo: 30 } : { ...VACIO }),
    (d) => (d % 4 === 0 ? { entrada: '00:00', salida: '08:00', almuerzo: 0 } : { entrada: '07:00', salida: '19:00', almuerzo: 0 }),
    (d) => (d <= 15 ? { entrada: '08:00', salida: '16:00', almuerzo: 60 } : { ...OK }),
  ];

  for (const diaInicio of ['1', '5', '15', '31']) {
    for (const [i, fn] of patrones.entries()) {
      const t = app({ diaInicio });
      t.llenar(fn);
      const acum = t.api.acumularAsistencia();
      const tot = t.api.obtenerTotalesAsistencia(acum);
      assert.equal(
        Math.round((tot.horasBase + tot.deficitBruto) * 10000) / 10000,
        acum.horasRegla,
        `patrón ${i}, diaInicio=${diaInicio}: ${tot.horasBase} + ${tot.deficitBruto} ≠ ${acum.horasRegla}`
      );
      assert.ok(tot.horasNoCubiertas >= 0);
      assert.ok(tot.totalExtras >= 0);
    }
  }
});

test('la proyección de la tabla y el resumen provienen del mismo barrido', () => {
  const t = app();
  t.llenar((d) => {
    if (d === 3 || d === 17) return { ...VACIO };
    if (d === 8) return { entrada: '08:00', salida: '20:00', almuerzo: 60 };
    if (d === 12) return { entrada: '08:00', salida: '13:00', almuerzo: 60 };
    return { ...OK };
  });

  const acum = t.api.acumularAsistencia();
  const tot = t.api.obtenerTotalesAsistencia(acum);
  const r = t.api.obtenerResumenEmpleado(acum);

  // 2 días sin registro (2×8h) + 1 día corto (4h → 4h de déficit)
  assert.equal(r.diasDebeList.length, 2);
  assert.equal(r.horasDebe, 4);
  assert.equal(r.horasADescontar, 16 + 4);
  assert.equal(tot.deficitBruto, 2 * 8 + 4);

  // Extras brutas del resumen = extras brutas antes de compensar
  assert.equal(r.extrasPool_25, 2);
  assert.equal(r.extrasPool_35, 1);
});

test('readState normaliza el día de inicio', () => {
  const { app: api } = cargarApp();
  assert.equal(api.readState().diaInicio, 1);
  assert.equal(api.readState().mes, 3);
  assert.equal(api.readState().anio, 2026);

  const c = cargarApp({ diaInicio: '0' });
  assert.equal(c.app.readState().diaInicio, 1, 'diaInicio 0 se eleva a 1');

  const d = cargarApp({ diaInicio: '' });
  assert.equal(d.app.readState().diaInicio, 1, 'vacío se interpreta como 1');
});
