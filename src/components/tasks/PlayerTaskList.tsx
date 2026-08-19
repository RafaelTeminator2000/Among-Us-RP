'use client';

import React from 'react';
import { TaskNode } from '@/types/grid-editor';
import { Check } from 'lucide-react';

export interface PlayerTaskListProps {
  tasks: TaskNode[];
  completedTasks: string[];
  playerRole?: 'CREWMATE' | 'IMPOSTOR' | null;
}

// Mapeia o tipo da tarefa para o nome limpo exibido na lista informativa
export function getSimpleTaskName(type: string, roomName?: string): string {
  const normalized = (type || '').toUpperCase();

  if (normalized.includes('WIRE')) {
    return 'Painel Elétrico';
  }

  if (normalized.includes('CARD')) {
    return 'Passar Cartão';
  }

  if (normalized.includes('CLEAN_O2') || normalized.includes('FILTER')) {
    return 'Limpar Filtro';
  }

  if (normalized.includes('MANIFOLDS')) {
    return 'Desbloquear Coletores';
  }

  if (normalized.includes('DISTRIBUTOR')) {
    return 'Calibrar Distribuidor';
  }

  if (normalized.includes('KEYPAD') || normalized.includes('OXYGEN')) {
    return 'Digitar Código';
  }

  if (normalized.includes('REACTOR')) {
    return 'Iniciar Reator';
  }

  if (normalized.includes('ASTEROIDS')) {
    return 'Destruir Asteroides';
  }

  if (normalized.includes('GARBAGE')) {
    return 'Esvaziar Lixo';
  }

  if (normalized.includes('ALIGN_ENGINE')) {
    return 'Alinhar Motor';
  }

  if (normalized.includes('REFUEL')) {
    return 'Abastecer Motor';
  }

  if (normalized.includes('SAMPLE') || normalized.includes('INSPECT')) {
    return 'Enviar Amostra';
  }

  if (normalized.includes('DIVERT') || normalized.includes('POWER')) {
    return 'Direcionar Energia';
  }

  if (normalized.includes('UPLOAD') || normalized.includes('DATA') || normalized.includes('DOWNLOAD')) {
    return 'Enviar Dados';
  }

  if (normalized.includes('EMERGENCY_BUTTON')) {
    return 'Botão de Emergência';
  }

  return roomName || 'Manutenção da Nave';
}

export const PlayerTaskList: React.FC<PlayerTaskListProps> = ({
  tasks,
  completedTasks,
  playerRole,
}) => {
  // Filtrar tarefas regulares para exibição na lista informativa
  const displayTasks = tasks.filter((t) => t.type !== 'EMERGENCY_BUTTON');
  const isImpostor = playerRole === 'IMPOSTOR';

  return (
    <div
      className={`w-full border rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 font-mono select-none pointer-events-none transition-colors ${
        isImpostor
          ? 'bg-[#180808]/90 border-red-900/60 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
          : 'bg-[#0b1120]/90 border-slate-800'
      }`}
    >
      {/* Cabeçalho de Tarefas Falsas exclusivo para Impostores */}
      {isImpostor && (
        <div className="flex items-center justify-between pb-2.5 border-b border-red-900/50">
          <span className="text-[11px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
            <span>🔪</span>
            <span>TAREFAS FALSAS (DISFARCE)</span>
          </span>
          <span className="text-[9px] font-bold text-red-300/60 bg-red-950/80 px-2 py-0.5 rounded-full border border-red-800/40">
            SIMULAÇÃO
          </span>
        </div>
      )}

      {displayTasks.map((task, index) => {
        const isCompleted =
          completedTasks.includes(task.id) ||
          completedTasks.some((id) => {
            if (!id) return false;
            const normId = String(id).toUpperCase().replace('TASK_', '').replace('-TASK', '').replace('_TASK', '');
            const normType = String(task.type).toUpperCase();
            return normId === normType || normId.includes(normType) || normType.includes(normId);
          });
        const taskName = getSimpleTaskName(task.type, task.room_name);

        return (
          <div
            key={task.id || `task-${index}`}
            className="flex items-center gap-3.5 py-1 px-1"
          >
            {/* Círculo indicador de status */}
            {isCompleted ? (
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isImpostor
                    ? 'bg-red-500/20 border-red-500 text-red-400'
                    : 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            ) : (
              <div
                className={`w-5 h-5 rounded-full border-2 shrink-0 ${
                  isImpostor
                    ? 'border-red-900/80 bg-red-950/60'
                    : 'border-slate-700 bg-slate-950/80'
                }`}
              />
            )}

            {/* Nome da Tarefa */}
            <span
              className={`text-base font-bold tracking-wider ${
                isCompleted
                  ? isImpostor
                    ? 'line-through text-red-700/60'
                    : 'line-through text-slate-500'
                  : isImpostor
                  ? 'text-red-100'
                  : 'text-white'
              }`}
            >
              {taskName}
            </span>
          </div>
        );
      })}
    </div>
  );
};
