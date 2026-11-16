// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.0625; // 1/16 celda/frame -> alinea cada 16 frames
const GHOST_SPEED = 0.05;    // 1/20 celda/frame

// Constantes de comportamiento (spec 01)
const CLYDE_FLEE_DISTANCE = 8;                 // umbral Manhattan (celdas)
const CLYDE_CORNER_TARGET = { x: 1, y: 29 };  // celda objetivo de huida (inferior izquierda transitable)
const PINKY_AHEAD = 4;                         // celdas por delante de Pac-Man
const INKY_AHEAD = 2;                          // celdas por delante para el cálculo de Inky

// Constantes de salida de la pen (spec 02)
// La zona de la pen se deriva de la geometría del mapa: la puerta son los
// tiles 3 y el interior son las celdas vacías encerradas justo debajo.
const PEN = penBounds( MAZE );
const PEN_EXIT_TARGET = { x: PEN.doorMin, y: PEN.doorRow - 1 }; // pasillo sobre la puerta

// Calcula los límites de la pen a partir de la puerta (tiles 3) del grid:
// columnas de la puerta, fila de la puerta y rectángulo interior transitable.
function penBounds( grid ) {
  const height = grid.length;
  const width = grid[ 0 ].length;
  let doorRow = -1;
  let doorMin = Infinity;
  let doorMax = -Infinity;
  for ( let y = 0; y < height; y++ ) {
    for ( let x = 0; x < width; x++ ) {
      if ( grid[ y ][ x ] === 3 ) {
        doorRow = y;
        doorMin = Math.min( doorMin, x );
        doorMax = Math.max( doorMax, x );
      }
    }
  }

  // Interior: desde las columnas de la puerta, en la fila de abajo, expandir
  // mientras las celdas sean transitables (0).
  const y0 = doorRow + 1;
  let x0 = doorMin;
  let x1 = doorMax;
  while ( x0 > 0 && grid[ y0 ][ x0 - 1 ] === 0 ) x0--;
  while ( x1 < width - 1 && grid[ y0 ][ x1 + 1 ] === 0 ) x1++;
  let y1 = y0;
  while ( y1 + 1 < height && grid[ y1 + 1 ][ x0 ] === 0 ) y1++;

  return { doorRow, doorMin, doorMax, x0, x1, y0, y1 };
}

// Sigue el fantasma dentro de la pen? Incluye la fila de la puerta para que el
// objetivo de salida no cambie justo al cruzar la puerta (evita oscilaciones).
function isInPen( g ) {
  const x = Math.round( g.x );
  const y = Math.round( g.y );
  if ( y === PEN.doorRow ) return x >= PEN.doorMin && x <= PEN.doorMax;
  return y >= PEN.y0 && y <= PEN.y1 && x >= PEN.x0 && x <= PEN.x1;
}

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      name: g.name,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Helpers de objetivo (spec 01)
function pacmanCell( p ) {
  return { x: Math.round( p.x ), y: Math.round( p.y ) };
}

function cellAhead( actor, n ) {
  const base = { x: Math.round( actor.x ), y: Math.round( actor.y ) };
  const d = DIRS[ actor.dir ];
  if ( !d ) return base;
  return { x: base.x + d.x * n, y: base.y + d.y * n };
}

function manhattan( a, b ) {
  return Math.abs( a.x - b.x ) + Math.abs( a.y - b.y );
}

function bestDirToTarget( choices, fromX, fromY, target ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    if ( !d ) continue;
    const nx = fromX + d.x;
    const ny = fromY + d.y;
    const dist = manhattan( { x: nx, y: ny }, target );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function getBlinky( ghosts ) {
  return ghosts.find( ( g ) => g.kind === 'blinky' ) || null;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  const pCell = pacmanCell( p );
  let target = pCell;

  // Mientras el fantasma siga en la pen, priorizar la salida al mapa (spec 02).
  if ( isInPen( g ) ) {
    target = PEN_EXIT_TARGET;
  } else if ( g.kind === 'blinky' ) {
    target = pCell;
  } else if ( g.kind === 'pinky' ) {
    target = cellAhead( p, PINKY_AHEAD );
  } else if ( g.kind === 'inky' ) {
    const blinky = getBlinky( game.ghosts );
    const ahead = cellAhead( p, INKY_AHEAD );
    if ( blinky && DIRS[ p.dir ] ) {
      const bCell = { x: Math.round( blinky.x ), y: Math.round( blinky.y ) };
      target = {
        x: bCell.x + 2 * ( ahead.x - bCell.x ),
        y: bCell.y + 2 * ( ahead.y - bCell.y ),
      };
    } else {
      target = pCell;
    }
  } else if ( g.kind === 'clyde' ) {
    const gCell = { x: Math.round( g.x ), y: Math.round( g.y ) };
    target = manhattan( gCell, pCell ) > CLYDE_FLEE_DISTANCE
      ? pCell
      : CLYDE_CORNER_TARGET;
  }

  g.dir = bestDirToTarget( choices, g.x, g.y, target );
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
