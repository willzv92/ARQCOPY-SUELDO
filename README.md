# Arq-Copy — Planilla de Sueldos

Aplicación **estática** (sin build, sin servidor) para calcular planillas de
sueldo en Perú según la normativa vigente: sueldo mínimo **S/ 1,130**,
jornada de **8 h diarias / 30 días al mes**, horas extras al **25 %** (primeras
2 h) y al **35 %** (a partir de la 3.ª), y descuentos de **AFP (11,37 %)** u
**ONP (13 %)** sobre el sueldo base.

## Cómo usarla

Doble clic en `index.html`. No necesita servidor, ni npm, ni compilar.

```
01 Datos del empleado   → nombre, mes, año, seguro, día de inicio
02 Registro asistencia  → horas de entrada/salida por día
03 Descuentos           → adelantos y consumos
04 Boleta de pago       → cálculo e impresión / PDF
```

## Estructura

```
index.html               UI de los 4 pasos
style.css                estilos de la app
css/print.css            estilos solo para imprimir (van dentro del iframe)
js/
  constants.js           constantes legales y tablas
  lib/fechas.js          getDiasEnMes, getDiasHabiles, esFinDeSemana
  lib/formato.js         fmtSol, fmtHrs, fmtResumenHoras
  core/asistencia.js     barrido único de la tabla, totales y resumen
  core/sueldo.js         cálculo de sueldo (Reglas 1-3)
  ui/form.js             cabecera del formulario (Paso 1)
  ui/tabla.js            tabla de asistencia (Paso 2)
  ui/descuentos.js       descuentos adicionales (Paso 3)
  ui/ejemplos.js         ejemplo y limpiar
  ui/boleta.js           boleta de pago e impresión (Paso 4)
  store/avances.js       persistencia localStorage + export/import JSON
  main.js                arranque y delegación de eventos
tests/
  unit/*.test.js         pruebas unitarias (node --test, sin dependencias)
  harness/golden.js      golden master de 14 escenarios
  harness/delegacion.js  pruebas de los data-action (jsdom)
  fixtures/golden.json   salidas esperadas
```

### Nota de diseño: scripts clásicos, no módulos ES

`index.html` carga **scripts clásicos en orden**, no `<script type="module">`.
Los módulos ES están bloqueados por CORS cuando el archivo se abre con
`file://`, así que obligarían a servir la app por HTTP para poder abrirla con
doble clic. Los nombres viven en el scope global; la separación por carpetas y
el prefijo de dominio de cada archivo evitan colisiones.

Tampoco hay atributos `on*` en línea: todos los eventos se delegan en
`document` desde `ACCIONES{}` en `js/main.js` mediante `data-action`.

## Reglas de cálculo

| | Condición | Resultado |
|---|---|---|
| **Regla 1** | Jornada completa, sin faltas | Sueldo base S/ 1,130 + horas extras |
| **Regla 2** | Faltas cubiertas por horas extras | Sueldo completo; las extras usadas **no** se pagan |
| **Regla 3** | Faltas sin cobertura | Sueldo proporcional: `(horas efectivas / horas reglamentarias) × base` |

Las extras se aplican en orden decreciente de costo (35 % primero, luego 25 %).

**Invariante** (`js/core/asistencia.js`): cada día aporta exactamente 8 h a
uno de dos acumuladores, por lo que `horasBase + deficitBruto === horasRegla`
siempre. Todas las proyecciones (tabla, resumen, stats y boleta) derivan del
mismo barrido único, así que no pueden divergir entre sí.

## Tests

```bash
npm install        # solo la primera vez (jsdom, para las pruebas de UI)
npm test           # unit + golden + delegación
```

| Script | Qué hace | Dependencias |
|---|---|---|
| `npm run test:unit` | 35 pruebas con `node --test` | ninguna |
| `npm run test:golden` | 14 escenarios contra `tests/fixtures/golden.json` | jsdom |
| `npm run test:ui` | 19 comprobaciones de `data-action` | jsdom |
| `npm run golden:capture` | regenera los fixtures (revisar el diff) | jsdom |

Los tests unitarios cargan el bundle real `js/*.js` en un contexto `vm` de
Node con un DOM falso, así que siempre ejercitan el mismo código que corre en
el navegador.

## Limitaciones conocidas

- `js/store/avances.js` contiene un clúster de persistencia en `localStorage`
  (`guardarAvance`, `abrirModalCargar`, `cargarAvance`, `borrarAvance`, …) que
  **no tiene botones** en `index.html`: es código alcanzable solo por
  programación, no por la UI. Solo `mostrarStatus` está en uso (lo llaman
  exportar/importar).
- `style.css` sigue siendo un archivo único de ~1 250 líneas.

## Restaurar

Antes de refactorizar se creó el tag `backup-antes-refactor` y la rama
`backup` sobre el último estado original.

```bash
git switch backup            # o: git switch backup-antes-refactor
```
