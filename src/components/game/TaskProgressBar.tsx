'use client';

import React from 'react';

interface TaskProgressBarProps {
  progressPercentage: number;
}

export const TaskProgressBar: React.FC<TaskProgressBarProps> = ({ progressPercentage }) => {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(progressPercentage)));

  return (
    <div className="w-full bg-[#0f172a] border-2 border-[#334155] p-2 rounded-2xl shadow-xl select-none">
      <div className="flex justify-between text-[11px] font-black uppercase tracking-wider mb-1 px-1">
        <span
          style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
          className="text-slate-200 tracking-wider"
        >
          TOTAL DE TAREFAS CONCLUÍDAS
        </span>
        <span
          style={{ fontFamily: 'var(--font-barlow), Barlow, sans-serif' }}
          className="text-emerald-400 font-bold text-xs"
        >
          {clampedProgress}%
        </span>
      </div>
      <div className="w-full bg-[#020617] h-3.5 rounded-lg overflow-hidden border border-slate-700/80 p-0.5 shadow-inner">
        <div
          className="bg-emerald-500 h-full rounded transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
