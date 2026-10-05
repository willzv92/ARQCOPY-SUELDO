'use strict';

/* ============================================================
   ESTADO DEL FORMULARIO
   Único punto de lectura de los inputs de cabecera. Toda la
   lógica de cálculo consume este objeto en lugar de volver a
   preguntarle al DOM campo por campo.
   ============================================================ */
function readState() {
  const el = (id) => document.getElementById(id);
  return {
    nombre:        el('nombreEmpleado').value.trim(),
    mes:           parseInt(el('mes').value),
    anio:          parseInt(el('anio').value),
    seguro:        el('seguro').value,
    diaInicio:     Math.max(1, parseInt(el('diaInicio')?.value) || 1),
    diaActivacion: parseInt(el('diaActivacion')?.value) || 1,
  };
}

/* ============================================================
   INFO DE SEGURO SOCIAL
   ============================================================ */
function actualizarInfoSeguro() {
  const { seguro: tipo, diaActivacion: dia } = readState();
  const banner      = document.getElementById('seguroInfo');
  const texto       = document.getElementById('seguroInfoText');
  const grupodia    = document.getElementById('grupoDiaActivacion');

  // Mostrar / ocultar campo de día de activación
  if (tipo !== 'ninguno') {
    grupodia.style.display = 'flex';
  } else {
    grupodia.style.display = 'none';
    banner.style.display   = 'none';
    return;
  }

  const tasa  = tipo === 'afp' ? TASA_AFP : TASA_ONP;
  const label = tipo === 'afp' ? 'AFP (11.37%)' : 'ONP (13%)';

  let baseCalculo, descCalc;
  if (dia <= 1) {
    baseCalculo = SUELDO_BASE;
    descCalc    = SUELDO_BASE * tasa;
    banner.style.display = 'flex';
    texto.textContent = `${label}: descuento sobre sueldo base completo ${SUELDO_BASE_TXT} → descuento = ${fmtSol(descCalc)}.`;
  } else {
    baseCalculo = SUELDO_BASE * ((DIAS_MES_BASE - (dia - 1)) / DIAS_MES_BASE);
    descCalc    = baseCalculo * tasa;
    banner.style.display = 'flex';
    texto.textContent = `${label}: activación día ${dia} → base proporcional = ${SUELDO_BASE_TXT} × (${DIAS_MES_BASE - (dia - 1)}/${DIAS_MES_BASE}) = ${fmtSol(baseCalculo)} → descuento = ${fmtSol(descCalc)}.`;
  }
}

/* ============================================================
   INFO DE DÍA DE INICIO LABORAL
   ============================================================ */
function actualizarInfoDiaInicio() {
  const { mes, anio, diaInicio: dia } = readState();
  const banner  = document.getElementById('diaInicioInfo');
  const texto   = document.getElementById('diaInicioInfoText');
  if (!banner || !texto) return;

  const total = getDiasEnMes(mes, anio);

  if (dia <= 1) {
    banner.style.display = 'none';
    return;
  }

  const diasNoPagados = dia - 1;
  const diasLaborales = total - diasNoPagados;
  const sueldoProporcional = SUELDO_BASE * (Math.max(0, DIAS_MES_BASE - diasNoPagados) / DIAS_MES_BASE);

  banner.style.display = 'flex';
  texto.textContent = `El empleado empieza el día ${dia}: los primeros ${diasNoPagados} día(s) no se pagan. `
    + `Laborará ${diasLaborales} día(s) del mes. Sueldo base máximo del período: S/ ${sueldoProporcional.toFixed(2)}.`;
}

