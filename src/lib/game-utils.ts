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
 * Seleciona deterministicamente a quantidade de tarefas configurada pelo Host (`taskCount`)
 * para um jogador específico, aplicando **Dispersão Espacial por Cômodos** e **Variedade de Tipos**.
 *
 * Benefícios para o jogo RP Presencial:
 * 1. Dispersão Espacial: Prioriza tarefas em salas DIFERENTES para evitar aglomeração de jogadores em um só ponto.
 * 2. Variedade de Mecânicas: Evita que múltiplos jogadores fiquem presos na mesma tarefa repetida (ex: 3 motores).
 * 3. Alta Entropia: Usa FNV-1a + Mulberry32 para garantir sementes independentes entre jogadores.
 */
export function getAssignedTasks(
  nodes: TaskNode[],
  taskCount: number,
  seed: string
): TaskNode[] {
  const tasksOnly = (nodes || []).filter((n) => n.type !== 'EMERGENCY_BUTTON');
  if (tasksOnly.length <= taskCount || taskCount <= 0) {
    return tasksOnly;
  }

  const seedHash = fnv1a(seed);
  const prng = createPrng(seedHash);

  // 1. Agrupar tarefas por cômodo/sala do mapa
  const tasksByRoom: Record<string, TaskNode[]> = {};
  for (const task of tasksOnly) {
    const roomKey = (task.room_name || 'Setor Geral').trim();
    if (!tasksByRoom[roomKey]) {
      tasksByRoom[roomKey] = [];
    }
    tasksByRoom[roomKey].push(task);
  }

  // 2. Embaralhar as salas e as tarefas internas de cada sala com base na semente do jogador
  const roomNames = shuffleArray(Object.keys(tasksByRoom), prng);
  const shuffledTasksByRoom: Record<string, TaskNode[]> = {};
  for (const r of roomNames) {
    shuffledTasksByRoom[r] = shuffleArray(tasksByRoom[r], prng);
  }

  const selectedTasks: TaskNode[] = [];
  const selectedTypes = new Set<string>();

  // 3. Rodízio entre salas para garantir que cada tarefa venha de um cômodo diferente (Dispersão Espacial)
  let roomIndex = 0;
  let attempts = 0;
  const maxAttempts = roomNames.length * 4;

  while (selectedTasks.length < taskCount && attempts < maxAttempts) {
    const currentRoom = roomNames[roomIndex % roomNames.length];
    const availableInRoom = shuffledTasksByRoom[currentRoom];

    if (availableInRoom && availableInRoom.length > 0) {
      // Tentar selecionar primeiro uma tarefa cujo tipo ainda não esteja no inventário do jogador
      const preferredIndex = availableInRoom.findIndex((t) => !selectedTypes.has(t.type));
      const chosenTask =
        preferredIndex >= 0
          ? availableInRoom.splice(preferredIndex, 1)[0]
          : availableInRoom.shift()!;

      selectedTasks.push(chosenTask);
      selectedTypes.add(chosenTask.type);
    }

    roomIndex++;
    attempts++;
  }

  // 4. Se ainda faltar preencher até `taskCount`, completar com as restantes embaralhadas
  if (selectedTasks.length < taskCount) {
    const remainingTasks = shuffleArray(
      tasksOnly.filter((t) => !selectedTasks.some((st) => st.id === t.id)),
      prng
    );
    for (const t of remainingTasks) {
      if (selectedTasks.length >= taskCount) break;
      selectedTasks.push(t);
    }
  }

  return selectedTasks.slice(0, taskCount);
}
