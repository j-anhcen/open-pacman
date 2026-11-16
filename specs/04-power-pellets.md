# SPEC 04 — Power pellets y fantasmas comestibles

> **Status:** Implemented  
> **Depends on:** 01-cuatro-fantasmas, 02-salida-fantasmas-pen, 03-salida-escalonada-fantasmas  
> **Date:** 2026-11-16  
> **Objective:** Añadir cuatro power pellets al laberinto que, al comerse, vuelvan temporalmente comestibles a los fantasmas para poder ganar puntos comiéndolos.

## Por qué existe esta spec

Las specs 01, 02 y 03 dejaron los power pellets, el modo asustado y la posibilidad de comer fantasmas explícitamente fuera de alcance. El juego actual solo tiene dots normales: todos los contactos con un fantasma restan una vida, sin ninguna mecánica defensiva.

Esta spec incorpora el power pellet clásico con el mínimo estado nuevo posible y reutilizando la arquitectura existente: el grid de `game.grid` como fuente de verdad, las decisiones por celda alineada y la lógica de pen de las specs 02 y 03.

## Alcance

**En:**

- Añadir el tile `4` (power pellet) al parser de `src/js/maze.js`, representado por el carácter `'o'` en `MAZE_STR`.
- Colocar 4 power pellets en las posiciones clásicas: `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- Contar los tiles `4` en `game.dotsRemaining`, de modo que la victoria exija comer también los 4 power pellets.
- Comer un power pellet: eliminarlo del grid, sumar `50` puntos y activar el modo asustado durante `7` segundos.
- Añadir el estado `game.frightenedTimer` (segundos restantes) y `game.frightenedChain` (fantasmas comidos con el pellet actual).
- Añadir a cada fantasma los flags `frightened` y `eaten`, inicialmente `false`.
- Al activarse el modo asustado, invertir la dirección de todos los fantasmas no comidos y marcarlos como `frightened`.
- Mientras un fantasma esté asustado y fuera de la pen, elegir en cada intersección la dirección válida que **maximice** la distancia Manhattan a la celda actual de Pac-Man, manteniendo la regla de no reversa salvo callejón sin salida.
- Comer un fantasma asustado: sumar `200`, `400`, `800` o `1600` puntos según el orden dentro del pellet actual, marcar el fantasma como `eaten` y no restar vida.
- Un fantasma `eaten` se dibuja solo como ojos, no daña a Pac-Man y no se puede volver a comer; vuelve a la pen, revive al entrar en el interior y sale de nuevo con la lógica de la spec 02.
- Reiniciar el temporizador y el combo al comer un nuevo power pellet.
- Limpiar el modo asustado en `resetPositions`: temporizador a `0`, combo a `0`, y `frightened = false` / `eaten = false` en todos los fantasmas.
- En `src/js/render.js`: dibujar los power pellets más grandes que los dots, los fantasmas asustados en azul con parpadeo blanco durante los últimos `2` segundos y los fantasmas comidos solo como ojos.

**Fuera de alcance (para futuras specs):**

- Cambiar la velocidad de los fantasmas durante el modo asustado; se mantiene `GHOST_SPEED` (`0.05`) para no romper la alineación fraccionaria de celdas.
- Movimiento aleatorio de los fantasmas asustados; la huida es determinista.
- Modos globales scatter/chase por temporizador como en el arcade.
- Parpadeo o animación de los power pellets.
- Sonidos, nuevos niveles, dificultad progresiva, persistencia de puntuaciones, cambios de HUD o de HTML/CSS.
- Comer fantasmas dentro de la pen o impedir que un fantasma asustado entre en ella.

## Modelo de datos

```js
// src/js/maze.js — nuevo tile y posiciones
// '#' pared(1) · '.' dot(2) · '-' puerta pen(3) · 'o' power pellet(4)

// Filas 3 y 23 de MAZE_STR: sustituir el '.' de las columnas 1 y 26 por 'o'.
// Resultado: (1,3), (26,3), (1,23) y (26,23).

function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === 'o' ) return 4;
  return 0;
}
```

```js
// src/js/game.js — constantes del modo asustado
const PELLET_SCORE = 50;
const GHOST_SCORES = [ 200, 400, 800, 1600 ];
const FRIGHTENED_TIME = 7;        // segundos
const FRIGHTENED_FLASH_TIME = 2;  // últimos 2 s parpadeando
const PEN_CENTER = { x: PEN.doorMin, y: PEN.y0 }; // celda interior de referencia
```

```js
// src/js/game.js — createGame()
frightenedTimer: 0, // segundos restantes de modo asustado
frightenedChain: 0, // fantasmas comidos con el pellet actual
ghosts: GHOST_STARTS.map( ( g, i ) => ( {
  // ...campos de specs 01/02/03 (x, y, dir, speed, kind, name, releaseAt, released)
  frightened: false,
  eaten: false,
} ) )
```

Convenciones:

- `MAZE` sigue siendo inmutable; los pellets se comen mutando `game.grid`.
- `dotsRemaining` conserva su nombre y ahora cuenta tiles `2` y `4`; no se renombra para no tocar `main.js`.
- `frightened` indica que el fantasma se puede comer; `eaten` indica que es solo ojos y vuelve a la pen.
- La velocidad no cambia: `GHOST_SPEED` sigue siendo `0.05` celdas/frame.
- Las decisiones de dirección siguen tomándose solo en celdas alineadas.

## Plan de implementación

1. **Añadir los power pellets al laberinto y su puntuación base.** En `src/js/maze.js`, ampliar el comentario y `parseTile` con `'o' → 4`, y sustituir los cuatro `.` por `o` en las filas 3 y 23. En `src/js/game.js`, contar también los tiles `4` en `dotsRemaining` dentro de `createGame` y comerlos en `movePacman` con `PELLET_SCORE` (sin modo asustado todavía). En `src/js/render.js`, dibujar los tiles `4` como dots de radio mayor. Prueba manual: se ven 4 pellets, dan 50 puntos, desaparecen y la partida no se gana mientras quede alguno.

2. **Añadir estado y comportamiento del modo asustado.** En `src/js/game.js`, crear las constantes `PELLET_SCORE`, `GHOST_SCORES`, `FRIGHTENED_TIME` y `PEN_CENTER`; añadir `frightenedTimer`, `frightenedChain`, `frightened` y `eaten` en `createGame`. Implementar `startFrightened(game)`: temporizador a `FRIGHTENED_TIME`, combo a `0`, invertir `dir` y marcar `frightened` en todos los fantasmas no comidos. Llamarlo al comer un tile `4`. En `update`, descontar `frightenedTimer` con `dt` y limpiar `frightened` al llegar a `0`. En `decideGhost`, si el fantasma está asustado y no está en la pen, elegir la dirección que maximiza la distancia Manhattan a Pac-Man. En `resetPositions`, limpiar temporizador, combo y flags. Prueba manual: tras comer un pellet los fantasmas invierten, se alejan durante 7 s y luego recuperan su IA normal.

3. **Dibujar el modo asustado.** En `src/js/render.js`, dibujar el cuerpo del fantasma asustado en azul, con cara asustada y parpadeo entre azul y blanco cuando `game.frightenedTimer <= FRIGHTENED_FLASH_TIME`. Exportar `FRIGHTENED_FLASH_TIME` desde `src/js/game.js` como global para que `render.js` lo use sin duplicar el valor. Prueba manual: el cambio visual coincide con el estado y el parpadeo solo aparece en los últimos 2 s.

4. **Comer fantasmas y devolver los ojos a la pen.** En `src/js/game.js`, reescribir el bucle de colisiones de `update`: ignorar fantasmas `eaten`; si el fantasma está `frightened`, sumar `GHOST_SCORES[frightenedChain]` (limitado a `1600`), incrementar el combo, marcarlo `eaten = true` y `frightened = false`, y continuar con el siguiente fantasma; si no está asustado, aplicar la pérdida de vida existente. En `decideGhost`, priorizar el caso `eaten`: si está en el interior de la pen, revivir (`eaten = false`, `frightened = false`, `dir = 'up'`) y salir con la lógica de la spec 02; si no, usar `PEN_CENTER` como objetivo. En `src/js/render.js`, dibujar los fantasmas `eaten` solo como ojos. Prueba manual: comer un fantasma da 200/400/800/1600, no resta vida, los ojos vuelven a la pen, el fantasma revive y sale de nuevo.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no se producen errores en la consola del navegador.
- [ ] La partida muestra 4 power pellets en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- [ ] Comer un power pellet suma exactamente 50 puntos y lo elimina del grid.
- [ ] La partida no se gana mientras quede algún power pellet sin comer.
- [ ] Comer un power pellet activa el modo asustado y los fantasmas invierten su dirección.
- [ ] Durante 7 segundos los fantasmas se ven azules y huyen de Pac-Man.
- [ ] En los últimos 2 segundos de modo asustado los fantasmas parpadean entre azul y blanco.
- [ ] Al agotarse los 7 segundos los fantasmas recuperan su color y su comportamiento normales.
- [ ] Comer fantasmas asustados con el mismo pellet da 200, 400, 800 y 1600 puntos en ese orden.
- [ ] Un fantasma comido se dibuja solo como ojos, no resta vida y no se puede volver a comer.
- [ ] Los ojos vuelven a la pen, el fantasma revive y sale de nuevo al mapa.
- [ ] Comer un nuevo power pellet reinicia el temporizador y el combo.
- [ ] Tras perder una vida, `resetPositions` elimina el modo asustado y restaura a todos los fantasmas.
- [ ] La puntuación, las vidas, las colisiones normales y las condiciones de victoria/derrota siguen funcionando.
- [ ] `MAZE` permanece inmutable y las velocidades de Pac-Man y de los fantasmas no cambian.

## Decisiones tomadas y descartadas

- **Sí:** tile `4` para el power pellet. Razón: el grid sigue siendo la única fuente de verdad y el render distingue el pellet sin estructuras paralelas.
- **Sí:** las 4 posiciones clásicas `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`. Razón: son celdas transitables verificadas y reproducen la geometría arcade.
- **Sí:** los power pellets cuentan para `dotsRemaining`. Razón: la victoria debe exigir comerlos y evita ganar con pellets pendientes.
- **Sí:** `PELLET_SCORE = 50` y `GHOST_SCORES = [200, 400, 800, 1600]`. Razón: valores clásicos y fáciles de verificar.
- **Sí:** modo asustado de 7 segundos. Razón: ventana suficiente para comer algún fantasma sin alargar demasiado la partida.
- **Sí:** huida determinista maximizando la distancia Manhattan. Razón: reutiliza la lógica de objetivos existente y permite verificarla en pruebas manuales.
- **Sí:** mantener `GHOST_SPEED` sin cambios. Razón: cambiar la velocidad a mitad de celda rompería la alineación fraccionaria y podría atravesar paredes.
- **Sí:** invertir la dirección al activar el modo asustado. Razón: es el comportamiento clásico y con la misma velocidad el fantasma vuelve a alinearse sin saltos.
- **Sí:** los fantasmas comidos vuelven a la pen como ojos y reviven al entrar. Razón: es el comportamiento arcade y reutiliza la geometría de pen de las specs 02 y 03.
- **Sí:** un fantasma revivido vuelve a la normalidad aunque quede tiempo de modo asustado. Razón: evita que un mismo pellet permita comer al mismo fantasma dos veces.
- **Sí:** limpiar todo el estado asustado al perder una vida. Razón: coherencia con el reinicio de posiciones ya existente.
- **No:** movimiento aleatorio de los fantasmas asustados. Razón: la huida determinista es más fácil de comprobar y encaja con la IA voraz actual.
- **No:** reducir la velocidad en modo asustado. Razón: riesgo de romper la alineación; iría en su propia spec si se quiere más fidelidad.
- **No:** parpadeo de los power pellets, sonidos, niveles o cambios de HUD. Razón: no son necesarios para la mecánica y ampliarían el alcance.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| La huida voraz puede hacer que un fantasma oscile en un callejón sin salida. | Se mantiene la regla de no reversa salvo callejón; el comportamiento se valida en prueba manual. |
| Los ojos pueden dar vueltas antes de entrar en la pen por la búsqueda voraz. | Objetivo fijo `PEN_CENTER` y revivir en la primera celda interior alineada; si se observa un bucle, se apunta primero a la celda de la puerta en una spec posterior. |
| Cambiar la velocidad a mitad de celda rompería `aligned()` y el fantasma podría atravesar paredes. | Decisión explícita: no se cambia la velocidad en esta spec. |
| El estado visual puede desincronizarse de la lógica. | `render.js` lee directamente `frightened`, `eaten` y `frightenedTimer` del estado del juego. |
| Un pellet en una celda inalcanzable haría la partida imposible de ganar. | Las 4 posiciones son celdas de pasillo normales del laberinto actual y se verifican en la prueba manual. |
| El temporizador depende de `dt` y una pestaña en segundo plano lo ralentiza. | `dt` ya está acotado a `0,1 s` en `main.js`; el modo asustado es una ventana de tiempo real y no un bloqueo permanente. |

## Qué **no** incluye esta spec

- Cambios de velocidad de Pac-Man o de los fantasmas.
- Movimiento aleatorio de los fantasmas asustados.
- Modos globales scatter/chase por temporizador.
- Parpadeo o animación de los power pellets.
- Sonidos, nuevos niveles, dificultad progresiva, persistencia de puntuaciones o cambios de HUD/HTML/CSS.
- Comer fantasmas dentro de la pen o bloquear su entrada a la pen.

Cada uno de esos puntos, si se aborda, debe ir en su propia spec.
