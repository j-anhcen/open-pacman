# SPEC 01 — Cuatro fantasmas clásicos con comportamientos diferenciados

> **Status:** Implementado  
> **Depends on:** —  
> **Date:** 2026-11-15  
> **Objective:** Añadir los cuatro fantasmas clásicos de Pac-Man al juego, cada uno con un comportamiento de movimiento propio y con Blinky persiguiendo agresivamente a Pac-Man.

## Por qué existe esta spec

El juego actual (`src/js/maze.js`, `src/js/game.js`, `src/js/render.js`) solo define 2 fantasmas (`hunter`, `random`) con posiciones dentro de la pen. Se necesita ampliar a los 4 fantasmas clásicos con reglas de objetivo diferenciadas para acercar el comportamiento al arcade, manteniendo la arquitectura actual sin módulos ni dependencias nuevas.

## Alcance

**En:**

- Definir 4 fantasmas clásicos: **Blinky** (rojo), **Pinky** (rosa), **Inky** (cian) y **Clyde** (naranja), con posiciones iniciales dentro de la pen en `src/js/maze.js`.
- Asignar un comportamiento propio a cada fantasma en `src/js/game.js`, con todos a la misma velocidad (`GHOST_SPEED` actual, `0.1` celdas/frame).
- **Blinky (agresivo):** en cada intersección alineada elige la dirección válida (sin reversa, salvo callejón sin salida) que minimiza la distancia Manhattan hasta la celda actual de Pac-Man `(round(pacman.x), round(pacman.y))`.
- **Pinky (emboscada):** en cada intersección elige la dirección que minimiza la distancia Manhattan hasta el objetivo situado **4 celdas por delante** de Pac-Man en su dirección actual (`pacman.dir`). Si la dirección no permite calcular un desplazamiento válido, el objetivo es la celda actual de Pac-Man.
- **Inky (mixto, clásico simplificado):** en cada intersección calcula la celda **2 posiciones por delante** de Pac-Man en su dirección actual; traza el vector desde la celda actual de **Blinky** hasta esa celda y lo duplica (objetivo = celda de Blinky + 2 × (celda adelantada de Pac-Man − celda de Blinky)). Minimiza la distancia Manhattan hasta ese objetivo. Si falta referencia (p. ej. dirección no definida), usa la celda actual de Pac-Man como base del cálculo.
- **Clyde (persecución condicional):** si la distancia Manhattan entre Clyde y Pac-Man es **mayor que 8 celdas**, persigue la celda actual de Pac-Man (como Blinky). Si es **menor o igual a 8 celdas**, se dirige a una celda objetivo fija de “huida” en la zona inferior izquierda transitable del laberinto (constante definida en `src/js/game.js`, p. ej. `{ x: 1, y: 29 }` o la celda transitable equivalente más cercana válida según `grid`).
- Los 4 fantasmas comienzan la partida y cada reinicio de posiciones (`resetPositions`) dentro de la pen, con dirección inicial hacia arriba (`'up'`), **sin retardo ni salida escalonada**; pueden atravesar la puerta de la pen (`3`) según la regla actual de `isWall(..., 'ghost')`.
- Mantener la lógica existente de movimiento por celdas alineadas, túnel en `TUNNEL_ROW`, colisión, pérdida de vida, `resetPositions` y condiciones de victoria/derrota.
- Ajustar `src/js/render.js` solo si es necesario para que los 4 fantasmas se dibujen con los colores clásicos en el orden/identidad correctos (reutilizando `GHOST_COLORS`).

**Fuera de alcance (para futuras specs):**

- Power pellets, modo asustado (frightened), comer fantasmas y puntuación asociada.
- Modos globales scatter/chase por temporizador como en el arcade original.
- Salida escalonada de la pen (timers, contadores de puntos o turnos).
- Cambios de velocidad por fantasma, por nivel o por estado.
- Nuevos niveles, sonidos, animaciones adicionales, puntuaciones altas persistentes o cambios de UI/HTML/CSS más allá de lo estrictamente necesario.
- Ajustes finos de “personalidad” arcade no descritos (p. ej. bug de overflow de Pinky hacia arriba en el original).

## Modelo de datos

```js
// src/js/maze.js — posiciones e identidad de inicio (4 fantasmas clásicos, dentro de la pen)
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky', name: 'Blinky' }, // rojo, perseguidor agresivo
  { x: 14, y: 14, kind: 'pinky',  name: 'Pinky'  }, // rosa, emboscada
  { x: 12, y: 14, kind: 'inky',   name: 'Inky'   }, // cian, mixto
  { x: 15, y: 14, kind: 'clyde',  name: 'Clyde'  }, // naranja, condicional
];
```

```js
// src/js/game.js — estado de cada fantasma en createGame() (se copia desde GHOST_STARTS)
game.ghosts = GHOST_STARTS.map( ( g ) => ( {
  x: g.x,
  y: g.y,
  dir: 'up',
  speed: GHOST_SPEED, // 0.1, igual para todos
  kind: g.kind,       // 'blinky' | 'pinky' | 'inky' | 'clyde'
  name: g.name,
} ) );
```

```js
// src/js/game.js — constantes de comportamiento
const CLYDE_FLEE_DISTANCE = 8;                 // umbral Manhattan (celdas)
const CLYDE_CORNER_TARGET = { x: 1, y: 29 };  // celda objetivo de huida (inferior izquierda transitable)
const PINKY_AHEAD = 4;                         // celdas por delante de Pac-Man
const INKY_AHEAD = 2;                          // celdas por delante para el cálculo de Inky
```

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda; el laberinto es 28×31 (`TILE = 20` en `src/js/render.js`).
- `MAZE` en `src/js/maze.js` es inmutable; `createGame` copia a `game.grid` y toda mutación ocurre sobre `game.grid`.
- Las decisiones de dirección se toman solo cuando el actor está alineado (`aligned()`); no se ajustan posiciones fuera de ese punto salvo el redondeo ya existente al alinear.
- Las distancias de decisión se calculan en **Manhattan** sobre celdas enteras/objetivo de celda, coherente con el `hunter` actual.
- `DIRS` y `OPPOSITE` en `src/js/game.js` siguen siendo la fuente de direcciones; se evita la reversa salvo callejón sin salida.

## Plan de implementación

1. **Actualizar definiciones en `src/js/maze.js`.** Reemplazar `GHOST_STARTS` (2 entradas) por las 4 entradas clásicas con `x`, `y`, `kind` y `name` en celdas libres de la pen; mantener `MAZE`, `TUNNEL_ROW`, `PACMAN_START` y las exportaciones a `window` sin cambios de contrato. Prueba manual: cargar `src/index.html` y confirmar en consola que `GHOST_STARTS.length === 4`.

2. **Adaptar inicialización y reinicio en `src/js/game.js`.** En `createGame`, construir `game.ghosts` a partir de los 4 `GHOST_STARTS` (incluyendo `kind`/`name`, `dir: 'up'`, `speed: GHOST_SPEED`). En `resetPositions`, restablecer los 4 fantasmas a sus posiciones/direcciones iniciales iterando por índice contra `GHOST_STARTS`. Prueba manual: iniciar partida y, tras perder una vida, verificar que los 4 vuelven a la pen.

3. **Implementar helpers de objetivo en `src/js/game.js`.** Añadir funciones puras/locales para: (a) celda de Pac-Man redondeada, (b) celda `n` posiciones por delante según `DIRS[pacman.dir]` con fallback a la celda actual, (c) distancia Manhattan entre dos celdas, (d) selección de la mejor dirección entre opciones válidas dado un objetivo `(tx, ty)`, y (e) obtención de la referencia a Blinky desde `game.ghosts`. Prueba manual: sin cambiar aún `decideGhost`, el juego sigue ejecutándose sin errores.

4. **Implementar comportamientos y despacho en `src/js/game.js`.** Reemplazar/ampliar `decideGhost` para despachar por `g.kind`: `blinky` → objetivo Pac-Man; `pinky` → `PINKY_AHEAD` celdas por delante; `inky` → objetivo por vector doblado desde Blinky usando `INKY_AHEAD`; `clyde` → Pac-Man si distancia Manhattan > `CLYDE_FLEE_DISTANCE`, si no `CLYDE_CORNER_TARGET`. Mantener filtro de opciones (sin reversa, `canMove` para `ghost`) y fallback a reversa en callejón. Prueba manual: observar en juego que cada fantasma sigue un patrón distinto y que Blinky persigue directamente a Pac-Man.

5. **Alinear renderizado e identidad visual en `src/js/render.js` (si aplica).** Verificar que el bucle `game.ghosts.forEach` dibuja los 4 fantasmas y que `GHOST_COLORS` se corresponde con el orden/identidad definido en `GHOST_STARTS` (Blinky rojo, Pinky rosa, Inky cian, Clyde naranja). Ajustar solo el mapeo índice↔color/identidad si el orden difiere. Prueba manual: iniciar partida y confirmar que se ven 4 fantasmas con los colores correctos.

6. **Verificación final manual.** Ejecutar abriendo `src/index.html` en el navegador: sin errores en consola; 4 fantasmas activos a la misma velocidad; cada uno con su comportamiento; Blinky el más agresivo en persecución directa; colisiones y vidas funcionan como antes; comer todos los dots mantiene la condición de victoria.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no se producen errores en la consola del navegador.
- [ ] La partida inicia con **4 fantasmas** visibles dentro de la pen y todos entran en juego sin temporizadores de salida escalonada.
- [ ] Los 4 fantasmas corresponden a Blinky (rojo), Pinky (rosa), Inky (cian) y Clyde (naranja) con colores coherentes con su identidad.
- [ ] **Blinky** persigue agresivamente a Pac-Man dirigiéndose a su celda actual (comportamiento de persecución directa observablemente más directo que Pinky/Inky/Clyde en escenarios de seguimiento).
- [ ] **Pinky** apunta a 4 celdas por delante de la dirección actual de Pac-Man (emboscada) y no replica exactamente la trayectoria de Blinky cuando Pac-Man avanza en línea recta.
- [ ] **Inky** utiliza un objetivo calculado a partir de la posición de Blinky y de la celda 2 posiciones por delante de Pac-Man (vector doblado), mostrando un comportamiento distinto de Blinky, Pinky y Clyde.
- [ ] **Clyde** persigue a Pac-Man cuando la distancia Manhattan es > 8 celdas y se dirige a su objetivo de huida en la zona inferior izquierda cuando la distancia es ≤ 8 celdas.
- [ ] Los 4 fantasmas se mueven a la misma velocidad (`GHOST_SPEED`).
- [ ] Las colisiones con cualquiera de los 4 fantasmas restan una vida y ejecutan `resetPositions` (o llevan a `lost` si no quedan vidas), como en el comportamiento actual.
- [ ] La condición de victoria (`dotsRemaining <= 0` → `won`) y el flujo de reinicio siguen funcionando correctamente.
- [ ] `MAZE` en `src/js/maze.js` permanece inmutable; las mutaciones de dots ocurren solo en `game.grid`.

## Decisiones tomadas y descartadas

- **Sí:** usar los 4 fantasmas clásicos (Blinky, Pinky, Inky, Clyde) con sus colores arcade y nombres explícitos. Razón: claridad, alineación con la petición y reutilización de `GHOST_COLORS` en `src/js/render.js`.
- **Sí:** Blinky como fantasma agresivo con persecución directa a la celda actual de Pac-Man (Manhattan), reutilizando la lógica del `hunter` existente. Razón: cumple el requisito explícito y es verificable.
- **Sí:** Pinky con objetivo 4 celdas por delante de Pac-Man; Inky con regla clásica simplificada (vector desde Blinky a la celda 2 por delante de Pac-Man, duplicado); Clyde con umbral Manhattan de 8 celdas y objetivo fijo de huida en esquina inferior izquierda. Razón: comportamientos diferenciados, concretos y parametrizables con constantes.
- **Sí:** todos los fantasmas a la misma velocidad (`GHOST_SPEED = 0.1`). Razón: decisión explícita del usuario y menor complejidad.
- **Sí:** inicio de los 4 dentro de la pen sin retardo ni salida escalonada, pudiendo salir por la puerta (`3`). Razón: reutiliza geometría y reglas actuales; la salida escalonada queda fuera de alcance.
- **Sí:** distancia Manhattan para decisiones y umbrales. Razón: consistencia con el comportamiento `hunter` actual y simplicidad de cálculo.
- **No:** power pellets, modo asustado y comer fantasmas. Razón: fuera de alcance de esta spec.
- **No:** modos scatter/chase por temporizador global. Razón: fuera de alcance; se prefieren reglas fijas por fantasma.
- **No:** salida escalonada de la pen. Razón: fuera de alcance.
- **No:** cambios en `MAZE`, túnel, velocidades fraccionarias/alineación base o estructura de carga de scripts en `src/index.html`. Razón: no necesarios para el objetivo y se preserva la arquitectura actual.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Las 4 posiciones iniciales propuestas no son todas celdas transitables/interiores válidas en la pen según `MAZE_STR`. | Verificar en el paso 1 contra `MAZE`/`grid` y ajustar `GHOST_STARTS` a celdas libres (`0`) dentro de la pen manteniendo 4 inicios distintos. |
| Inky depende de la posición de Blinky; si el orden o la búsqueda por `kind` falla, su objetivo será incorrecto. | Obtener Blinky por `kind === 'blinky'` desde `game.ghosts` con fallback seguro (p. ej. usar celda de Pac-Man) y mantener `kind` estable en `createGame`/`resetPositions`. |
| El objetivo de huida de Clyde (`CLYDE_CORNER_TARGET`) puede no ser transitable o quedar inaccesible según el camino. | Elegir una celda transitable fija comprobada (p. ej. `(1,29)` si es `0/2` en `grid`) y confiar en la selección greedy por intersección existente; ajustar la constante si la celda no es válida. |
| “4 celdas por delante” puede apuntar fuera de límites o a muro en bordes/túnel. | Calcular el objetivo como desplazamiento por pasos/celda con clamp o uso de la celda avanzada como objetivo geométrico; la elección de dirección sigue limitada por `canMove` en intersecciones. |
| Más fantasmas incrementan la dificultad percibida. | Aceptado como parte del objetivo; no se introducen cambios de velocidad ni mecánicas defensivas en esta spec. |

## Qué **no** incluye esta spec

- Power pellets, modo asustado, ni la posibilidad de comer fantasmas.
- Modos scatter/chase por temporizador global.
- Salida escalonada o por turnos de la pen.
- Variaciones de velocidad, nuevos niveles, audio, persistencia de puntuaciones o cambios de interfaz no necesarios.

Cada uno de esos puntos, si se aborda, debe ir en su propia spec.
