'use client';

import React, { useState } from 'react';
import { Siren, X, AlertTriangle } from 'lucide-react';

interface EmergencyButtonModalProps {
  playerName: string;
  remainingMeetings?: number;
  onTriggerMeeting: () => void;
  onClose: () => void;
}

export function EmergencyButtonModal({
  playerName,
  remainingMeetings = 1,
  onTriggerMeeting,
  onClose,
}: EmergencyButtonModalProps) {
  const [isLidOpen, setIsLidOpen] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handlePressButton = () => {
    if (!isLidOpen) {
      setIsLidOpen(true);
      return;
    }

    if (remainingMeetings <= 0 || isPressed) return;

    setIsPressed(true);

    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate([100, 100, 200]);
    }

    setTimeout(() => {
      onTriggerMeeting();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="w-full max-w-sm bg-slate-900 border-4 border-slate-700 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-950 border border-slate-700 transition-colors z-20 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Fundo da Mesa de Emergência com Texto Invertido */}
        <div className="w-full h-24 bg-cyan-950/40 rounded-2xl border border-cyan-800/40 flex items-center justify-center relative overflow-hidden mb-4">
          <span
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-4xl uppercase tracking-widest text-cyan-500/20 rotate-180 select-none"
          >
            EMERGENCY
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
              className="text-lg uppercase tracking-wider text-cyan-400 font-black drop-shadow"
            >
              MESA CENTRAL
            </span>
          </div>
        </div>

        {/* Base do Botão de Emergência com Listras de Perigo (Hazard) */}
        <div className="relative p-6 bg-slate-950 rounded-3xl border-4 border-slate-800 shadow-2xl flex flex-col items-center">
          {/* Borda Amarela/Preta Hazard */}
          <div className="w-48 h-48 hazard-stripes rounded-2xl p-4 flex items-center justify-center relative shadow-inner">
            {/* Tampa de Vidro Transparente */}
            <div
              onClick={() => setIsLidOpen(!isLidOpen)}
              className={`absolute inset-2 bg-cyan-200/20 border-2 border-cyan-300/40 backdrop-blur-[2px] rounded-xl z-10 transition-all duration-500 cursor-pointer shadow-lg flex items-center justify-center ${
                isLidOpen
                  ? '-translate-y-16 rotate-12 opacity-40 pointer-events-none'
                  : 'translate-y-0 opacity-90'
              }`}
            >
              {!isLidOpen && (
                <span className="text-[10px] font-mono font-bold text-cyan-200 bg-slate-950/80 px-2.5 py-1 rounded-full border border-cyan-400/40 animate-pulse">
                  Toque para abrir a tampa
                </span>
              )}
            </div>

            {/* O Grande Botão Vermelho 3D */}
            <button
              type="button"
              disabled={remainingMeetings <= 0}
              onClick={handlePressButton}
              className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center transition-all cursor-pointer shadow-2xl select-none ${
                remainingMeetings <= 0
                  ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                  : isPressed
                  ? 'bg-red-800 border-red-950 translate-y-2'
                  : 'btn-3d-red border-red-300 shadow-[0_0_40px_rgba(239,68,68,0.6)] animate-pulse'
              }`}
            >
              <Siren className="w-10 h-10 text-white animate-bounce" />
              <span
                style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                className="text-xs uppercase tracking-widest mt-1 text-white"
              >
                APERTAR
              </span>
            </button>
          </div>
        </div>

        {/* Balão de Fala: "O TRIPULANTE [Nome] TEM [X] REUNIÕES RESTANTES" */}
        <div className="mt-4 p-3.5 bg-slate-950 rounded-2xl border-2 border-dashed border-slate-700 text-center w-full">
          <p
            style={{ fontFamily: 'var(--font-mono), Space Mono, monospace' }}
            className="text-xs font-bold text-slate-300 uppercase tracking-wide leading-relaxed"
          >
            O TRIPULANTE <span className="text-cyan-400">{playerName}</span> TEM{' '}
            <span className="text-red-400 text-base">{remainingMeetings}</span>{' '}
            {remainingMeetings === 1 ? 'REUNIÃO RESTANTE' : 'REUNIÕES RESTANTES'}
          </p>
        </div>
      </div>
    </div>
  );
}
