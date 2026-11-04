'use strict';

/* ============================================================
   DESCUENTOS ADICIONALES
   ============================================================ */
let descuentoIdCounter = 0;

function agregarDescuento() {
  const id       = ++descuentoIdCounter;
  const lista    = document.getElementById('listaDescuentos');

  const div = document.createElement('div');
  div.className  = 'descuento-item';
  div.id         = `descItem_${id}`;
  div.innerHTML  = `
    <input type="text" placeholder="Concepto (ej: Adelanto de sueldo, Consumo productos)" id="descConcepto_${id}" />
    <div class="amount-wrap">
      <input type="number" placeholder="0.00" min="0" step="0.01"
             id="descMonto_${id}" data-action="desc-input" data-id="${id}" />
    </div>
    <button class="btn-remove" data-action="del-descuento" data-id="${id}" title="Eliminar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
      </svg>
    </button>
  `;
  lista.appendChild(div);
  actualizarTotalDescuentos();
  document.getElementById(`descConcepto_${id}`).focus();
}

function eliminarDescuento(id) {
  const el = document.getElementById(`descItem_${id}`);
  if (el) el.remove();
  actualizarTotalDescuentos();
}

function obtenerDescuentosAdicionales() {
  const items = document.querySelectorAll('.descuento-item');
  const resultado = [];
  items.forEach(item => {
    const id      = item.id.replace('descItem_', '');
    const monto   = parseFloat(document.getElementById(`descMonto_${id}`)?.value) || 0;
    const concepto = document.getElementById(`descConcepto_${id}`)?.value?.trim() || 'Sin concepto';
    if (monto > 0) resultado.push({ concepto, monto });
  });
  return resultado;
}

function actualizarTotalDescuentos() {
  const lista  = obtenerDescuentosAdicionales();
  const total  = lista.reduce((s, d) => s + d.monto, 0);
  const rowEl  = document.getElementById('descuentoTotalRow');
  const valEl  = document.getElementById('descuentoTotalVal');

  if (rowEl && valEl) {
    rowEl.style.display = lista.length > 0 ? 'flex' : 'none';
    valEl.textContent   = fmtSol(total);
  }

  actualizarStats();
}
