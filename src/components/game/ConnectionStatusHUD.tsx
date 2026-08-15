'use client';

import React from 'react';
import { RealtimeConnectionState } from '@/lib/realtime-game';
import { Activity, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface ConnectionStatusHUDProps {
  roomId: string;
  connectionState: RealtimeConnectionState;
  latency?: number | null;
  className?: string;
}

export const ConnectionStatusHUD: React.FC<ConnectionStatusHUDProps> = ({
  roomId,
  connectionState,
  latency = 14,
  className = '',
}) => {
  const getStatusBadge = () => {
    switch (connectionState) {
      case 'CONNECTED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            CONNECTED
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            CONNECTING...
          </span>
        );
      case 'ERROR':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            ERROR
          </span>
        );
      case 'DISCONNECTED':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            <WifiOff className="w-3 h-3" />
            OFFLINE
          </span>
        );
    }
  };

  return (
    <div
      className={`w-full bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-2xl px-4 py-2 flex items-center justify-between shadow-lg text-xs ${className}`}
    >
      <div className="flex items-center gap-2">
        {getStatusBadge()}
        <span className="text-slate-400 font-mono text-[11px]">
          Sala: <strong className="text-slate-200 uppercase">{roomId.substring(0, 6)}</strong>
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
        <Activity className={`w-3.5 h-3.5 ${connectionState === 'CONNECTED' ? 'text-emerald-400' : 'text-slate-500'}`} />
        <span>Latency:</span>
        <span
          className={`font-bold ${
            latency && latency < 50
              ? 'text-emerald-400'
              : latency && latency < 100
              ? 'text-amber-400'
              : 'text-red-400'
          }`}
        >
          ~{latency ?? '--'}ms
        </span>
      </div>
    </div>
  );
};
