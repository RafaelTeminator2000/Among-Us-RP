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
 * Baralho Global Balanceado (Round-Robin Deck):
 * Distribui tarefas para toda a sala garantindo:
 * 1. Prioridade Máxima na Variedade de Tipos: Cada jogador nunca recebe 2 tarefas da mesma mecânica/tipo (ex: apenas 1 de fiação, 1 de motor, etc).
 * 2. Baralho Balanceado da Sala (Anti-Aglomeração): Distribui as tarefas em rodízio entre os jogadores para evitar que múltiplos jogadores façam a mesma tarefa na mesma partida.
 * 3. Dispersão Espacial por Salas (Secundário): Se o mapa tiver várias salas, prioriza tarefas em salas distintas para incentivar a circulação.
 * 4. Limite Físico do Mapa: Se o mapa tiver menos nós que o taskCount, entrega todas as existentes sem duplicar.
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

  // 1. Agrupar tarefas disponíveis por tipo de minigame
  const tasksByType: Record<string, TaskNode[]> = {};
  for (const task of tasksOnly) {
    if (!tasksByType[task.type]) {
      tasksByType[task.type] = [];
    }
    tasksByType[task.type].push(task);
  }

  // 2. Embaralhar os tipos e as tarefas dentro de cada tipo
  const shuffledTypes = shuffleArray(Object.keys(tasksByType), prng);
  const shuffledDeck: TaskNode[] = [];

  // Criar um deck equilibrado intercalando tipos diferentes
  let hasMore = true;
  let typeRound = 0;
  while (hasMore) {
    hasMore = false;
    for (const t of shuffledTypes) {
      const list = tasksByType[t];
      if (list && typeRound < list.length) {
        shuffledDeck.push(list[typeRound]);
        hasMore = true;
      }
    }
    typeRound++;
  }

  // 3. Distribuir as tarefas do deck para cada jogador em rodízio (Round-Robin Dealing)
  const playerHands: TaskNode[][] = Array.from({ length: totalPlayers }, () => []);
  const playerTypes: Set<string>[] = Array.from({ length: totalPlayers }, () => new Set());
  const playerRooms: Set<string>[] = Array.from({ length: totalPlayers }, () => new Set());

  // Rodadas de distribuição (1 tarefa por jogador por rodada até atingir taskCount)
  for (let round = 0; round < taskCount; round++) {
    const availableForRound = shuffleArray([...shuffledDeck], prng);

    for (let pIdx = 0; pIdx < totalPlayers; pIdx++) {
      const currentHand = playerHands[pIdx];
      const currentTypes = playerTypes[pIdx];
      const currentRooms = playerRooms[pIdx];

      if (currentHand.length >= taskCount) continue;

      // 1ª Prioridade: Tarefa com tipo inédito para este jogador E sala inédita
      let bestIndex = availableForRound.findIndex(
        (t) =>
          !currentHand.some((st) => st.id === t.id) &&
          !currentTypes.has(t.type) &&
          (!t.room_name || !currentRooms.has(t.room_name))
      );

      // 2ª Prioridade: Tarefa com tipo inédito (mesmo que repita sala)
      if (bestIndex === -1) {
        bestIndex = availableForRound.findIndex(
          (t) =>
            !currentHand.some((st) => st.id === t.id) &&
            !currentTypes.has(t.type)
        );
      }

      // 3ª Prioridade: Qualquer tarefa não repetida no inventário do jogador
      if (bestIndex === -1) {
        bestIndex = availableForRound.findIndex(
          (t) => !currentHand.some((st) => st.id === t.id)
        );
      }

      if (bestIndex !== -1) {
        const chosen = availableForRound.splice(bestIndex, 1)[0];
        currentHand.push(chosen);
        currentTypes.add(chosen.type);
        if (chosen.room_name) currentRooms.add(chosen.room_name);
      }
    }
  }

  const myHand = playerHands[playerIndex] || [];

  // Se por alguma razão o jogador ainda tiver menos que taskCount e houver tasks não repetidas
  if (myHand.length < taskCount) {
    const remaining = tasksOnly.filter((t) => !myHand.some((st) => st.id === t.id));
    for (const t of remaining) {
      if (myHand.length >= taskCount) break;
      myHand.push(t);
    }
  }

  return myHand.slice(0, taskCount);
}
