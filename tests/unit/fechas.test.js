'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarApp } = require('./helpers/app');

const { app } = cargarApp();

test('getDiasEnMes: longitud de cada mes', () => {
  assert.equal(app.getDiasEnMes(0, 2026), 31);   // enero
  assert.equal(app.getDiasEnMes(1, 2026), 28);   // febrero 2026 (no bisiesto)
  assert.equal(app.getDiasEnMes(1, 2028), 29);   // febrero 2028 (bisiesto)
  assert.equal(app.getDiasEnMes(3, 2026), 30);   // abril
  assert.equal(app.getDiasEnMes(4, 2026), 31);   // mayo
  assert.equal(app.getDiasEnMes(11, 2026), 31);  // diciembre
});

test('getDiasEnMes: siempre entre 28 y 31', () => {
  for (let anio = 2024; anio <= 2040; anio++) {
    for (let mes = 0; mes < 12; mes++) {
      const n = app.getDiasEnMes(mes, anio);
      assert.ok(n >= 28 && n <= 31, `${anio}-${mes} = ${n}`);
    }
  }
});

test('getDiasHabiles: cuenta solo lun-vie', () => {
  // Abril 2026: 30 días, empieza miércoles → 22 hábiles
  assert.equal(app.getDiasHabiles(3, 2026), 22);
  // Febrero 2026: 28 días exactos (4 semanas) → 20 hábiles
  assert.equal(app.getDiasHabiles(1, 2026), 20);
});

test('getDiasHabiles ≤ getDiasEnMes en cualquier mes', () => {
  for (let anio = 2024; anio <= 2034; anio++) {
    for (let mes = 0; mes < 12; mes++) {
      assert.ok(app.getDiasHabiles(mes, anio) <= app.getDiasEnMes(mes, anio));
    }
  }
});

test('esFinDeSemana', () => {
  assert.equal(app.esFinDeSemana(3, 2026, 4), true);   // sáb 4 abr 2026
  assert.equal(app.esFinDeSemana(3, 2026, 5), true);   // dom 5 abr 2026
  assert.equal(app.esFinDeSemana(3, 2026, 6), false);  // lun 6 abr 2026
  assert.equal(app.esFinDeSemana(3, 2026, 3), false);  // vie 3 abr 2026
});
