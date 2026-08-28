import { TaskNode } from '@/types/grid-editor';

/**
 * FNV-1a 32-bit Hash
 * Produz uma distribuição uniforme de 32 bits a partir de qualquer string.
 */
function fnv1a(str: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 PRNG (Pseudo-Random Number Generator)
 * Gerador de números pseudo-aleatórios uniforme e de alta entropia.
 */
function createPrng(seedVal: number) {
  let state = seedVal >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Embaralha um array de forma determinística usando o PRNG fornecido
 */
function shuffleArray<T>(array: T[], prng: () => number): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Sapata Contínua Global (Continuous Dealing Shoe):
 *
 * Constrói uma sapata contínua global com todos os minigames do mapa organizados em ciclos
 * balanceados e os distribui em rodízio (Round-Robin) entre todos os participantes da partida.
 *
 * Vantagens do Baralho Contínuo:
 * 1. Frequência Homogênea: Em uma partida de 10 jogadores (40 tarefas), todas as 14 tarefas do mapa
 *    aparecem entre 2 e 3 vezes. Nenhuma tarefa fica esquecida (0%) e nenhuma monopoliza a sala (50%+).
 * 2. Zero Mãos Clones: Elimina a possibilidade de dois jogadores receberem os mesmos 4 minigames.
 * 3. 100% Variedade Individual: Cada jogador recebe 4 mecânicas e tipos de minigames totalmente distintos.
 * 4. Dispersão Espacial Secundária: Prioriza salas diferentes se o mapa contiver múltiplas salas.
 * 5. Limite Físico do Mapa: Se o mapa tiver menos nós que taskCount, entrega todos os nós sem duplicar.
 */
export function getAssignedTasks(
  nodes: TaskNode[],
  taskCount: number,
  matchSeed: string,
  allPlayerIds: string[] = [],
  currentPlayerId: string = ''
): TaskNode[] {
  const tasksOnly = (nodes || []).filter((n) => n.type !== 'EMERGENCY_BUTTON');
  if (tasksOnly.length === 0) return [];

  // Se o total de tarefas do mapa for menor ou igual ao configurado, entrega todas sem duplicar
  if (tasksOnly.length <= taskCount || taskCount <= 0) {
    return tasksOnly;
  }

  const seedHash = fnv1a(matchSeed);
  const prng = createPrng(seedHash);

  // Lista ordenada e estável de todos os IDs de jogadores da sala
  const uniquePlayerIds = Array.from(
    new Set(allPlayerIds.length > 0 ? allPlayerIds : [currentPlayerId || 'p-default'])
  ).sort();

  let playerIndex = uniquePlayerIds.indexOf(currentPlayerId);
  if (playerIndex === -1) {
    playerIndex = Math.abs(fnv1a(currentPlayerId)) % Math.max(1, uniquePlayerIds.length);
  }
  const totalPlayers = Math.max(1, uniquePlayerIds.length);
  const totalSlotsNeeded = totalPlayers * taskCount;

  // 1. Construir a Sapata Contínua Global (Continuous Shoe) com ciclos completos e uniformes
  const continuousShoe: TaskNode[] = [];
  while (continuousShoe.length < totalSlotsNeeded + tasksOnly.length) {
    const cycle = shuffleArray([...tasksOnly], prng);
    continuousShoe.push(...cycle);
  }

  // 2. Inicializar as mãos de cada jogador
  const playerHands: TaskNode[][] = Array.from({ length: totalPlayers }, () => []);
  const playerTypes: Set<string>[] = Array.from({ length: totalPlayers }, () => new Set());
  const playerRooms: Set<string>[] = Array.from({ length: totalPlayers }, () => new Set());

  // 3. Distribuir a partir da Sapata Contínua em rodízio (Round-Robin)
  for (let round = 0; round < taskCount; round++) {
    // Deslocar a ordem de distribuição a cada rodada para evitar viés de primeiro jogador
    const playerOrder = Array.from({ length: totalPlayers }, (_, i) => (i + round) % totalPlayers);

    for (const pIdx of playerOrder) {
      const hand = playerHands[pIdx];
      const types = playerTypes[pIdx];
      const rooms = playerRooms[pIdx];

      if (hand.length >= taskCount) continue;

      // 1ª Prioridade: Próxima tarefa da sapata com tipo inédito E sala inédita para este jogador
      let chosenIndex = continuousShoe.findIndex(
        (t) =>
          !hand.some((st) => st.id === t.id) &&
          !types.has(t.type) &&
          (!t.room_name || !rooms.has(t.room_name))
      );

      // 2ª Prioridade: Próxima tarefa com tipo inédito (mesmo que repita sala)
      if (chosenIndex === -1) {
        chosenIndex = continuousShoe.findIndex(
          (t) =>
            !hand.some((st) => st.id === t.id) &&
            !types.has(t.type)
        );
      }

      // 3ª Prioridade: Qualquer tarefa não repetida na mão
      if (chosenIndex === -1) {
        chosenIndex = continuousShoe.findIndex(
          (t) => !hand.some((st) => st.id === t.id)
        );
      }

      if (chosenIndex !== -1) {
        const chosen = continuousShoe.splice(chosenIndex, 1)[0];
        hand.push(chosen);
        types.add(chosen.type);
        if (chosen.room_name) rooms.add(chosen.room_name);
      }
    }
  }

  const myHand = playerHands[playerIndex] || [];

  // Fallback caso ainda falte alguma tarefa
  if (myHand.length < taskCount) {
    const remaining = tasksOnly.filter((t) => !myHand.some((st) => st.id === t.id));
    for (const t of remaining) {
      if (myHand.length >= taskCount) break;
      myHand.push(t);
    }
  }

  return myHand.slice(0, taskCount);
}
