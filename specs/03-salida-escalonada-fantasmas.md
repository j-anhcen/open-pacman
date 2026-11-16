# SPEC 03 — Salida escalonada de los fantasmas desde la pen

> **Status:** Implementado  
> **Depends on:** 01-cuatro-fantasmas, 02-salida-fantasmas-pen  
> **Date:** 2026-11-16  
> **Objective:** Hacer que los cuatro fantasmas abandonen la pen de forma escalonada, con una salida cada 1,5 segundos desde el inicio de la partida.

## Por qué existe esta spec

La spec 02 consigue que los cuatro fantasmas salgan de la pen, pero todos empiezan a salir a la vez en cuanto arranca la partida. El resultado es una salida en bloque, poco legible y muy distinta del arcade, donde los fantasmas entran al mapa de uno en uno.

Esta spec añade un calendario de salidas fijo: el primer fantasma empieza a salir a los 1,5 s, el segundo a los 3 s, el tercero a los 4,5 s y el cuarto a los 6 s. El resto de comportamientos (salida de la pen de la spec 02 y personalidades de la spec 01) no cambia.

## Alcance

**En:**

- Añadir en `src/js/game.js` la constante `GHOST_RELEASE_INTERVAL = 1.5` (segundos).
- Asignar a cada fantasma, en `createGame`, un tiempo absoluto de salida `releaseAt` calculado por su posición en `GHOST_STARTS`: `1,5 · (índice + 1)` segundos. Orden resultante: Blinky 1,5 s, Pinky 3 s, Inky 4,5 s, Clyde 6 s.
- Añadir a cada fantasma el flag `released`, inicialmente `false`, y a la partida el reloj `elapsed`, inicialmente `0` segundos.
- Avanzar `game.elapsed` con el tiempo real transcurrido, pasado como `dt` desde el bucle de `src/js/main.js`.
- En `src/js/main.js`, calcular `dt` a partir del timestamp de `requestAnimationFrame` y acotarlo a `0,1 s` para que una pestaña en segundo plano no dispare de golpe toda la cola de salidas.
- En `update`, marcar `released = true` cuando `game.elapsed >= g.releaseAt` y no mover al fantasma antes de ese momento: los no liberados permanecen quietos en su celda de la pen.
- Una vez liberado, el fantasma usa la lógica de salida de la spec 02 (`isInPen` → `PEN_EXIT_TARGET`) y, ya fuera, su comportamiento de la spec 01.
- Reiniciar la secuencia en `resetPositions`: `elapsed = 0` y todos los fantasmas con `released = false`, de modo que tras perder una vida vuelvan a salir a 1,5 / 3 / 4,5 / 6 s.

**Fuera de alcance (para futuras specs):**

- Cambiar el orden de salida (se mantiene el de `GHOST_STARTS`).
- Condicionar la salida a dots comidos, tiempo dentro de la pen o al estado del jugador (contadores clásicos).
- Convertir todo el movimiento del juego a tiempo real (`dt`); las velocidades siguen siendo celdas por frame.
- Animación de espera dentro de la pen (subir/bajar) o cambios visuales de la pen.
- Modos globales scatter/chase, power pellets, modo asustado o comer fantasmas.
- Cambios de velocidad, dificultad, niveles, audio o UI.

## Modelo de datos

```js
// src/js/game.js — constantes de salida escalonada
const GHOST_RELEASE_INTERVAL = 1.5; // segundos

// createGame()
elapsed: 0, // segundos de partida
ghosts: GHOST_STARTS.map( ( g, i ) => ( {
  // ...campos de spec 01/02 (x, y, dir, speed, kind, name)
  releaseAt: GHOST_RELEASE_INTERVAL * ( i + 1 ), // 1,5 / 3 / 4,5 / 6 s
  released: false,
} ) )

// resetPositions()
game.elapsed = 0;
// cada fantasma: released = false (conserva su releaseAt)
```

Convenciones:

- Los tiempos son absolutos desde el último reinicio de la partida, no relativos a la salida del fantasma anterior.
- `releaseAt` significa "empieza a salir": a los 1,5 s el primer fantasma inicia el recorrido por la pen, no ha terminado de cruzar la puerta.
- El reloj solo avanza mientras `game.state === 'playing'`; no corre en overlays ni en pausa.
- `MAZE` sigue siendo inmutable; el nuevo estado vive en `game` y `game.ghosts`.

## Plan de implementación

1. **Añadir el reloj y el calendario de salidas en `src/js/game.js`.** Crear `GHOST_RELEASE_INTERVAL`, `game.elapsed` y, en cada fantasma, `releaseAt` y `released`. Prueba manual: en consola, comprobar que los cuatro `releaseAt` son `1.5`, `3`, `4.5` y `6`.
2. **Pasar tiempo real desde `src/js/main.js`.** Medir `dt` con el timestamp de `requestAnimationFrame`, acotarlo a `0,1 s` y pasarlo a `update( game, dt )`; `update` asume `1 / 60` si no recibe `dt`. Prueba manual: el juego arranca y se mueve igual que antes.
3. **Bloquear el movimiento hasta el tiempo de salida en `src/js/game.js`.** En `update`, avanzar `elapsed`, marcar `released` al alcanzar `releaseAt` y omitir `moveGhost` para los no liberados. Prueba manual: durante el primer 1,5 s ningún fantasma se mueve; luego salen a 1,5 / 3 / 4,5 / 6 s.
4. **Reiniciar la secuencia en `resetPositions`.** Poner `elapsed = 0` y `released = false` en todos. Prueba manual: perder una vida y verificar que la secuencia vuelve a empezar con la misma cadencia.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no se producen errores en la consola del navegador.
- [ ] La partida arranca con los 4 fantasmas (Blinky, Pinky, Inky y Clyde) visibles en la pen.
- [ ] Durante el primer 1,5 s ningún fantasma se mueve.
- [ ] A los 1,5 s empieza a salir Blinky.
- [ ] A los 3 s empieza a salir Pinky.
- [ ] A los 4,5 s empieza a salir Inky.
- [ ] A los 6 s empieza a salir Clyde.
- [ ] Los fantasmas no liberados permanecen quietos en su celda de la pen.
- [ ] Una vez fuera, cada fantasma retoma su comportamiento de la spec 01.
- [ ] Tras perder una vida, `resetPositions` reinicia `elapsed` y la secuencia vuelve a 1,5 / 3 / 4,5 / 6 s.
- [ ] Las colisiones, las vidas, la puntuación y las condiciones de victoria/derrota siguen funcionando.
- [ ] `MAZE` permanece inmutable y no cambian las velocidades ni la IA.

## Decisiones tomadas y descartadas

- **Sí:** tiempos absolutos (1,5 / 3 / 4,5 / 6 s). Razón: petición explícita y comportamiento predecible.
- **Sí:** reloj real con `dt` desde `requestAnimationFrame`. Razón: 1,5 s deben ser 1,5 s reales también en pantallas de 120 Hz.
- **Sí:** `dt` acotado a `0,1 s`. Razón: evita que volver a una pestaña inactiva libere a todos los fantasmas de golpe.
- **Sí:** fantasmas no liberados quietos en la pen. Razón: mínimo cambio, sin estados ni animaciones nuevas.
- **Sí:** reiniciar la secuencia tras perder una vida. Razón: coherencia con el reinicio de posiciones ya existente.
- **No:** salida encadenada (1,5 s después de que el anterior salga). Razón: el usuario prefirió tiempos absolutos.
- **No:** convertir velocidades a tiempo real. Razón: cambio grande y fuera del objetivo; iría en su propia spec.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Dos fantasmas coinciden en la salida si uno tarda más de 1,5 s en cruzar la puerta. | El trayecto actual es de ~1–1,3 s; si se observa solape, se ajustará la geometría o el intervalo en una spec posterior. |
| Cambiar la firma de `update` rompe llamadas existentes. | `dt` es opcional y cae en `1 / 60`; el único llamador es `src/js/main.js`. |
| El reloj acumulado se desincroniza al cambiar de pestaña. | `dt` acotado y reinicio con `resetPositions`; en cualquier caso los tiempos son cotas mínimas de liberación, nunca bloqueos permanentes. |
| Los tests manuales dependen del refresco del monitor. | La liberación usa tiempo real, no frames; el movimiento sigue siendo por frame como antes. |

## Qué **no** incluye esta spec

- Cambios en el orden de salida ni en la IA de los fantasmas.
- Salida condicionada a dots, niveles o estado del jugador.
- Animaciones dentro de la pen.
- Migrar las velocidades a tiempo real.
- Power pellets, modo asustado, scatter/chase, audio o UI.

Cada uno de esos puntos, si se aborda, debe ir en su propia spec.
