'use client';

import React, { useState, useRef, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';

interface SwipeCardMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const SwipeCardMinigame: React.FC<SwipeCardMinigameProps> = ({ onComplete, onCancel }) => {
  // Estados do Minigame:
  // isCardInWallet: se o cartão ainda está guardado na carteira
  const [isCardInWallet, setIsCardInWallet] = useState<boolean>(true);
  const [status, setStatus] = useState<
    'INSERT_CARD' | 'SWIPE_CARD' | 'TOO_FAST' | 'TOO_SLOW' | 'BAD_READ' | 'ACCEPTED'
  >('INSERT_CARD');
  const [cardX, setCardX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const startTimeRef = useRef<number | null>(null);
  const startClientXRef = useRef<number>(0);
  const startCardXRef = useRef<number>(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Síntese de áudio WebAudio para cliques e aceitação
  const playTone = useCallback((freq: number, type: OscillatorType = 'sine', duration = 0.1) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, []);

  // Retirar cartão da carteira
  const handleExtractCard = () => {
    if (!isCardInWallet || status === 'ACCEPTED') return;
    playTone(400, 'triangle', 0.08);
    setIsCardInWallet(false);
    setStatus('SWIPE_CARD');
    setCardX(0);
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  // Iniciar arraste na fenda
  const startDrag = (clientX: number) => {
    if (isCardInWallet || status === 'ACCEPTED') return;
    setIsDragging(true);
    startTimeRef.current = Date.now();
    startClientXRef.current = clientX;
    startCardXRef.current = cardX;
    setStatus('SWIPE_CARD');
  };

  // Mover durante o arraste
  const moveDrag = (clientX: number) => {
    if (!isDragging || !trackRef.current) return;

    const trackWidth = trackRef.current.clientWidth;
    const cardWidth = 110; // largura do cartão
    const maxTravel = Math.max(0, trackWidth - cardWidth);

    const deltaX = clientX - startClientXRef.current;
    const newX = Math.max(0, Math.min(startCardXRef.current + deltaX, maxTravel));
    setCardX(newX);
  };

  // Finalizar arraste e calcular velocidade
  const endDrag = () => {
    if (!isDragging || !startTimeRef.current || !trackRef.current) return;
    setIsDragging(false);

    const duration = Date.now() - startTimeRef.current;
    const trackWidth = trackRef.current.clientWidth;
    const cardWidth = 110;
    const maxTravel = Math.max(0, trackWidth - cardWidth);

    // Se não completou pelo menos 80% do percurso
    if (cardX < maxTravel * 0.8) {
      playTone(220, 'sawtooth', 0.2);
      setStatus('BAD_READ');
      setCardX(0);
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }
      return;
    }

    // Regras de tempo do Among Us original:
    // Muito rápido: < 350ms
    // Muito lento: > 1100ms
    // Ideal: entre 350ms e 1100ms
    if (duration < 350) {
      playTone(200, 'sawtooth', 0.25);
      setStatus('TOO_FAST');
      setCardX(0);
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([80, 40, 80]);
      }
    } else if (duration > 1100) {
      playTone(200, 'sawtooth', 0.25);
      setStatus('TOO_SLOW');
      setCardX(0);
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([80, 40, 80]);
      }
    } else {
      // SUCESSO!
      playTone(587.33, 'sine', 0.12);
      setTimeout(() => playTone(880, 'sine', 0.25), 120);
      setStatus('ACCEPTED');
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        navigator.vibrate([40, 80, 40, 80, 150]);
      }
      setTimeout(() => {
        onComplete();
      }, 750);
    }
  };

  const isGreenActive = status === 'ACCEPTED';
  const isRedActive = status === 'TOO_FAST' || status === 'TOO_SLOW' || status === 'BAD_READ';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Console do Leitor de Cartão */}
      <div className="w-full max-w-sm bg-slate-800 border-4 border-slate-600 rounded-3xl p-5 shadow-2xl relative overflow-hidden flex flex-col items-center gap-4">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 left-3 text-slate-400 hover:text-white p-1.5 rounded-full bg-slate-900 border border-slate-700 transition-colors z-20 cursor-pointer shadow active:scale-95"
          title="Fechar Minigame"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Título do Terminal */}
        <div className="text-center pt-1 pb-1 pl-10 pr-2 w-full">
          <h2
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-xl uppercase tracking-wider text-slate-100"
          >
            PASSAR CARTÃO
          </h2>
          <p className="text-[10px] font-mono font-bold text-slate-400">
            Retire o crachá da carteira e deslize na fenda
          </p>
        </div>

        {/* Display LCD e LEDs Indicadores */}
        <div className="w-full bg-[#020617] p-3 rounded-2xl border-2 border-slate-700 shadow-inner flex items-center justify-between gap-3">
          <div className="flex-1 text-center font-mono text-xs font-black tracking-wider">
            {status === 'INSERT_CARD' && (
              <span className="text-cyan-400">POR FAVOR, RETIRE O CARTÃO</span>
            )}
            {status === 'SWIPE_CARD' && (
              <span className="text-yellow-400 animate-pulse">DESLIZE O CARTÃO NA FENDA</span>
            )}
            {status === 'TOO_FAST' && (
              <span className="text-red-400 flex items-center justify-center gap-1.5 animate-shake">
                <AlertCircle className="w-3.5 h-3.5" />
                MUITO RÁPIDO. TENTE DE NOVO.
              </span>
            )}
            {status === 'TOO_SLOW' && (
              <span className="text-red-400 flex items-center justify-center gap-1.5 animate-shake">
                <AlertCircle className="w-3.5 h-3.5" />
                MUITO LENTO. TENTE DE NOVO.
              </span>
            )}
            {status === 'BAD_READ' && (
              <span className="text-red-400 flex items-center justify-center gap-1.5 animate-shake">
                <AlertCircle className="w-3.5 h-3.5" />
                LEITURA INCOMPLETA.
              </span>
            )}
            {status === 'ACCEPTED' && (
              <span className="text-emerald-400 flex items-center justify-center gap-1.5 animate-pulse">
                <CheckCircle2 className="w-4 h-4" />
                ACESSO PERMITIDO. OBRIGADO.
              </span>
            )}
          </div>

          {/* Luzes Indicadoras (Vermelho / Verde) */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <div
              className={`w-3.5 h-3.5 rounded-full border border-black transition-all ${
                isRedActive
                  ? 'bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse'
                  : 'bg-red-950/60'
              }`}
            />
            <div
              className={`w-3.5 h-3.5 rounded-full border border-black transition-all ${
                isGreenActive
                  ? 'bg-emerald-400 shadow-[0_0_12px_#10b981] animate-pulse'
                  : 'bg-emerald-950/60'
              }`}
            />
          </div>
        </div>

        {/* Fenda Horizontal do Leitor (Swipe Track) */}
        <div
          ref={trackRef}
          className="relative w-full h-24 bg-slate-950 rounded-2xl border-2 border-slate-900 flex items-center px-2 overflow-hidden shadow-inner touch-none"
        >
          {/* Trilho da fenda magnética */}
          <div className="absolute inset-x-0 h-4 bg-slate-900 border-y border-slate-800 top-1/2 -translate-y-1/2 shadow-inner" />
          <div className="absolute right-4 text-[9px] font-mono font-bold text-slate-700 tracking-widest pointer-events-none">
            MAGNETIC STRIPE READER ▶▶
          </div>

          {/* Cartão de Acesso Deslizável (quando fora da carteira) */}
          {!isCardInWallet && (
            <div
              onTouchStart={(e) => startDrag(e.touches[0].clientX)}
              onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
              onTouchEnd={endDrag}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                startDrag(e.clientX);
              }}
              onPointerMove={(e) => moveDrag(e.clientX)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{ transform: `translateX(${cardX}px)` }}
              className={`w-[110px] h-[64px] bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 rounded-xl shadow-2xl cursor-grab active:cursor-grabbing flex items-center justify-between px-3 text-slate-950 font-black text-xs z-10 touch-none border-2 border-yellow-200 shadow-[0_4px_15px_rgba(0,0,0,0.6)] ${
                status === 'ACCEPTED' ? 'opacity-90' : ''
              }`}
            >
              <div className="flex flex-col">
                <span
                  style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                  className="text-xs uppercase tracking-wider leading-none"
                >
                  TRIPULANTE
                </span>
                <span className="text-[8px] font-mono opacity-80 mt-0.5">ID: #0492</span>
              </div>

              {/* Foto / Ícone do Visor do Tripulante */}
              <div className="w-7 h-7 rounded-lg bg-slate-900 p-0.5 flex items-center justify-center border border-black/30">
                <div className="w-4 h-2.5 bg-cyan-300 rounded-full shadow-inner" />
              </div>
            </div>
          )}
        </div>

        {/* Carteira de Couro na Base (Fiel ao Original) */}
        <div className="w-full bg-[#3d271d] border-4 border-[#241711] rounded-2xl p-4 shadow-2xl relative flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-mono font-bold text-[#a8826d] uppercase tracking-wider border-b border-[#543628] pb-1.5 mb-2">
            <span>CARTEIRA PESSOAL</span>
            <span>CREW IDENTIFICATION</span>
          </div>

          {/* Bolso da Carteira */}
          <div className="relative w-full h-20 bg-[#2b1b14] rounded-xl border-2 border-[#1c120d] shadow-inner flex items-center justify-center p-2 overflow-hidden">
            {isCardInWallet ? (
              /* Cartão dentro do bolso da carteira - Tocar para puxar */
              <div
                onClick={handleExtractCard}
                className="w-full h-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 rounded-lg shadow-lg flex items-center justify-between px-4 text-slate-950 font-black cursor-pointer hover:brightness-110 active:scale-95 transition-all border border-yellow-200 animate-pulse"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center">
                    <div className="w-3.5 h-2 bg-cyan-300 rounded-full" />
                  </div>
                  <div>
                    <span
                      style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                      className="text-xs uppercase tracking-wider block"
                    >
                      CRACHÁ DE ACESSO
                    </span>
                    <span className="text-[9px] font-mono opacity-80 block leading-tight">
                      Toque para retirar da carteira
                    </span>
                  </div>
                </div>

                <span className="text-xs font-mono font-black text-slate-900 bg-yellow-300 px-2 py-1 rounded shadow">
                  ▲ PUXAR
                </span>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-[#8a6855] italic text-center">
                Cartão retirado da carteira. Deslize-o na fenda acima.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
