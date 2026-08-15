'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRoomAction, joinRoomAction } from '@/app/room/actions';
import { Shield, Crown, Radio, QrCode, Play, Users, Sparkles, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import { generateUUID } from '@/lib/utils';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [guestName, setGuestName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formatar código de 4 caracteres automaticamente em maiúsculo
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setRoomCode(val);
    if (errorMessage) setErrorMessage(null);
  };

  // Tratar submissão do formulário de entrada do Convidado
  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!guestName.trim() || guestName.trim().length < 2) {
      setErrorMessage('Digite seu nome (mínimo 2 caracteres).');
      return;
    }

    if (roomCode.length !== 4) {
      setErrorMessage('Digite o código de 4 dígitos da sala (ex: A7X9).');
      return;
    }

    const formData = new FormData();
    formData.append('playerName', guestName.trim());
    formData.append('code', roomCode);

    startTransition(async () => {
      // Salvar nome e dados de perfil localmente para conveniência
      if (typeof window !== 'undefined') {
        const guestId = generateUUID();
        localStorage.setItem('current_player_id', guestId);
        localStorage.setItem('current_player_name', guestName.trim());
        localStorage.setItem(`player_name_${roomCode}`, guestName.trim());
        localStorage.setItem(`room_player_${roomCode}`, guestId);
      }

      const res = await joinRoomAction(null, formData);
      if (res?.error) {
        setErrorMessage(res.error);
      }
    });
  };

  // Tratar criação de sala pelo Host
  const handleHostCreate = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await createRoomAction();
      if (res?.error) {
        setErrorMessage(res.error);
      }
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Glow Effects de Fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER DA PLATAFORMA */}
      <header className="w-full max-w-md text-center space-y-2.5 z-10 pt-4 pb-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg">
          <Radio className="w-4 h-4 animate-pulse text-cyan-400" />
          <span>Among Us RP • Plataforma Phygital</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-red-500 via-slate-100 to-cyan-400 bg-clip-text text-transparent drop-shadow-sm">
          AMONG US RP
        </h1>
        <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
          Automação de Lobbies, Sabotagens síncronas em tempo real e Modo Telão para partidas presenciais.
        </p>
      </header>

      {/* CORE CONTAINER: ENTRADA DE CONVIDADO + CRIAR SALA */}
      <div className="w-full max-w-md my-auto z-10 space-y-5 py-4">
        {/* CARD 1: PAINEL DO CONVIDADO (ENTRAR NA SALA) */}
        <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Entrar em uma Sala
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Digite seu nome e o código de 4 letras do evento
              </p>
            </div>
          </div>

          {/* MENSAGEM DE ERRO */}
          {errorMessage && (
            <div className="bg-red-950/80 border border-red-500/60 text-red-200 text-xs p-3 rounded-2xl flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleGuestSubmit} className="space-y-4">
            {/* Campo Nome */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold uppercase text-slate-300 block">
                Seu Nome / Apelido RP
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ex: Tripulante Alfa"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
            </div>

            {/* Campo Código da Sala (4 Caracteres) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold uppercase text-slate-300 block">
                Código da Sala (4 Dígitos)
              </label>
              <input
                type="text"
                required
                maxLength={4}
                value={roomCode}
                onChange={handleCodeChange}
                placeholder="Ex: A7X9"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 rounded-2xl px-4 py-3 text-center font-mono text-xl font-black tracking-widest text-cyan-400 uppercase placeholder-slate-700 outline-none transition-all"
              />
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider py-3.5 px-6 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.3)] transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPending ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Entrar no Jogo</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* CARD 2: PAINEL DO HOST (CRIAR SALA DINÂMICA) */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-3xl backdrop-blur-md space-y-3 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-amber-400 font-bold uppercase tracking-wider">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Área do Organizador / Host</span>
          </div>

          <button
            onClick={handleHostCreate}
            disabled={isPending}
            className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider py-3.5 px-6 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all active:scale-98 flex items-center justify-center gap-2 border border-amber-400/30 disabled:opacity-50"
          >
            {isPending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Crown className="w-5 h-5" />
                <span>Criar Novo Lobby (Host)</span>
              </>
            )}
          </button>

          <div className="flex justify-center gap-4 text-xs font-mono pt-1 text-slate-400">
            <Link href="/admin" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>Host Studio</span>
            </Link>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="w-full max-w-md z-10 pt-2 pb-2 text-center text-[10px] text-slate-600 font-mono">
        Among Us RP Phygital • Supabase Realtime WS Sub-50ms
      </footer>
    </main>
  );
}
