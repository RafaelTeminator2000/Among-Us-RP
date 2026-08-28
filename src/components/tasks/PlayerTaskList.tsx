'use client';

import React, { useState, useEffect } from 'react';
import { TaskNode } from '@/types/grid-editor';
import { Check, Clock, Sparkles } from 'lucide-react';

export interface PlayerTaskListProps {
  tasks: TaskNode[];
  completedTasks: string[];
  playerRole?: 'CREWMATE' | 'IMPOSTOR' | null;
  roomId?: string;
  playerId?: string;
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
  roomId = 'default',
  playerId = 'p-self',
}) => {
  // Filtrar tarefas regulares para exibição na lista informativa
  const displayTasks = tasks.filter((t) => t.type !== 'EMERGENCY_BUTTON');

  // Monitorar tempo restante da incubação da amostra (MedBay)
  // null = não iniciada | > 0 = incubando (segundos restantes) | 0 = incubação concluída (pronta)
  const [sampleSecondsLeft, setSampleSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const checkSampleStatus = () => {
      try {
        if (typeof window === 'undefined') return;

        // Chave prioritária com roomId e playerId atuais
        const directKey = `inspect_sample_start_${roomId}_${playerId}`;
        let stored = localStorage.getItem(directKey);

        // Fallbacks se não encontrar com a chave exata
        if (!stored && roomId) {
          stored =
            localStorage.getItem(`inspect_sample_start_${roomId}_p-self`) ||
            localStorage.getItem(`inspect_sample_start_${roomId}_self`);
        }

        // Buscar qualquer chave de amostra iniciada recentemente nesta sala
        if (!stored) {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('inspect_sample_start_')) {
              if (!roomId || roomId === 'default' || k.includes(roomId)) {
                stored = localStorage.getItem(k);
                break;
              }
            }
          }
        }

        if (!stored) {
          setSampleSecondsLeft(null);
          return;
        }

        const startTime = parseInt(stored, 10);
        if (isNaN(startTime)) {
          setSampleSecondsLeft(null);
          return;
        }

        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const remaining = 60 - elapsedSeconds;

        if (remaining > 0) {
          setSampleSecondsLeft(remaining);
        } else {
          setSampleSecondsLeft(0);
        }
      } catch {
        setSampleSecondsLeft(null);
      }
    };

    checkSampleStatus();
    const interval = setInterval(checkSampleStatus, 1000);

    const handleUpdate = () => checkSampleStatus();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('sample_status_changed', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('sample_status_changed', handleUpdate);
    };
  }, [roomId, playerId]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full border rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 font-mono select-none pointer-events-none transition-colors bg-[#0b1120]/90 border-slate-800">
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
        const isSampleTask =
          (task.type && (task.type.toUpperCase().includes('SAMPLE') || task.type.toUpperCase().includes('INSPECT'))) ||
          (task.id && (task.id.toUpperCase().includes('SAMPLE') || task.id.toUpperCase().includes('INSPECT'))) ||
          taskName === 'Enviar Amostra';

        return (
          <div
            key={task.id || `task-${index}`}
            className="flex items-center justify-between gap-2 py-1 px-1"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Círculo indicador de status */}
              {isCompleted ? (
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 bg-emerald-500/20 border-emerald-500 text-emerald-400">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 shrink-0 border-slate-700 bg-slate-950/80" />
              )}

              {/* Nome da Tarefa */}
              <span
                className={`text-base font-bold tracking-wider truncate ${
                  isCompleted ? 'line-through text-slate-500' : 'text-white'
                }`}
              >
                {taskName}
              </span>
            </div>

            {/* Status / Contador da Análise de Amostra */}
            {isSampleTask && !isCompleted && sampleSecondsLeft !== null && (
              sampleSecondsLeft > 0 ? (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold animate-pulse shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                  title="Amostra em processo de incubação"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span>{formatTime(sampleSecondsLeft)}</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-400/60 text-emerald-300 text-xs font-mono font-black shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-bounce"
                  title="Incubação finalizada! Retorne à Enfermaria para selecionar o tubo anômalo"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PRONTA!</span>
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
};
