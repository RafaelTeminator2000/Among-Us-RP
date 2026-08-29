'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Megaphone,
  Camera,
  AlertCircle,
  RefreshCw,
  X,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface ReportBodyProps {
  roomId: string;
  roomCode?: string;
  reporterId: string;
  reporterName?: string;
  sendBroadcast?: (event: string, payload: any) => Promise<void>;
  onBodyReported: (deadPlayerName: string) => void;
  onClose?: () => void;
}

// Lista de prefixos e palavras de tarefas conhecidas para evitar falsos reports
const KNOWN_TASK_TOKENS = [
  'TASK_WIRE',
  'TASK_CARD_SWIPE',
  'TASK_MANIFOLDS',
  'TASK_DISTRIBUTOR',
  'TASK_KEYPAD',
  'TASK_REACTOR',
  'TASK_ASTEROIDS',
  'TASK_GARBAGE',
  'TASK_GARBAGE_P1',
  'TASK_GARBAGE_P2',
  'TASK_CLEAN_O2',
  'TASK_ALIGN_ENGINE',
  'TASK_REFUEL',
  'TASK_REFUEL_P1',
  'TASK_REFUEL_P2',
  'TASK_REFUEL_P3',
  'TASK_INSPECT_SAMPLE',
  'TASK_DIVERT_POWER',
  'TASK_DIVERT_POWER_P1',
  'TASK_DIVERT_POWER_P2',
  'TASK_UPLOAD_DATA',
  'TASK_UPLOAD_DATA_P1',
  'TASK_UPLOAD_DATA_P2',
  'TASK_BREAKER',
  'TASK_COMMS',
  'TASK_O2',
  'SABOTAGE_LIGHTS',
  'SABOTAGE_COMMS',
  'SABOTAGE_REACTOR',
  'SABOTAGE_O2',
  'WIRE',
  'CARD_SWIPE',
  'MANIFOLDS',
  'DISTRIBUTOR',
  'KEYPAD',
  'REACTOR',
  'ASTEROIDS',
  'GARBAGE',
  'CLEAN_O2',
  'ALIGN_ENGINE',
  'REFUEL',
  'INSPECT_SAMPLE',
  'DIVERT_POWER',
  'UPLOAD_DATA',
  'BREAKER',
  'LIGHTS',
  'COMMS',
  'OXYGEN',
  'O2',
];

export const ReportBodyScanner: React.FC<ReportBodyProps> = ({
  roomId,
  roomCode,
  reporterId,
  reporterName,
  sendBroadcast,
  onBodyReported,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualPlayerId, setManualPlayerId] = useState('');
  const [isScanned, setIsScanned] = useState(false);
  const [reportedName, setReportedName] = useState<string>('');

  const qrInstanceRef = useRef<Html5Qrcode | null>(null);
  const isScanningLockedRef = useRef<boolean>(false);
  const supabase = createClient();

  const playAlarmSound = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  const handleScanDeadPlayerQR = async (scannedCode: string) => {
    if (!scannedCode || scannedCode.trim() === '') {
      setErrorMessage('Código inválido.');
      isScanningLockedRef.current = false;
      return;
    }

    let raw = scannedCode.trim();

    // Tentar extrair token se for JSON ou URL
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        raw = parsed.token || parsed.type || parsed.id || raw;
      } catch {}
    } else if (raw.includes('/') && !raw.includes(' ')) {
      const segments = raw.split('/');
      raw = segments[segments.length - 1] || raw;
    }

    const cleanToken = raw.toUpperCase().trim();

    // 1. Validar se o usuário escaneou por engano um QR Code de Tarefa
    const isTask =
      KNOWN_TASK_TOKENS.some((t) => cleanToken === t || cleanToken.startsWith(t)) ||
      (cleanToken.startsWith('TASK_') && !cleanToken.includes('REPORT'));

    if (isTask) {
      setErrorMessage(
        '⚠️ Este QR Code é de uma TAREFA da nave. Aponte para a tag REPORT_BODY ou para o QR de um tripulante eliminado!'
      );
      // Liberar o scanner após 2 segundos para tentar novamente
      setTimeout(() => {
        isScanningLockedRef.current = false;
      }, 2000);
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const isValidUuid = (str?: string) =>
        typeof str === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      let deadPlayerName = 'Corpo Encontrado (Tag de Report)';

      // 2. Verificar se é token de Report Geral ou Botão de Emergência
      const isGeneralReportTag =
        cleanToken.includes('REPORT_BODY') ||
        cleanToken.includes('REPORT') ||
        cleanToken.includes('BODY') ||
        cleanToken.includes('CORPO') ||
        cleanToken.includes('EMERGENCY');

      if (isGeneralReportTag) {
        deadPlayerName = 'Corpo Encontrado (QR Físico)';
      } else if (isValidUuid(cleanToken)) {
        // 3. Se for UUID de um jogador específico
        const { data: targetPlayer, error: fetchError } = await supabase
          .from('room_players')
          .select('player_name, status')
          .eq('id', cleanToken)
          .maybeSingle();

        if (fetchError || !targetPlayer) {
          throw new Error('QR Code não reconhecido como jogador ou tag de report.');
        }

        if (targetPlayer.status === 'ALIVE') {
          throw new Error('⚠️ Este jogador ainda está VIVO! Você só pode reportar corpos eliminados.');
        }

        deadPlayerName = targetPlayer.player_name || `Tripulante #${cleanToken.substring(0, 4)}`;
      } else if (cleanToken === 'P4' || cleanToken === 'VERDE') {
        deadPlayerName = 'Verde (Tripulante Eliminado)';
      } else if (cleanToken === 'P2' || cleanToken === 'AZUL') {
        deadPlayerName = 'Azul (Tripulante Eliminado)';
      } else if (cleanToken === 'P3' || cleanToken === 'AMARELO') {
        deadPlayerName = 'Amarelo (Tripulante Eliminado)';
      } else {
        // Tag personalizada de jogador
        deadPlayerName = `Corpo Encontrado (${raw})`;
      }

      // Parar câmera imediatamente
      if (qrInstanceRef.current && qrInstanceRef.current.isScanning) {
        try {
          await qrInstanceRef.current.stop();
        } catch {}
      }

      setIsScanned(true);
      setReportedName(deadPlayerName);
      playAlarmSound();

      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }

      if (isValidUuid(roomId)) {
        await supabase
          .from('rooms')
          .update({ status: 'EMERGENCY_MEETING' })
          .eq('id', roomId);
      }

      const emergencyPayload = {
        reporterId,
        reporterName: reporterName || 'Tripulante',
        deadPlayerName,
        timestamp: Date.now(),
      };

      if (sendBroadcast) {
        await sendBroadcast('emergency_meeting', emergencyPayload);
        await sendBroadcast('EMERGENCY_MEETING', emergencyPayload);
      } else {
        const topicKey = (roomCode || roomId).trim().toLowerCase();
        const channelTopic = `room:${topicKey}:game_flow`;
        const channel = supabase.channel(channelTopic);
        await channel.subscribe();
        await channel.send({
          type: 'broadcast',
          event: 'emergency_meeting',
          payload: emergencyPayload,
        });
      }

      setTimeout(() => {
        onBodyReported(deadPlayerName);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao processar o report.');
      setIsProcessing(false);
      setIsScanned(false);
      // Liberar trava do scanner para tentar outro QR Code
      setTimeout(() => {
        isScanningLockedRef.current = false;
      }, 2000);
    }
  };

  // Inicializar câmera com Html5Qrcode
  useEffect(() => {
    if (showManualInput || isScanned) return;

    let isSubscribed = true;
    isScanningLockedRef.current = false;

    const timer = setTimeout(() => {
      const elementId = 'body-qr-scanner-box';
      const container = document.getElementById(elementId);
      if (!container || !isSubscribed) return;

      const html5QrCode = new Html5Qrcode(elementId);
      qrInstanceRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const minEdgePercentage = 0.8;
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdgeSize * minEdgePercentage);
              return {
                width: Math.max(180, qrboxSize),
                height: Math.max(180, qrboxSize),
              };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isScanningLockedRef.current) return;
            isScanningLockedRef.current = true;

            handleScanDeadPlayerQR(decodedText);
          },
          () => {
            // Frame sem QR Code detectado
          }
        )
        .then(() => {
          if (isSubscribed) {
            setHasPermission(true);
            setErrorMessage(null);
          }
        })
        .catch((err) => {
          console.warn('Erro ao inicializar câmera do scanner de corpos:', err);
          if (isSubscribed) {
            setHasPermission(false);
            setErrorMessage(
              'Não foi possível acessar a câmera traseira. Use a opção de digitar o código.'
            );
          }
        });
    }, 150);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      if (qrInstanceRef.current && qrInstanceRef.current.isScanning) {
        qrInstanceRef.current.stop().catch(() => {});
      }
    };
  }, [showManualInput, isScanned]);

  return (
    <div className="relative w-full max-w-sm mx-auto bg-slate-950 text-white rounded-3xl border-2 border-red-500/80 shadow-[0_0_50px_rgba(239,68,68,0.35)] overflow-hidden p-5 select-none font-sans space-y-4">
      {/* Botão de Fechar */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-900 border border-slate-700 transition cursor-pointer z-30"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Hazard Warning Stripes */}
      <div className="w-full h-2.5 hazard-stripes rounded-full shadow-md" />

      {/* Header com Ícone de Megafone de Emergência */}
      <div className="text-center space-y-1">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-red-500 animate-pulse shadow-lg">
          <Megaphone className="w-7 h-7" />
        </div>

        <h3
          style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
          className="text-xl font-black text-white uppercase tracking-wider mt-2"
        >
          {isScanned ? 'CORPO REPORTADO!' : 'ENCONTROU UM CORPO?'}
        </h3>
        <p className="text-xs text-slate-400">
          {isScanned
            ? 'Convocando Reunião de Emergência para toda a nave...'
            : 'Aponte a câmera para a tag REPORT_BODY ou o QR do jogador eliminado!'}
        </p>
      </div>

      {/* Feedback de Erro ou Alerta */}
      {errorMessage && (
        <div className="bg-red-950/90 border border-red-500/70 text-red-200 text-xs p-3 rounded-2xl flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="leading-tight">{errorMessage}</span>
        </div>
      )}

      {/* Estado: Sucesso após Leitura */}
      {isScanned ? (
        <div className="p-6 bg-red-950/40 border border-red-500/50 rounded-2xl text-center space-y-3 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
              Vítima Identificada:
            </span>
            <h4 className="text-lg font-black text-white uppercase">{reportedName}</h4>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-cyan-400 font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Iniciando sessão de discussão...</span>
          </div>
        </div>
      ) : showManualInput ? (
        /* Modo de Digitação Manual */
        <div className="space-y-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-red-400" />
              <span>Digitar Código / Tag</span>
            </span>
            <button
              type="button"
              onClick={() => setShowManualInput(false)}
              className="text-[11px] text-cyan-400 hover:underline font-mono cursor-pointer"
            >
              Voltar à Câmera
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScanDeadPlayerQR(manualPlayerId);
            }}
            className="space-y-2.5"
          >
            <input
              type="text"
              placeholder="Ex: REPORT_BODY ou ID do Jogador"
              value={manualPlayerId}
              onChange={(e) => setManualPlayerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-red-500 text-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-mono outline-none uppercase placeholder:normal-case placeholder:text-slate-500"
            />

            <button
              type="submit"
              disabled={isProcessing || !manualPlayerId.trim()}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer active:scale-95 transition"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Megaphone className="w-4 h-4" />
              )}
              <span>REPORTAR AGORA</span>
            </button>
          </form>
        </div>
      ) : (
        /* Câmera em Tempo Real com Retículo de Scanner */
        <div className="space-y-3">
          <div className="relative w-full aspect-square bg-[#020617] rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
            {/* Elemento de renderização de vídeo Html5Qrcode */}
            <div
              id="body-qr-scanner-box"
              className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
            />

            {/* Retículo do Scanner e Linha Laser Animada */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              <div className="relative w-48 h-48 border-2 border-red-500/40 rounded-2xl">
                {/* Cantoneiras Brilhantes */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-red-500 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-red-500 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-red-500 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-red-500 rounded-br-lg" />

                {/* Linha Laser Animada */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {hasPermission === false && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center space-y-2 z-20">
                <Camera className="w-8 h-8 text-slate-500" />
                <p className="text-xs text-slate-400">Câmera indisponível no navegador</p>
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="px-3 py-1.5 rounded-xl bg-red-600 text-xs font-bold text-white uppercase shadow-md cursor-pointer"
                >
                  Digitar Código
                </button>
              </div>
            )}
          </div>

          {/* Botão de Alternar para Modo Manual */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold font-mono uppercase flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
            >
              <Keyboard className="w-4 h-4 text-red-400" />
              <span>Digitar Manualmente</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
