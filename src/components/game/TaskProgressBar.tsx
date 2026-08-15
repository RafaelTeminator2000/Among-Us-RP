'use client';

import React from 'react';

interface TaskProgressBarProps {
  progressPercentage: number;
}

export const TaskProgressBar: React.FC<TaskProgressBarProps> = ({ progressPercentage }) => {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progressPercentage)));

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl shadow-lg backdrop-blur-sm select-none">
      <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider mb-1 px-1">
        <span className="text-slate-400">Total de Tarefas Concluídas</span>
        <span className="text-emerald-400 font-mono">{clampedProgress}%</span>
      </div>
      <div className="w-full bg-slate-950 h-3.5 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
        <div
          className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-md shadow-emerald-500/20"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
