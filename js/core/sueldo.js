'use strict';

/* ============================================================
   CÁLCULO DE SUELDO
   Regla 1: horasNoCubiertas = 0 → sueldo = S/1,230 + extras.
   Regla 2: horasNoCubiertas = 0 (cubiertas por extras) → ídem.
   Regla 3: horasNoCubiertas > 0 → sueldo proporcional a horas
            reales: (horasEfectivas / horasRegla) × 1,230 + extras.
   Seguro AFP/ONP: SIEMPRE sobre S/1,230 fijo.
   ============================================================ */
function calcularSueldo(horasEfectivas, horasRegla, totalExtras_25, totalExtras_35, horasNoCubiertas) {
  const st             = readState();
  const tipoSeguro     = st.seguro;
  const valorHora      = VALOR_HORA; // S/ 1,230 / 30 / 8
  const diaInicioV     = st.diaInicio;

  // Sueldo base máximo para el período (proporcional si empezó después del día 1)
  const diasLaboralesPeriodo = DIAS_MES_BASE - (diaInicioV - 1);
  const sueldoBaseMaximo     = SUELDO_BASE * (diasLaboralesPeriodo / DIAS_MES_BASE);

  // Sueldo base proporcional al período
  // - Si no hay déficit residual → sueldoBaseMaximo completo
  // - Si hay déficit → proporcional a horas efectivas
  const sueldoProporcional = horasNoCubiertas > 0
    ? (horasEfectivas / horasRegla) * sueldoBaseMaximo
    : sueldoBaseMaximo;

  // Pago horas extras netas
  const extras_25  = totalExtras_25;
  const extras_35  = totalExtras_35;
  const pagoExtras =
    extras_25 * valorHora * (1 + TASA_EXTRA_25) +
    extras_35 * valorHora * (1 + TASA_EXTRA_35);

  const bruto = sueldoProporcional + pagoExtras;

  // ── Seguro: base siempre S/ 1,230, pero proporcional si activación ≠ día 1
  let descuentoSeguro = 0;
  let labelSeguro     = 'No Inscrito';
  let tasaSeguro      = 0;
  let baseSeguro      = SUELDO_BASE;          // base sobre la que se aplica el %
  let diaActivacion   = 1;
  let esProporcionado = false;

  if (tipoSeguro === 'afp' || tipoSeguro === 'onp') {
    tasaSeguro    = tipoSeguro === 'afp' ? TASA_AFP : TASA_ONP;
    diaActivacion = st.diaActivacion;

    if (diaActivacion > 1) {
      // Proporcional: S/ 1,230 × (30 − (día − 1)) / 30
      const diasEfectivos = DIAS_MES_BASE - (diaActivacion - 1);
      baseSeguro    = SUELDO_BASE * (diasEfectivos / DIAS_MES_BASE);
      esProporcionado = true;
    }

    descuentoSeguro = baseSeguro * tasaSeguro;

    const pct   = (tasaSeguro * 100).toFixed(2);
    const tipo  = tipoSeguro === 'afp' ? 'AFP' : 'ONP';
    labelSeguro = esProporcionado
      ? `${tipo} (${pct}%) — activación día ${diaActivacion}`
      : `${tipo} (${pct}%)`;
  }

  const descuentosAdicionales = obtenerDescuentosAdicionales();
  const totalDescAdicional    = descuentosAdicionales.reduce((s, d) => s + d.monto, 0);

  const neto = bruto - descuentoSeguro - totalDescAdicional;

  return {
    valorHora,
    sueldoProporcional,
    horasNoCubiertas,
    extras_25,
    extras_35,
    pagoExtras,
    bruto,
    descuentoSeguro,
    labelSeguro,
    tasaSeguro,
    baseSeguro,
    diaActivacion,
    esProporcionado,
    descuentosAdicionales,
    totalDescAdicional,
    neto,
  };
}
