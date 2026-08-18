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

  const handleScanDeadPlayerQR = async (scannedPlayerId: string) => {
    if (!scannedPlayerId || scannedPlayerId.trim() === "") {
      setErrorMsg("Código de jogador inválido.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const isValidUuid = (str?: string) =>
        typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      const cleanToken = scannedPlayerId.trim().toUpperCase();
      let deadPlayerName = `Jogador #${scannedPlayerId.substring(0, 4)}`;

      if (cleanToken.includes("REPORT_BODY") || cleanToken === "REPORT" || cleanToken === "BODY_REPORT") {
        deadPlayerName = "Corpo Encontrado (QR Físico)";
      } else if (isValidUuid(scannedPlayerId.trim())) {
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
        deadPlayerName = scannedPlayerId === "p4" ? "Verde" : scannedPlayerId;
      }

      if (isValidUuid(roomId)) {
        await supabase
          .from("rooms")
          .update({ status: "EMERGENCY_MEETING" })
          .eq("id", roomId);
      }

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

  useEffect(() => {
    if (!showCamera) return;

    const scanner = new Html5QrcodeScanner(
      "body-qr-reader",
      {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        handleScanDeadPlayerQR(decodedText);
      },
      () => {}
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error) => {
          console.error("Falha ao desmontar scanner de corpos:", error);
        });
        scannerRef.current = null;
      }
    };
  }, [showCamera]);

  return (
    <div className="console-card p-5 max-w-sm mx-auto text-center space-y-4 font-sans select-none shadow-2xl relative overflow-hidden">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-950 border border-slate-700 transition-all z-20 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Hazard Banner */}
      <div className="w-full h-3 hazard-stripes rounded-full mb-1" />

      <div className="w-14 h-14 mx-auto rounded-2xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-red-500 animate-pulse shadow-md">
        <Megaphone className="w-7 h-7 text-red-500" />
      </div>

      <div>
        <h3
          style={{ fontFamily: "var(--font-anton), Anton, sans-serif" }}
          className="text-lg font-black text-white uppercase tracking-wider"
        >
          ENCONTROU UM CORPO?
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Aponte a câmera para o QR Code nas costas do tripulante eliminado para reportar à nave inteira!
        </p>
      </div>

      {errorMsg && (
        <div className="bg-red-950/80 border border-red-500/60 text-red-200 text-xs p-3 rounded-2xl flex items-center justify-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {showCamera ? (
        <div className="space-y-3">
          <div
            id="body-qr-reader"
            className="w-full bg-[#020617] rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex flex-col justify-center [&_video]:rounded-xl [&_video]:object-cover"
          />
          <button
            type="button"
            onClick={() => setShowCamera(false)}
            className="w-full h-[46px] rounded-xl btn-3d-slate text-xs font-black uppercase flex items-center justify-center gap-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>CANCELAR CÂMERA</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setShowCamera(true)}
            className="w-full h-[54px] rounded-2xl btn-3d-red flex items-center justify-center gap-2 text-sm font-black uppercase cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            <span>{isProcessing ? "PROCESSANDO..." : "📷 ESCANEAR QR DAS COSTAS"}</span>
          </button>

          {/* Fallback Dev Simulação */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <p className="text-[10px] text-slate-500 font-mono uppercase">
              Simulação de Leitura (Dev / Demo)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="ID ou Cor"
                value={manualPlayerId}
                onChange={(e) => setManualPlayerId(e.target.value)}
                className="input-fenda text-xs px-3 py-2 rounded-xl text-slate-200 w-full font-mono outline-none"
              />
              <button
                type="button"
                disabled={isProcessing || !manualPlayerId}
                onClick={() => handleScanDeadPlayerQR(manualPlayerId)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Testar"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleScanDeadPlayerQR("p4")}
              className="text-[10px] text-red-400 hover:underline font-mono cursor-pointer"
            >
              Simular leitura de 'Verde' (ID: p4)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
