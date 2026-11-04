'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp } = require('./helpers/app');

const { app } = cargarApp();

test('constantes legales peruanas', () => {
  assert.equal(app.SUELDO_BASE, 1230);
  assert.equal(app.SUELDO_BASE_TXT, 'S/ 1,230');
  assert.equal(app.DIAS_MES_BASE, 30);
  assert.equal(app.HORAS_DIARIAS, 8);
  assert.equal(app.VALOR_HORA, 1230 / 30 / 8);
  assert.equal(app.VALOR_HORA, 5.125);
  assert.equal(app.TASA_EXTRA_25, 0.25);
  assert.equal(app.TASA_EXTRA_35, 0.35);
  assert.equal(app.TASA_AFP, 0.1137);
  assert.equal(app.TASA_ONP, 0.13);
});

test('tablas de meses y días de la semana', () => {
  assert.equal(app.MESES.length, 12);
  assert.equal(app.MESES[0], 'Enero');
  assert.equal(app.MESES[5], 'Junio');
  assert.equal(app.DIAS_SEMANA.length, 7);
  assert.equal(app.DIAS_SEMANA[0], 'Dom');
  assert.equal(app.DIAS_SEMANA[6], 'Sáb');
});

test('las tasas de extras son bit-idénticas a sus literales', () => {
  // Sustituir 1.25/1.35 por (1 + TASA) no cambia ningún resultado.
  assert.equal(app.VALOR_HORA * 1.25, app.VALOR_HORA * (1 + app.TASA_EXTRA_25));
  assert.equal(app.VALOR_HORA * 1.35, app.VALOR_HORA * (1 + app.TASA_EXTRA_35));
  assert.equal(1 + app.TASA_EXTRA_25, 1.25);
  assert.equal(1 + app.TASA_EXTRA_35, 1.35);
});
