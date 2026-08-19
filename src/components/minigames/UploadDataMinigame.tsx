'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, ArrowRight } from 'lucide-react';

interface UploadDataMinigameProps {
  onComplete: () => void;
  onCancel: () => void;
  roomName?: string;
  roomId?: string;
  playerId?: string;
}

const TRANSFER_DURATION_MS = 6000; // ~6 segundos de transferência fluida

function getEstimatedTime(percent: number): string {
  if (percent >= 100) return 'Concluído';
  if (percent < 12) return 'Tempo estimado: 1d 7hr 0m 29s';
  if (percent < 28) return 'Tempo estimado: 18hr 43m 12s';
  if (percent < 48) return 'Tempo estimado: 5hr 16m 40s';
  if (percent < 68) return 'Tempo estimado: 22m 24s';
  if (percent < 85) return 'Tempo estimado: 1m 45s';
  if (percent < 94) return 'Tempo estimado: 8s';
  return 'Tempo estimado: 2s';
}

export const UploadDataMinigame: React.FC<UploadDataMinigameProps> = ({
  onComplete,
  onCancel,
  roomName = 'Armas',
  roomId = 'default',
  playerId = 'self',
}) => {
  // Chave de persistência de estágio para a mecânica de 2 etapas (Download -> Upload na Sede)
  const storageKey = `upload_stage_${roomId}_${playerId}`;

  const [stage, setStage] = useState<1 | 2>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved === '2') return 2;
    }
    return 1;
  });

  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [isStageCompleted, setIsStageCompleted] = useState<boolean>(false);

  const isTransferringRef = useRef<boolean>(false);
  const isCompletedRef = useRef<boolean>(false);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Síntese de áudio retrô Web Audio API
  const playSound = useCallback((type: 'click' | 'step' | 'success') => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'step') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300 + Math.random() * 80, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.04);
      } else if (type === 'success') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
          gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.1);
          osc.stop(ctx.currentTime + i * 0.1 + 0.4);
        });
      }
    } catch {}
  }, []);

  // Iniciar transferência de arquivos
  const handleStartTransfer = () => {
    if (isTransferringRef.current || isCompletedRef.current) return;

    isTransferringRef.current = true;
    setIsTransferring(true);
    startTimeRef.current = Date.now();
    playSound('click');

    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(25);
    }
  };

  // Loop de progresso com animação do boneco
  useEffect(() => {
    if (!isTransferring) return;

    let lastStepTime = 0;

    const tick = () => {
      if (!startTimeRef.current || isCompletedRef.current) return;

      const elapsed = Date.now() - startTimeRef.current;
      const currentPercent = Math.min(100, Math.floor((elapsed / TRANSFER_DURATION_MS) * 100));
      setProgress(currentPercent);

      if (Date.now() - lastStepTime > 160) {
        lastStepTime = Date.now();
        playSound('step');
      }

      if (currentPercent >= 100) {
        isCompletedRef.current = true;
        isTransferringRef.current = false;
        setIsTransferring(false);
        setIsStageCompleted(true);
        playSound('success');

        if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
          navigator.vibrate([60, 50, 60, 50, 200]);
        }

        if (stage === 1) {
          // Salvar conclusão da Etapa 1
          try {
            localStorage.setItem(storageKey, '2');
          } catch {}
        } else {
          // Etapa 2 concluída: Limpar storage e concluir minigame
          try {
            localStorage.removeItem(storageKey);
          } catch {}
          setTimeout(() => {
            onComplete();
          }, 1200);
        }
        return;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isTransferring, stage, storageKey, onComplete, playSound]);

  // Avançar manualmente para a Etapa 2
  const handleAdvanceToStage2 = () => {
    setStage(2);
    setProgress(0);
    setIsStageCompleted(false);
    isCompletedRef.current = false;
    isTransferringRef.current = false;
    startTimeRef.current = null;
    playSound('click');
  };

  // Nomes e Ícones dos Nós
  const sourceLabel = stage === 1 ? roomName : 'Tablet pessoal';
  const targetLabel = stage === 1 ? 'Tablet pessoal' : 'Sede';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 p-3 sm:p-4 flex items-center justify-center select-none animate-in fade-in">
      {/* Moldura do Tablet de Alumínio / Prata Among Us */}
      <div className="w-full max-w-md bg-[#666d78] border-4 border-[#3e444d] rounded-3xl p-3 sm:p-4 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_20px_50px_rgba(0,0,0,0.9)] relative flex flex-col items-center">
        {/* Botão Fechar Redondo com X (Estilo Oficial Top-Left) */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[#f1f5f9] border-3 border-[#334155] shadow-lg flex items-center justify-center text-slate-800 font-black hover:bg-white active:scale-90 transition-transform cursor-pointer z-30"
          title="Fechar"
        >
          <X className="w-5 h-5 stroke-[3]" />
        </button>

        {/* Indicador de Etapa Superior */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-[10px] font-mono font-bold bg-[#383e47] text-cyan-300 border border-cyan-500/40 px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
            ETAPA {stage} DE 2 • {stage === 1 ? 'BAIXAR DADOS' : 'ENVIAR PARA A SEDE'}
          </span>
        </div>

        {/* Tela de Vidro Azul Brilhante com Reflexos Diagonais (Fiel ao Among Us) */}
        <div className="w-full bg-gradient-to-br from-[#4c7ba8] via-[#3a658f] to-[#2b5177] border-3 border-[#243547] rounded-2xl p-4 sm:p-5 shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col justify-between min-h-[260px]">
          {/* Brilho e Reflexo de Vidro Diagonal */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20 pointer-events-none" />
          <div className="absolute -top-12 -left-12 w-48 h-96 bg-white/5 rotate-45 pointer-events-none" />

          {/* Área Superior: Pastas de Origem e Destino + Animação Central */}
          <div className="flex items-center justify-between px-2 sm:px-4 pt-2 relative z-10">
            {/* PASTA ESQUERDA (Origem) */}
            <div className="flex flex-col items-center gap-1.5 w-28">
              <div className="relative">
                <svg viewBox="0 0 120 90" className="w-24 h-20 sm:w-28 sm:h-24 filter drop-shadow-md">
                  {/* Papéis dentro da pasta de origem */}
                  <g>
                    <polygon
                      points="28,45 42,12 82,18 68,50"
                      fill="#ffffff"
                      stroke="#333333"
                      strokeWidth="2.5"
                    />
                    <polygon
                      points="38,45 48,6 94,10 84,50"
                      fill="#f1f5f9"
                      stroke="#333333"
                      strokeWidth="2.5"
                    />
                  </g>
                  {/* Aba superior da pasta */}
                  <path
                    d="M 10,25 L 10,12 Q 10,8 15,8 L 40,8 Q 45,8 48,15 L 52,25 Z"
                    fill="#dfad67"
                    stroke="#422c11"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Corpo da pasta */}
                  <rect
                    x="8"
                    y="22"
                    width="104"
                    height="62"
                    rx="4"
                    fill="#eec07b"
                    stroke="#422c11"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Aba frontal da pasta */}
                  <path
                    d="M 8,30 L 112,30 L 106,84 L 14,84 Z"
                    fill="#e5b36a"
                    stroke="#422c11"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-xs font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-center leading-tight">
                {sourceLabel}
              </span>
            </div>

            {/* CENTRO: Botão Transferir OU Tripulante Correndo com Papéis */}
            <div className="flex-1 flex items-center justify-center px-1">
              {!isTransferring && !isStageCompleted && (
                <button
                  type="button"
                  onClick={handleStartTransfer}
                  className="px-4 py-2 bg-gradient-to-b from-[#e2e8f0] via-[#cbd5e1] to-[#94a3b8] hover:from-white hover:to-[#cbd5e1] border-2 border-[#1e293b] rounded-lg shadow-[0_3px_0_#0f172a] active:translate-y-0.5 active:shadow-none font-mono font-bold text-xs text-slate-900 uppercase tracking-wider cursor-pointer transition-all"
                >
                  Transferir
                </button>
              )}

              {/* Boneco Among Us Correndo com os papéis (Fiel à Imagem 3 e 5) */}
              {isTransferring && (
                <div
                  style={{
                    transform: `translateX(${(progress - 50) * 0.8}px)`,
                  }}
                  className="transition-transform duration-75 flex items-center justify-center animate-bounce"
                >
                  <svg viewBox="0 0 55 55" className="w-12 h-12 sm:w-14 sm:h-14">
                    {/* Mochila de Oxigênio */}
                    <rect
                      x="8"
                      y="18"
                      width="7"
                      height="16"
                      rx="3"
                      fill="#4c1d95"
                      stroke="#1e1b4b"
                      strokeWidth="2.5"
                    />
                    {/* Corpo */}
                    <ellipse
                      cx="25"
                      cy="26"
                      rx="14"
                      ry="17"
                      fill="#6b21a8"
                      stroke="#1e1b4b"
                      strokeWidth="2.5"
                    />
                    {/* Visor */}
                    <ellipse
                      cx="33"
                      cy="21"
                      rx="9"
                      ry="6"
                      fill="#7dd3fc"
                      stroke="#1e1b4b"
                      strokeWidth="2.5"
                    />
                    <ellipse
                      cx="34"
                      cy="19.5"
                      rx="6"
                      ry="3"
                      fill="#ffffff"
                    />
                    {/* Pernas correndo */}
                    <rect
                      x="16"
                      y="38"
                      width="6"
                      height="10"
                      rx="2.5"
                      fill="#4c1d95"
                      stroke="#1e1b4b"
                      strokeWidth="2.5"
                    />
                    <rect
                      x="27"
                      y="38"
                      width="6"
                      height="10"
                      rx="2.5"
                      fill="#4c1d95"
                      stroke="#1e1b4b"
                      strokeWidth="2.5"
                    />
                    {/* Papéis nos braços do boneco */}
                    <g transform="translate(28, 16) rotate(14)">
                      <rect
                        x="0"
                        y="0"
                        width="14"
                        height="18"
                        rx="1.5"
                        fill="#ffffff"
                        stroke="#1e1b4b"
                        strokeWidth="2"
                      />
                      <line x1="3" y1="5" x2="11" y2="5" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="3" y1="9" x2="11" y2="9" stroke="#94a3b8" strokeWidth="1.5" />
                      <line x1="3" y1="13" x2="8" y2="13" stroke="#94a3b8" strokeWidth="1.5" />
                    </g>
                  </svg>
                </div>
              )}
            </div>

            {/* PASTA DIREITA (Destino: Tablet pessoal na Etapa 1 / Sede com Antena na Etapa 2) */}
            <div className="flex flex-col items-center gap-1.5 w-28">
              <div className="relative">
                <svg viewBox="0 0 120 90" className="w-24 h-20 sm:w-28 sm:h-24 filter drop-shadow-md">
                  {/* Antena de Rádio no topo (Exclusiva da Sede na Etapa 2 - Imagem 5) */}
                  {stage === 2 && (
                    <g className="animate-pulse">
                      {/* Torre metálica */}
                      <line x1="60" y1="4" x2="46" y2="24" stroke="#222" strokeWidth="3" strokeLinecap="round" />
                      <line x1="60" y1="4" x2="74" y2="24" stroke="#222" strokeWidth="3" strokeLinecap="round" />
                      <line x1="52" y1="14" x2="68" y2="14" stroke="#222" strokeWidth="2.5" />
                      {/* Esfera do transmissor */}
                      <circle cx="60" cy="4" r="4.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
                      {/* Arcos de transmissão de rádio */}
                      <path d="M 48,4 A 12,12 0 0,1 72,4" fill="none" stroke="#0f172a" strokeWidth="2.5" />
                      <path d="M 40,4 A 20,20 0 0,1 80,4" fill="none" stroke="#0f172a" strokeWidth="2.5" />
                    </g>
                  )}

                  {/* Aba superior */}
                  <path
                    d="M 10,25 L 10,12 Q 10,8 15,8 L 40,8 Q 45,8 48,15 L 52,25 Z"
                    fill="#dfad67"
                    stroke="#422c11"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Corpo da pasta */}
                  <rect
                    x="8"
                    y="22"
                    width="104"
                    height="62"
                    rx="4"
                    fill="#eec07b"
                    stroke="#422c11"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Aba frontal */}
                  <path
                    d="M 8,30 L 112,30 L 106,84 L 14,84 Z"
                    fill="#e5b36a"
                    stroke="#422c11"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-xs font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] text-center leading-tight">
                {targetLabel}
              </span>
            </div>
          </div>

          {/* Área Inferior: Barra de Progresso, Porcentagem e Tempo Estimado */}
          <div className="w-full space-y-2 mt-4 z-10">
            {/* Barra de Progresso e % */}
            <div className="flex items-center gap-3">
              {/* Barra em Cápsula Branca com preenchimento verde sólido */}
              <div className="flex-1 h-5 bg-white border-2 border-[#1e293b] rounded-full overflow-hidden p-0.5 shadow-inner">
                <div
                  style={{ width: `${progress}%` }}
                  className="h-full bg-[#1ebb36] rounded-full transition-all duration-100 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
                />
              </div>
              {/* Porcentagem */}
              <span className="text-sm font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] shrink-0 w-12 text-right">
                {progress}%
              </span>
            </div>

            {/* Tempo Estimado / Concluído (Fiel às Imagens 3 e 4) */}
            <div className="text-xs font-mono text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {getEstimatedTime(progress)}
            </div>
          </div>
        </div>

        {/* Card Informativo de Transição entre Etapas (Etapa 1 Concluída) */}
        {isStageCompleted && stage === 1 && (
          <div className="w-full mt-3 p-3 bg-emerald-950/90 border-2 border-emerald-500/80 rounded-2xl text-center space-y-2 animate-in fade-in">
            <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>ETAPA 1 CONCLUÍDA: DADOS SALVOS NO TABLET!</span>
            </div>
            <p className="text-[11px] font-mono text-slate-300">
              Vá até a <strong>Sede / Comunicações</strong> para enviar os dados.
            </p>
            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={handleAdvanceToStage2}
                className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs font-mono uppercase flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer"
              >
                <span>AVANÇAR PARA A SEDE (ETAPA 2)</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
          </div>
        )}

        {/* Feedback de Conclusão Definitiva (Etapa 2) */}
        {isStageCompleted && stage === 2 && (
          <div className="w-full mt-3 py-2.5 bg-emerald-600 text-slate-950 font-black text-xs font-mono rounded-2xl text-center flex items-center justify-center gap-1.5 shadow-lg animate-bounce">
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>TRANSMISSÃO CONCLUÍDA COM SUCESSO!</span>
          </div>
        )}
      </div>
    </div>
  );
};
