"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Megaphone, Camera, AlertCircle, RefreshCw, X } from "lucide-react";

interface ReportBodyProps {
  roomId: string;
  roomCode?: string;
  reporterId: string;
  reporterName?: string;
  sendBroadcast?: (event: string, payload: any) => Promise<void>;
  onBodyReported: (deadPlayerName: string) => void;
  onClose?: () => void;
}

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [manualPlayerId, setManualPlayerId] = useState("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const supabase = createClient();

  // Função acionada ao escanear o QR Code fixado nas costas da vítima
  const handleScanDeadPlayerQR = async (scannedPlayerId: string) => {
    if (!scannedPlayerId || scannedPlayerId.trim() === "") {
      setErrorMsg("Código de jogador inválido.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const isValidUuid = (str?: string) =>
        typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      let deadPlayerName = `Jogador #${scannedPlayerId.substring(0, 4)}`;

      // 1. Verificar se o jogador escaneado realmente está morto (se for UUID válido)
      if (isValidUuid(scannedPlayerId.trim())) {
        const { data: targetPlayer, error: fetchError } = await supabase
          .from("room_players")
          .select("player_name, status")
          .eq("id", scannedPlayerId.trim())
          .maybeSingle();

        if (fetchError || !targetPlayer) {
          throw new Error("QR Code inválido ou jogador não encontrado.");
        }

        if (targetPlayer.status === "ALIVE") {
          throw new Error("Este jogador está vivo! Você só pode reportar corpos.");
        }

        if (targetPlayer.player_name) {
          deadPlayerName = targetPlayer.player_name;
        }
      } else {
        // Fallback para códigos demo/simulação (ex: 'p4' ou 'Verde')
        deadPlayerName = scannedPlayerId === 'p4' ? 'Verde' : scannedPlayerId;
      }

      // 2. Atualizar o status global da sala para 'EMERGENCY_MEETING' no Supabase
      if (isValidUuid(roomId)) {
        const { error: roomUpdateError } = await supabase
          .from("rooms")
          .update({ status: "EMERGENCY_MEETING" })
          .eq("id", roomId);

        if (roomUpdateError) {
          console.warn("Aviso na atualização da sala:", roomUpdateError);
        }
      }

      // 3. Enviar o Broadcast via WebSocket para disparar o alarme e som em todos os celulares
      const emergencyPayload = {
        reporterId,
        reporterName: reporterName || "Tripulante",
        deadPlayerName,
        timestamp: Date.now(),
      };

      if (sendBroadcast) {
        await sendBroadcast("emergency_meeting", emergencyPayload);
        await sendBroadcast("EMERGENCY_MEETING", emergencyPayload);
      } else {
        const topicKey = (roomCode || roomId).trim().toLowerCase();
        const channelTopic = `room:${topicKey}:game_flow`;
        const channel = supabase.channel(channelTopic);
        await channel.subscribe();
        await channel.send({
          type: "broadcast",
          event: "emergency_meeting",
          payload: emergencyPayload,
        });
      }

      // Fechar a câmera caso esteja aberta
      if (scannerRef.current) {
        await scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      setShowCamera(false);

      onBodyReported(deadPlayerName);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao processar o report.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Efeito para gerenciar a câmera com HTML5 QrCode
  useEffect(() => {
    if (!showCamera) return;

    const scanner = new Html5QrcodeScanner(
      "body-qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        handleScanDeadPlayerQR(decodedText);
      },
      () => {
        // Ignora erros de frame vazio durante scan contínuo
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error) => {
          console.error("Falha ao desmontar o scanner de corpos:", error);
        });
        scannerRef.current = null;
      }
    };
  }, [showCamera]);

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl max-w-sm mx-auto text-center space-y-4 font-sans select-none shadow-2xl relative overflow-hidden">
      {/* Fechar modal */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 transition-all z-20"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Background glow animation */}
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="w-14 h-14 mx-auto rounded-2xl bg-red-600/20 border border-red-500 flex items-center justify-center text-red-500 text-2xl animate-pulse shadow-inner">
        <Megaphone className="w-7 h-7 text-red-500" />
      </div>

      <div>
        <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center justify-center gap-1.5">
          <span>Encontrou um Corpo?</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Aponte a câmera para o QR Code nas costas do jogador abatido para reportar.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-red-950/80 border border-red-600/60 text-red-200 text-xs p-3 rounded-2xl flex items-center justify-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Leitor de Câmera Real */}
      {showCamera ? (
        <div className="space-y-3">
          <div
            id="body-qr-reader"
            className="w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex flex-col justify-center [&_video]:rounded-xl [&_video]:object-cover"
          />
          <button
            onClick={() => setShowCamera(false)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-2xl uppercase tracking-wider text-xs transition flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            <span>Cancelar Câmera</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            disabled={isProcessing}
            onClick={() => setShowCamera(true)}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl uppercase tracking-wider text-xs transition shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>{isProcessing ? "Processando Report..." : "📷 Escanear QR Code das Costas"}</span>
          </button>

          {/* Test Simulation Helper for Dev/Demo */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
              Modo de Simulação / Demo (Dev)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ID do jogador morto"
                value={manualPlayerId}
                onChange={(e) => setManualPlayerId(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs px-3 py-2 rounded-xl text-slate-200 w-full focus:outline-none focus:border-red-500 font-mono"
              />
              <button
                disabled={isProcessing || !manualPlayerId}
                onClick={() => handleScanDeadPlayerQR(manualPlayerId)}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs px-3 py-2 rounded-xl font-bold transition flex items-center gap-1 shrink-0"
              >
                {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Testar"}
              </button>
            </div>
            <button
              onClick={() => handleScanDeadPlayerQR("p4")}
              className="text-[10px] text-red-400 hover:underline font-mono"
            >
              Simular leitura das costas de 'Verde' (ID: p4)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
