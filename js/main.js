'use strict';

/* ============================================================
   ARQ-COPY — PLANILLA DE SUELDOS
   ARRANQUE Y DELEGACIÓN DE EVENTOS
   ============================================================ */

/* Mapeo data-action -> handler. Ningún elemento del DOM lleva
   atributos on* en línea: todos los eventos se delegan en document
   desde este archivo, así el HTML sigue siendo HTML puro. */
const ACCIONES = {
  click: {
    'generar-dias':      () => generarDias(),
    'llenar-ejemplo':    () => llenarEjemplo(),
    'limpiar':           () => limpiarTodo(),
    'calcular':          () => calcularYMostrar(),
    'imprimir':          () => imprimirBoleta(),
    'agregar-descuento': () => agregarDescuento(),
    'del-descuento':     (el) => eliminarDescuento(+el.dataset.id),
    'exportar':          () => exportarAvance(),
    'cargar-avance':     (el) => cargarAvance(+el.dataset.id),
    'borrar-avance':     (el) => borrarAvance(+el.dataset.id),
  },
  input: {
    'seguro-input':      () => actualizarInfoSeguro(),
    'dia-inicio-input':  () => actualizarInfoDiaInicio(),
    'campo-dia':         (el) => onCampoChange(+el.dataset.dia),
    'desc-input':        () => actualizarTotalDescuentos(),
  },
  change: {
    'seguro-change':     () => actualizarInfoSeguro(),
    'replicar-toggle':   () => replicarHorario(null),
    'importar':          (ev) => importarAvance(ev),
  },
};

function delegar(tipo, ev) {
  // closest(): el data-action puede estar en un botón cuyo hijo
  // (svg, span) fue el target real del click.
  const el = ev.target.closest ? ev.target.closest('[data-action]') : null;
  if (!el) return;
  const handler = ACCIONES[tipo][el.dataset.action];
  if (handler) handler(el, ev);
}

['click', 'input', 'change'].forEach(tipo => {
  document.addEventListener(tipo, (ev) => delegar(tipo, ev));
});

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
(function init() {
  // Poblar selector de años
  const selectAnio = document.getElementById('anio');
  for (let y = 2026; y <= 2126; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === 2026) opt.selected = true;
    selectAnio.appendChild(opt);
  }

  // Seleccionar mes actual
  document.getElementById('mes').value = new Date().getMonth();

  // Info seguro inicial
  actualizarInfoSeguro();
  actualizarInfoDiaInicio();
})();
