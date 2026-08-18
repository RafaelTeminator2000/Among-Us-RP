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

  if (normalized.includes('EMERGENCY_BUTTON')) {
    return 'Botão de Emergência';
  }

  return roomName || 'Manutenção da Nave';
}

export const PlayerTaskList: React.FC<PlayerTaskListProps> = ({
  tasks,
  completedTasks,
}) => {
  // Filtrar tarefas regulares para exibição na lista informativa
  const displayTasks = tasks.filter((t) => t.type !== 'EMERGENCY_BUTTON');

  return (
    <div className="w-full bg-[#0b1120]/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 font-mono select-none pointer-events-none">
      {displayTasks.map((task, index) => {
        const isCompleted = completedTasks.includes(task.id);
        const taskName = getSimpleTaskName(task.type, task.room_name);

        return (
          <div
            key={task.id || `task-${index}`}
            className="flex items-center gap-3.5 py-1 px-1"
          >
            {/* Círculo indicador de status */}
            {isCompleted ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-slate-700 bg-slate-950/80 shrink-0" />
            )}

            {/* Nome da Tarefa */}
            <span
              className={`text-base font-bold tracking-wider ${
                isCompleted ? 'line-through text-slate-500' : 'text-white'
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
