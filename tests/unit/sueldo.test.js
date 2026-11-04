'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp } = require('./helpers/app');

const V = 1230 / 30 / 8; // valor hora

/* totales "perfectos": 240h reglamentarias, sin extras ni déficit */
const REGLA1 = [240, 240, 0, 0, 0];
/* escenario Regla 3: 198h efectivas / 208h regl., 6h de déficit */
const REGLA3 = [198, 208, 0, 0, 6];

function sueldo(estado, args) {
  const { doc, app } = cargarApp({ seguro: 'ninguno', diaInicio: '1', diaActivacion: '1', ...estado });
  return { doc, r: app.calcularSueldo(...args) };
}

test('valor hora = S/ 1,230 / 30 / 8', () => {
  const { r } = sueldo({}, REGLA1);
  assert.equal(r.valorHora, V);
  assert.equal(V, 5.125); // exacto, sin resto binario
});

test('Regla 1: mes completo sin extras → sueldo base íntegro', () => {
  const { r } = sueldo({}, REGLA1);
  assert.equal(r.sueldoProporcional, 1230);
  assert.equal(r.bruto, 1230);
  assert.equal(r.pagoExtras, 0);
  assert.equal(r.neto, 1230);
});

test('Regla 3: sueldo proporcional a horas efectivas / horas reglamentarias', () => {
  // diaInicio=5 → sueldoBaseMaximo = 1,230 × 26/30 = 1066
  const { r } = sueldo({ diaInicio: '5' }, REGLA3);
  const baseMax = 1230 * (30 - 4) / 30;
  assert.equal(baseMax, 1066);
  assert.equal(r.sueldoProporcional, (198 / 208) * baseMax);
  assert.ok(Math.abs(r.sueldoProporcional - 1014.75) < 1e-9, String(r.sueldoProporcional));
  assert.equal(r.horasNoCubiertas, 6);
});

test('pago de horas extras: 25% y 35% sobre el valor hora', () => {
  const { r } = sueldo({}, [240, 240, 60, 10, 0]);
  const esperado = 60 * V * 1.25 + 10 * V * 1.35;
  assert.equal(r.pagoExtras, esperado);
  assert.equal(r.bruto, 1230 + esperado);
  assert.equal(r.extras_25, 60);
  assert.equal(r.extras_35, 10);
});

test('seguro "ninguno" no descuenta nada', () => {
  const { r } = sueldo({ seguro: 'ninguno' }, REGLA1);
  assert.equal(r.descuentoSeguro, 0);
  assert.equal(r.tasaSeguro, 0);
  assert.equal(r.labelSeguro, 'No Inscrito');
  assert.equal(r.diaActivacion, 1);
  assert.equal(r.esProporcionado, false);
  assert.equal(r.neto, 1230);
});

test('AFP 11.37% sobre S/ 1,230 fijo', () => {
  const { r } = sueldo({ seguro: 'afp' }, REGLA1);
  assert.equal(r.tasaSeguro, 0.1137);
  assert.equal(r.baseSeguro, 1230);
  assert.equal(r.descuentoSeguro, 1230 * 0.1137);
  assert.ok(Math.abs(r.descuentoSeguro - 139.851) < 1e-9);
  assert.equal(r.labelSeguro, 'AFP (11.37%)');
  assert.ok(Math.abs(r.neto - (1230 - 139.851)) < 1e-9);
});

test('ONP 13% sobre S/ 1,230 fijo', () => {
  const { r } = sueldo({ seguro: 'onp' }, REGLA1);
  assert.equal(r.tasaSeguro, 0.13);
  assert.equal(r.descuentoSeguro, 1230 * 0.13);
  assert.equal(r.descuentoSeguro, 159.9);
  assert.equal(r.labelSeguro, 'ONP (13.00%)');
  assert.equal(r.neto, 1230 - 159.9);
});

test('activación del seguro en día 8 → base proporcional', () => {
  const { r } = sueldo({ seguro: 'afp', diaActivacion: '8' }, REGLA1);
  const base = 1230 * ((30 - 7) / 30); // mismo orden que el código
  assert.equal(r.esProporcionado, true);
  assert.equal(r.diaActivacion, 8);
  assert.equal(r.baseSeguro, base);
  assert.ok(Math.abs(base - 943) < 1e-9, String(base)); // 1,230 × 23/30 = 943
  assert.equal(r.descuentoSeguro, base * 0.1137);
  assert.equal(r.labelSeguro, 'AFP (11.37%) — activación día 8');
  // La base del seguro NO se mezcla con la proporcionalidad por horas
  assert.equal(r.sueldoProporcional, 1230);
});

test('día de inicio > 1 → sueldo base máximo proporcional', () => {
  const { r } = sueldo({ diaInicio: '10' }, [168, 168, 0, 0, 0]);
  const esperado = 1230 * (30 - 9) / 30;
  assert.equal(r.sueldoProporcional, esperado);
  assert.equal(esperado, 861); // 1,230 × 21/30
  assert.equal(r.bruto, 861);
});

test('los descuentos adicionales restan del neto y no tocan el bruto', () => {
  const { doc, app } = cargarApp({ seguro: 'afp', diaInicio: '1', diaActivacion: '1' });
  doc.descuento(1, 'Adelanto de sueldo', 150);
  const r = app.calcularSueldo(...REGLA1);
  assert.equal(r.bruto, 1230);
  assert.equal(r.totalDescAdicional, 150);
  assert.equal(r.descuentosAdicionales.length, 1);
  assert.equal(r.descuentosAdicionales[0].concepto, 'Adelanto de sueldo');
  assert.equal(r.descuentosAdicionales[0].monto, 150);
  assert.ok(Math.abs(r.neto - (1230 - 1230 * 0.1137 - 150)) < 1e-9);
});

test('INVARIANTE: neto = bruto − seguro − descuentos adicionales', () => {
  for (const seguro of ['ninguno', 'afp', 'onp']) {
    for (const diaActivacion of ['1', '8', '20']) {
      for (const diaInicio of ['1', '5', '20']) {
        const { doc, app } = cargarApp({ seguro, diaActivacion, diaInicio });
        doc.descuento(1, 'Adelanto', 200);
        doc.descuento(2, 'Consumo', 49.5);
        const r = app.calcularSueldo(198, 208, 60, 10, 6);
        assert.equal(r.totalDescAdicional, 249.5);
        assert.ok(
          Math.abs(r.neto - (r.bruto - r.descuentoSeguro - r.totalDescAdicional)) < 1e-9,
          `neto incoherente: seguro=${seguro} act=${diaActivacion} ini=${diaInicio}`
        );
      }
    }
  }
});

test('el total de descuentos adicionales suma todos los ítems', () => {
  const { doc, app } = cargarApp();
  doc.descuento(1, 'Adelanto', 150.5);
  doc.descuento(2, 'Consumo', 49.5);
  const r = app.calcularSueldo(...REGLA1);
  assert.equal(r.totalDescAdicional, 200);
  assert.equal(r.descuentosAdicionales.length, 2);
});

/* ── Sueldo base variable en el tiempo ────────────────────────── */

test('sueldo base 1500 → valor hora = 1500 / 30 / 8 = 6.25', () => {
  const { r } = sueldo({ sueldoBase: '1500', seguro: 'ninguno' }, REGLA1);
  assert.equal(r.valorHora, 1500 / 30 / 8);
  assert.equal(r.valorHora, 6.25);
});

test('Regla 1 con sueldo base 1500 → bruto = 1500 (sin extras ni déficit)', () => {
  const { r } = sueldo({ sueldoBase: '1500', seguro: 'ninguno' }, REGLA1);
  assert.equal(r.sueldoProporcional, 1500);
  assert.equal(r.bruto, 1500);
  assert.equal(r.pagoExtras, 0);
  assert.equal(r.neto, 1500);
});

test('Regla 3 con sueldo base 2000 → proporcional a horas efectivas sobre la base real', () => {
  // 198h efectivas / 208h regl., sueldo base 2000
  const { r } = sueldo({ sueldoBase: '2000', seguro: 'ninguno' }, [198, 208, 0, 0, 6]);
  const esperado = (198 / 208) * 2000;
  assert.ok(Math.abs(r.sueldoProporcional - esperado) < 1e-9, String(r.sueldoProporcional));
  assert.equal(r.horasNoCubiertas, 6);
});

test('AFP 11.37% sobre sueldo base 1500 (no sobre el mínimo fijo)', () => {
  const { r } = sueldo({ sueldoBase: '1500', seguro: 'afp' }, REGLA1);
  assert.equal(r.tasaSeguro, 0.1137);
  assert.equal(r.baseSeguro, 1500);
  assert.equal(r.descuentoSeguro, 1500 * 0.1137);
  assert.ok(Math.abs(r.descuentoSeguro - 170.55) < 1e-9);
  assert.equal(r.labelSeguro, 'AFP (11.37%)');
});

test('ONP 13% sobre sueldo base 2000', () => {
  const { r } = sueldo({ sueldoBase: '2000', seguro: 'onp' }, REGLA1);
  assert.equal(r.tasaSeguro, 0.13);
  assert.equal(r.baseSeguro, 2000);
  assert.equal(r.descuentoSeguro, 2000 * 0.13);
  assert.equal(r.descuentoSeguro, 260);
});

test('sueldo base vacío (default) sigue usando el mínimo vigente 1230', () => {
  const { r } = sueldo({ seguro: 'ninguno' }, REGLA1); // sin sueldoBase
  assert.equal(r.valorHora, 1230 / 30 / 8);
  assert.equal(r.bruto, 1230);
});

test('extras se pagan sobre el valor hora derivado del sueldo base real', () => {
  // sueldo base 1500 → valor hora 6.25; 60h@25% + 10h@35%
  const { r } = sueldo({ sueldoBase: '1500', seguro: 'ninguno' }, [240, 240, 60, 10, 0]);
  const esperado = 60 * 6.25 * 1.25 + 10 * 6.25 * 1.35;
  assert.ok(Math.abs(r.pagoExtras - esperado) < 1e-9, String(r.pagoExtras));
  assert.equal(r.bruto, 1500 + esperado);
});
