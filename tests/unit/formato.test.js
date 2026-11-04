'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp } = require('./helpers/app');

const { app } = cargarApp();

test('fmtSol formatea en soles con 2 decimales', () => {
  assert.equal(app.fmtSol(0), 'S/ 0.00');
  assert.equal(app.fmtSol(1130), 'S/ 1,130.00');
  assert.equal(app.fmtSol(4.708333333333334), 'S/ 4.71');
  assert.equal(app.fmtSol(-128.48), 'S/ -128.48');
  assert.match(app.fmtSol(1234567.891), /^S\/ 1,234,567\.89$/);
});

test('fmtHrs redondea a 2 decimales con sufijo h', () => {
  assert.equal(app.fmtHrs(8), '8.00h');
  assert.equal(app.fmtHrs(11.5), '11.50h');
  assert.equal(app.fmtHrs(0), '0.00h');
});

test('fmtResumenHoras convierte horas decimales a hh:mm = h.hh', () => {
  assert.equal(app.fmtResumenHoras(0), '00:00 = 0.00h');
  assert.equal(app.fmtResumenHoras(8), '08:00 = 8.00h');
  assert.equal(app.fmtResumenHoras(16.5), '16:30 = 16.50h');
  assert.equal(app.fmtResumenHoras(64), '64:00 = 64.00h');
  // 0.1h = 6 minutos exactos
  assert.equal(app.fmtResumenHoras(0.1), '00:06 = 0.10h');
});
