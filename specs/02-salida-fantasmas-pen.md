# SPEC 02 — Salida de los fantasmas desde la pen al mapa

> **Status:** Implemented  
> **Depends on:** 01-cuatro-fantasmas  
> **Date:** 2026-11-16  
> **Objective:** Corregir el inicio del movimiento de los fantasmas para que abandonen la pen/jaula y entren al mapa jugable, manteniendo sus comportamientos diferenciados una vez fuera.

## Por qué existe esta spec

Con la implementación de la spec 01 (`src/js/game.js`, `src/js/maze.js`), los 4 fantasmas inician dentro de la pen y pueden atravesar la puerta (`3`) por las reglas actuales de `isWall(..., 'ghost')`. Sin embargo, al comenzar a moverse la decisión de dirección en `decideGhost` elige el movimiento que minimiza la distancia Manhattan al objetivo de persecución; como Pac-Man inicia por debajo de la pen, esa elección voraz favorece desplazamientos laterales o hacia abajo dentro de la jaula y los fantasmas quedan atrapados sin salir al mapa. Esta spec define la corrección para forzar la salida al inicio (y tras cada reinicio de posiciones) sin alterar la personalidad de cada fantasma fuera de la pen.

## Alcance

**En:**

- Detectar en `src/js/game.js` si un fantasma se encuentra dentro de la zona de la pen/jaula (según los límites reales del interior en el laberinto).
- Definir una celda objetivo de salida fija y transitable **fuera** de la pen, en el pasillo sobre la puerta (constante en `src/js/game.js`, p. ej. `PEN_EXIT_TARGET`), usada para guiar a los fantasmas hacia el mapa.
- Mientras un fantasma esté dentro de la pen, `decideGhost` debe priorizar como objetivo la celda de salida (en lugar del objetivo propio de `kind`), manteniendo las reglas existentes: solo en celdas alineadas, sin reversa salvo callejón sin salida, y respetando `canMove(grid, x, y, dir, 'ghost')`.
- Una vez que el fantasma haya salido de la pen, debe retomar su comportamiento normal definido en la spec 01 (`blinky`, `pinky`, `inky`, `clyde`) sin estado adicional persistente.
- La corrección debe aplicar tanto al inicio de la partida (`createGame`) como tras cada reinicio de posiciones (`resetPositions`, p. ej. al perder una vida), sin introducir retardos ni salida escalonada.
- Mantener sin cambios: `MAZE` inmutable, `GHOST_SPEED` igual para todos, lógica de movimiento/alineación/túnel, colisiones, vidas, puntuación, condiciones de victoria/derrota y la identidad/posición inicial en `GHOST_STARTS`.

**Fuera de alcance (para futuras specs):**

- Salida escalonada por temporizadores, turnos o contadores de puntos.
- Modos globales scatter/chase por temporizador.
- Cambios de velocidad, dificultad, niveles o IA de persecución más allá de garantizar la salida.
- Power pellets, modo asustado, comer fantasmas o puntuación asociada.
- Evitar de forma general que un fantasma reingrese a la pen en circunstancias distintas al reinicio de posiciones (salvo que sea imprescindible para que la salida funcione).
- Cambios de UI/HTML/CSS, audio o estructura de carga de scripts.

## Modelo de datos

```js
// src/js/game.js — constantes/helpers de salida (valores a confirmar contra el grid)
const PEN_EXIT_TARGET = { x: 13, y: 11 }; // celda transitable sobre la puerta, fuera de la pen

// Helper (nombre orientativo): determina si el fantasma sigue dentro de la pen
function isInPen( g ) {
  // true si la celda/posición del fantasma cae dentro del interior de la jaula
}
```

Convenciones:

- La zona de pen se determina por los límites reales del interior de la jaula en `game.grid`/`MAZE` (rectángulo de celdas interiores delimitado por paredes y puerta), no por suposiciones frágiles.
- `PEN_EXIT_TARGET` debe ser una celda transitable alcanzable desde las 4 posiciones de `GHOST_STARTS`.
- Las decisiones siguen tomándose solo cuando el actor está alineado (`aligned()`).
- `MAZE` en `src/js/maze.js` permanece inmutable; el estado mutable vive en `game.grid`/`game.ghosts`.

## Plan de implementación

1. **Identificar pen y objetivo de salida en `src/js/game.js`.** Inspeccionar la geometría del laberinto y definir `PEN_EXIT_TARGET` como una celda transitable fuera de la pen (sobre la puerta). Añadir `isInPen(g)` (o equivalente) que devuelva `true` mientras el fantasma esté dentro del interior de la jaula. Prueba manual: en consola, verificar que las posiciones iniciales de `GHOST_STARTS` se consideran dentro y que `PEN_EXIT_TARGET` queda fuera y es transitable.

2. **Forzar objetivo de salida en `decideGhost` (`src/js/game.js`).** Antes de calcular el objetivo por personalidad, si `isInPen(g)` es `true`, asignar `target = PEN_EXIT_TARGET`. Mantener el resto del flujo intacto (selección de opciones válidas, sin reversa, `bestDirToTarget`, fallback en callejón). Prueba manual: al iniciar la partida los fantasmas se dirigen hacia la puerta y salen al mapa.

3. **Validar reinicios y comportamientos.** Confirmar que tras `resetPositions` los fantasmas vuelven a la pen y salen nuevamente. Confirmar que, una vez fuera, cada uno retoma su comportamiento de spec 01 sin quedar atrapado. Ajustar `PEN_EXIT_TARGET` o los límites de `isInPen` solo si alguna posición inicial lateral no logra salir. Prueba manual: jugar, perder una vida y observar el ciclo completo.

4. **Verificación final manual.** Abrir `src/index.html`: sin errores en consola; los 4 fantasmas abandonan la pen al empezar y tras cada reinicio; se mueven por el mapa con sus patrones diferenciados; colisiones, vidas, puntuación y victoria/derrota funcionan como antes.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no se producen errores en la consola del navegador.
- [ ] Al iniciar la partida, los 4 fantasmas abandonan la pen y entran al mapa jugable sin quedar atrapados en la jaula.
- [ ] Tras perder una vida y ejecutar `resetPositions`, los 4 fantasmas vuelven a la pen y salen nuevamente al mapa.
- [ ] Una vez fuera de la pen, cada fantasma retoma su comportamiento diferenciado según spec 01 (Blinky, Pinky, Inky, Clyde).
- [ ] No se introducen retardos ni salida escalonada: el inicio de la salida ocurre con el movimiento normal ya existente.
- [ ] Los 4 fantasmas mantienen la misma velocidad (`GHOST_SPEED`) y su identidad/colores.
- [ ] Las colisiones, la pérdida de vidas, `resetPositions`, la puntuación y las condiciones de victoria/derrota siguen funcionando correctamente.
- [ ] `MAZE` permanece inmutable; las mutaciones ocurren solo sobre `game.grid`.

## Decisiones tomadas y descartadas

- **Sí:** forzar la salida priorizando un objetivo de salida fijo mientras el fantasma esté dentro de la pen. Razón: corrige la causa raíz (elección voraz hacia Pac-Man dentro de la jaula) con un cambio mínimo y local en `decideGhost`.
- **Sí:** usar un helper de pertenencia a la pen (`isInPen`) basado en la geometría real del laberinto. Razón: evita heurísticas frágiles y cubre las 4 posiciones iniciales.
- **Sí:** retomar automáticamente el comportamiento por `kind` al estar fuera de la pen, sin estado persistente. Razón: simplicidad y coherencia con spec 01.
- **No:** salida escalonada por timers o puntos. Razón: fuera de alcance; el objetivo es solo corregir que salgan.
- **No:** modificar `MAZE`, posiciones iniciales o velocidades. Razón: no es necesario para la corrección y se preserva el comportamiento aprobado.
- **No:** reescribir la IA de persecución general. Razón: el fallo está acotado a la fase de salida desde la pen.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Los límites de `isInPen` no cubren alguna celda interior o incluyen celdas fuera, dejando a un fantasma sin salir o forzando salida incorrecta. | Derivar límites de la geometría conocida de la pen y validar contra las 4 `GHOST_STARTS` y celdas adyacentes a la puerta. |
| `PEN_EXIT_TARGET` no es transitable o no es alcanzable desde alguna posición inicial lateral. | Elegir/ajustar la constante a una celda `0` verificada en `game.grid` y probar las 4 salidas en partida. |
| Un fantasma oscila en la puerta o en el borde de la pen por el cambio de objetivo al cruzar el límite. | Mantener la regla de no reversa y, si se observa, ajustar finamente el límite de `isInPen` o el objetivo de salida; no introducir estados complejos salvo necesidad. |

## Qué **no** incluye esta spec

- Salida escalonada o temporizada de la pen.
- Modos scatter/chase por temporizador global.
- Power pellets, modo asustado o comer fantasmas.
- Cambios de velocidad, niveles, audio o UI.

Cada uno de esos puntos, si se aborda, debe ir en su propia spec.
