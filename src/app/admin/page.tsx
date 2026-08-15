'use client';

import React, { useState, useEffect } from 'react';
import { HostDashboard } from '@/components/host/HostDashboard';
import { GridMapBuilder } from '@/components/admin/GridMapBuilder';
import Link from 'next/link';
import { Printer, Layers, Crown, Shield } from 'lucide-react';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'lobby' | 'map'>('lobby');
  const [roomId, setRoomId] = useState<string>('demo-room-id');
  const [roomCode, setRoomCode] = useState<string>('A7X9');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramRoomId = params.get('roomId');
      const paramCode = params.get('code');
      if (paramRoomId) setRoomId(paramRoomId);
      if (paramCode) setRoomCode(paramCode);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 antialiased font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Superior do Admin */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-xs font-bold uppercase tracking-wider mb-2">
              <Crown className="w-3.5 h-3.5 text-cyan-400" />
              <span>PAINEL DO HOST • AMONG US RP</span>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
              <Shield className="w-6 h-6 text-cyan-400" />
              <span>Gestão Central da Sala #{roomCode}</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/print"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 transition-all flex items-center gap-2 shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Imprimir Kit QR</span>
            </Link>

            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setActiveTab('lobby')}
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  activeTab === 'lobby'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Lobby & Regras
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'map'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Grid Map Editor
              </button>
            </div>
          </div>
        </header>

        {/* Conteúdo Dinâmico por Aba */}
        {activeTab === 'lobby' ? (
          <HostDashboard roomId={roomId} roomCode={roomCode} />
        ) : (
          <GridMapBuilder roomId={roomId} />
        )}
      </div>
    </div>
  );
}
