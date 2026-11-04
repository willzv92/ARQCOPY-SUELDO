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
    // Sueldo base del período (variable en el tiempo). Default: sueldo mínimo vigente.
    sueldoBase:    parseFloat(el('sueldoBase')?.value) || SUELDO_BASE,
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

  // Sueldo base real del período (puede diferir del mínimo vigente)
  const sueldoBase = readState().sueldoBase;

  let baseCalculo, descCalc;
  if (dia <= 1) {
    baseCalculo = sueldoBase;
    descCalc    = sueldoBase * tasa;
    banner.style.display = 'flex';
    texto.textContent = `${label}: descuento sobre sueldo base completo ${fmtSol(sueldoBase)} → descuento = ${fmtSol(descCalc)}.`;
  } else {
    baseCalculo = sueldoBase * ((DIAS_MES_BASE - (dia - 1)) / DIAS_MES_BASE);
    descCalc    = baseCalculo * tasa;
    banner.style.display = 'flex';
    texto.textContent = `${label}: activación día ${dia} → base proporcional = ${fmtSol(sueldoBase)} × (${DIAS_MES_BASE - (dia - 1)}/${DIAS_MES_BASE}) = ${fmtSol(baseCalculo)} → descuento = ${fmtSol(descCalc)}.`;
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
  const sueldoBase = readState().sueldoBase;

  if (dia <= 1) {
    banner.style.display = 'none';
    return;
  }

  const diasNoPagados = dia - 1;
  const diasLaborales = total - diasNoPagados;
  const sueldoProporcional = sueldoBase * (Math.max(0, DIAS_MES_BASE - diasNoPagados) / DIAS_MES_BASE);

  banner.style.display = 'flex';
  texto.textContent = `El empleado empieza el día ${dia}: los primeros ${diasNoPagados} día(s) no se pagan. `
    + `Laborará ${diasLaborales} día(s) del mes. Sueldo base máximo del período: S/ ${sueldoProporcional.toFixed(2)}.`;
}

/* ============================================================
   INFO DE SUELDO BASE Y VALOR HORA DERIVADO
   ============================================================ */
function actualizarInfoSueldoBase() {
  const { sueldoBase: base } = readState();
  const banner  = document.getElementById('sueldoBaseInfo');
  const texto   = document.getElementById('sueldoBaseInfoText');
  if (!banner || !texto) return;

  const vh      = valorHoraPara(base);
  const esDefecto = base === SUELDO_BASE;
  banner.style.display = 'flex';
  texto.textContent = `Valor hora: ${fmtSol(vh)} (S/ ${base.toLocaleString('es-PE')} ÷ 30 ÷ 8).`
    + (esDefecto ? ' Usando el sueldo mínimo vigente.' : ' Sueldo base personalizado para este período.');
}

