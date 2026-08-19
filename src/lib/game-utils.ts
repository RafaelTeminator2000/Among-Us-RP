import { TaskNode } from '@/types/grid-editor';

/**
 * Seleciona deterministicamente a quantidade de tarefas configurada pelo Host (`taskCount`)
 * para um jogador específico, utilizando uma semente (roomId + gameStartTime + playerId).
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

  // Gera hash numérico a partir da semente
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  // Gerador Congruencial Linear (LCG) para embaralhamento reproduzível por jogador
  const lcg = () => {
    hash = (hash * 1664525 + 1013904223) % 4294967296;
    return (hash >>> 0) / 4294967296;
  };

  const shuffled = [...tasksOnly];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(lcg() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, taskCount);
}
