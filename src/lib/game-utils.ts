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
 * Embaralha um array de forma determinística usando o PRNG fornecido (Fisher-Yates)
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
 * Distribui tarefas para um jogador específico com foco em:
 * 1. Prioridade Absoluta na Variedade de Tipos: Garante que cada jogador receba tipos de minigames
 *    totalmente distintos (sem repetir a mesma mecânica).
 * 2. Dispersão Espacial por Salas: Prioriza tarefas em salas diferentes para fazer o jogador circular pela nave.
 * 3. Alta Entropia Individual: Cada jogador possui sua semente (match + playerId), gerando uma rota
 *    independente e variada entre os 1000+ conjuntos possíveis no mapa.
 * 4. Limite Físico do Mapa: Se o mapa tiver menos nós que taskCount, entrega todas as tarefas existentes sem duplicar.
 */
export function getAssignedTasks(
  nodes: TaskNode[],
  taskCount: number,
  seed: string
): TaskNode[] {
  const tasksOnly = (nodes || []).filter((n) => n.type !== 'EMERGENCY_BUTTON');
  if (tasksOnly.length === 0) return [];

  // Se o total de tarefas do mapa for menor ou igual ao configurado, entrega todas sem duplicar
  if (tasksOnly.length <= taskCount || taskCount <= 0) {
    return tasksOnly;
  }

  const seedHash = fnv1a(seed);
  const prng = createPrng(seedHash);

  // 1. Embaralhar todas as tarefas do mapa com o PRNG único deste jogador
  const shuffledNodes = shuffleArray([...tasksOnly], prng);

  const selectedTasks: TaskNode[] = [];
  const selectedTypes = new Set<string>();
  const selectedRooms = new Set<string>();

  // 2. Passo 1: Selecionar tarefas com TIPO INÉDITO e SALA INÉDITA
  for (const task of shuffledNodes) {
    if (selectedTasks.length >= taskCount) break;

    const taskType = task.type;
    const roomKey = (task.room_name || '').trim();

    if (!selectedTypes.has(taskType) && (!roomKey || !selectedRooms.has(roomKey))) {
      selectedTasks.push(task);
      selectedTypes.add(taskType);
      if (roomKey) selectedRooms.add(roomKey);
    }
  }

  // 3. Passo 2: Se ainda não atingiu taskCount, selecionar tarefas com TIPO INÉDITO (mesmo repetindo sala)
  if (selectedTasks.length < taskCount) {
    for (const task of shuffledNodes) {
      if (selectedTasks.length >= taskCount) break;

      const taskType = task.type;
      const alreadySelected = selectedTasks.some((st) => st.id === task.id);

      if (!alreadySelected && !selectedTypes.has(taskType)) {
        selectedTasks.push(task);
        selectedTypes.add(taskType);
        if (task.room_name) selectedRooms.add(task.room_name);
      }
    }
  }

  // 4. Passo 3: Se o mapa tiver menos tipos distintos do que taskCount (ex: mapa compacto),
  // preencher com os nós restantes que não sejam o mesmo nó físico (evita nós idênticos)
  if (selectedTasks.length < taskCount) {
    for (const task of shuffledNodes) {
      if (selectedTasks.length >= taskCount) break;

      const alreadySelected = selectedTasks.some((st) => st.id === task.id);
      if (!alreadySelected) {
        selectedTasks.push(task);
      }
    }
  }

  return selectedTasks.slice(0, taskCount);
}
