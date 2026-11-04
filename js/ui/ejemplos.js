'use strict';

/* ============================================================
   LLENAR EJEMPLO
   ============================================================ */
function llenarEjemplo() {
  const { mes, anio, diaInicio } = readState();
  const total = getDiasEnMes(mes, anio);

  // Horarios variados para días laborales
  const salidaOpciones = ['17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30'];

  for (let d = 1; d <= total; d++) {
    if (d < diaInicio) continue; // skip días no laborados

    const esFinde = esFinDeSemana(mes, anio, d);

    const entEl = document.getElementById(`entrada_${d}`);
    const salEl = document.getElementById(`salida_${d}`);
    const almEl = document.getElementById(`almuerzo_${d}`);
    if (!entEl) continue;

    if (esFinde) {
      entEl.value = '';
      salEl.value = '';
      almEl.value = '0';
    } else {
      entEl.value = '08:00';
      salEl.value = salidaOpciones[d % salidaOpciones.length];
      almEl.value = '60';
    }
    calcularFila(d);
  }

  if (!readState().nombre) {
    document.getElementById('nombreEmpleado').value = 'Juan Carlos Flores Ríos';
  }

  // Ejemplo de descuentos
  const lista = document.getElementById('listaDescuentos');
  if (lista && lista.children.length === 0) {
    agregarDescuento();
    setTimeout(() => {
      const firstId = descuentoIdCounter;
      const cEl = document.getElementById(`descConcepto_${firstId}`);
      const mEl = document.getElementById(`descMonto_${firstId}`);
      if (cEl) cEl.value = 'Adelanto de sueldo';
      if (mEl) { mEl.value = '150'; actualizarTotalDescuentos(); }
    }, 50);
  }
}

/* ============================================================
   LIMPIAR TODO
   ============================================================ */
function limpiarTodo() {
  if (!confirm('¿Desea limpiar todos los datos ingresados?')) return;

  document.getElementById('nombreEmpleado').value = '';
  document.getElementById('mes').value  = new Date().getMonth();
  document.getElementById('anio').value = 2026;
  document.getElementById('seguro').value = 'ninguno';
  const diaIniReset = document.getElementById('diaInicio');
  if (diaIniReset) diaIniReset.value = 1;
  actualizarInfoSeguro();
  actualizarInfoDiaInicio();

  document.getElementById('stepAsistencia').style.display  = 'none';
  document.getElementById('stepDescuentos').style.display  = 'none';
  document.getElementById('stepResumen').style.display     = 'none';
  document.getElementById('btnEjemplo').style.display      = 'none';

  document.getElementById('tbodyDias').innerHTML      = '';
  document.getElementById('listaDescuentos').innerHTML = '';
  document.getElementById('boletaContainer').innerHTML = '';
  document.getElementById('statsGrid').innerHTML       = '';

  const totalRow = document.getElementById('descuentoTotalRow');
  if (totalRow) totalRow.style.display = 'none';

  descuentoIdCounter = 0;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
