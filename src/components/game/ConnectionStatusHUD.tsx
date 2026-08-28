'use client';

import React from 'react';
import { RealtimeConnectionState } from '@/lib/realtime-game';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';

interface ConnectionStatusHUDProps {
  roomId?: string;
  connectionState: RealtimeConnectionState;
  latency?: number | null;
  className?: string;
}

/**
 * ConnectionStatusHUD: Banner discreto que só aparece quando a conexão
 * com a nave (Supabase Realtime) estiver oscilando ou offline.
 * Quando 'CONNECTED', não renderiza nada para manter a interface 100% limpa e com zero poluição.
 */
export const ConnectionStatusHUD: React.FC<ConnectionStatusHUDProps> = ({
  connectionState,
  className = '',
}) => {
  if (connectionState === 'CONNECTED') {
    return null;
  }

  if (connectionState === 'CONNECTING' || connectionState === 'RECONNECTING') {
    return (
      <div
        className={`w-full bg-amber-950/80 backdrop-blur-md border border-amber-500/40 rounded-xl px-3 py-1.5 flex items-center justify-center gap-2 shadow-lg text-[11px] font-mono text-amber-300 animate-pulse ${className}`}
      >
        <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
        <span>Sincronizando com os sistemas da nave...</span>
      </div>
    );
  }

  return (
    <div
      className={`w-full bg-red-950/90 backdrop-blur-md border border-red-500/50 rounded-xl px-3 py-1.5 flex items-center justify-between shadow-xl text-[11px] font-mono text-red-300 ${className}`}
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />
        <span>Conexão perdida. Tentando reconectar...</span>
      </div>
      <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-red-400 bg-red-900/40 px-2 py-0.5 rounded border border-red-500/30">
        <AlertTriangle className="w-2.5 h-2.5" />
        Offline
      </span>
    </div>
  );
};
