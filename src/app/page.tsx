'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRoomAction, joinRoomAction } from '@/app/room/actions';
import {
  LogIn,
  PlusCircle,
  BookOpen,
  Settings,
  Volume2,
  VolumeX,
  X,
  Shield,
  Zap,
  Radio,
  Users,
  Check,
  AlertCircle,
  RefreshCw,
  Sparkles,
  MapPin,
  Flame,
} from 'lucide-react';
import { generateUUID } from '@/lib/utils';
import Link from 'next/link';

export const AVATAR_COLORS = [
  { name: 'Vermelho', hex: '#ef4444' },
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Verde', hex: '#10b981' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Laranja', hex: '#f97316' },
  { name: 'Amarelo', hex: '#eab308' },
  { name: 'Roxo', hex: '#a855f7' },
  { name: 'Branco', hex: '#f8fafc' },
];

export default function Home() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Modais
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Form State do Convidado
  const [guestName, setGuestName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].hex);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Áudio Mute Toggle
  const [isMuted, setIsMuted] = useState(false);

  // Formatar código de 4 caracteres automaticamente em maiúsculo
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    setRoomCode(val);
    if (errorMessage) setErrorMessage(null);
  };

  // Submissão do Convidado (Guest Join)
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
      if (typeof window !== 'undefined') {
        const guestId = generateUUID();
        localStorage.setItem('current_player_id', guestId);
        localStorage.setItem('current_player_name', guestName.trim());
        localStorage.setItem('current_player_color', selectedColor);
        localStorage.setItem(`player_name_${roomCode}`, guestName.trim());
        localStorage.setItem(`player_color_${roomCode}`, selectedColor);
        localStorage.setItem(`room_player_${roomCode}`, guestId);
      }

      const res = await joinRoomAction(null, formData);
      if (res?.error) {
        setErrorMessage(res.error);
      }
    });
  };

  // Criar sala como Host
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
    <main className="min-h-screen bg-deep-space-stars text-slate-100 flex flex-col items-center justify-between p-4 relative overflow-hidden select-none font-sans">
      {/* Luzes cósmicas de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* TRIPULANTES FLUTUANDO (BACKGROUND ART) */}
      <div className="absolute top-16 left-6 opacity-30 animate-floating pointer-events-none">
        <div className="w-12 h-14 bg-red-500 rounded-t-full rounded-b-2xl relative shadow-lg">
          <div className="absolute top-3 right-1 w-7 h-4 bg-cyan-200 rounded-full border-2 border-slate-900" />
        </div>
      </div>
      <div className="absolute top-36 right-8 opacity-25 animate-floating [animation-delay:2s] pointer-events-none">
        <div className="w-10 h-12 bg-cyan-500 rounded-t-full rounded-b-2xl relative shadow-lg rotate-12">
          <div className="absolute top-2.5 left-1 w-6 h-3.5 bg-cyan-100 rounded-full border-2 border-slate-900" />
        </div>
      </div>
      <div className="absolute bottom-28 left-10 opacity-20 animate-floating [animation-delay:4s] pointer-events-none">
        <div className="w-11 h-13 bg-amber-400 rounded-t-full rounded-b-2xl relative shadow-lg -rotate-45">
          <div className="absolute top-2.5 right-1 w-6 h-3.5 bg-cyan-200 rounded-full border-2 border-slate-900" />
        </div>
      </div>

      {/* TOPO (30% DA TELA): LOGO & HEADER */}
      <header className="w-full max-w-sm text-center space-y-3 z-10 pt-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-cyan-400 text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg">
          <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
          <span className="font-mono">SISTEMA PRESENCIAL</span>
        </div>

        {/* Logo Estilizado AMONG US RP */}
        <div className="relative py-2">
          <h1
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-5xl sm:text-6xl tracking-wider uppercase text-white drop-shadow-[0_6px_0_#0f172a] stroke-black"
          >
            AMONG US
          </h1>
          <div
            style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
            className="text-2xl sm:text-3xl tracking-widest uppercase text-cyan-400 drop-shadow-[0_3px_0_#0891b2] -mt-2"
          >
            ROLEPLAY
          </div>
        </div>

        <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">
          Automação de Lobbies, Sabotagens síncronas e Reuniões para partidas ao vivo.
        </p>
      </header>

      {/* CENTRO (50% DA TELA): 3 BOTÕES GIGANTES NA THUMB ZONE */}
      <div className="w-full max-w-sm my-auto z-10 space-y-4 py-2">
        {/* BOTÃO 1: ENTRAR EM UMA SALA */}
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setShowJoinModal(true);
          }}
          className="w-full h-[58px] rounded-2xl btn-3d-cyan flex items-center justify-center gap-3 text-lg font-black shadow-lg shadow-cyan-950/60 cursor-pointer"
        >
          <LogIn className="w-6 h-6 stroke-[2.5]" />
          <span>ENTRAR EM UMA SALA</span>
        </button>

        {/* BOTÃO 2: CRIAR SALA (HOST) */}
        <button
          type="button"
          disabled={isPending}
          onClick={handleHostCreate}
          className="w-full h-[58px] rounded-2xl btn-3d-slate flex items-center justify-center gap-3 text-lg font-black text-white shadow-lg cursor-pointer disabled:opacity-50"
        >
          {isPending ? (
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
          ) : (
            <>
              <PlusCircle className="w-6 h-6 text-cyan-400 stroke-[2.5]" />
              <span>CRIAR SALA (HOST)</span>
            </>
          )}
        </button>

        {/* BOTÃO 3: REGRAS DO JOGO */}
        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="w-full h-[58px] rounded-2xl btn-3d-amber flex items-center justify-center gap-3 text-lg font-black shadow-lg cursor-pointer"
        >
          <BookOpen className="w-6 h-6 text-yellow-400 stroke-[2.5]" />
          <span>REGRAS DO JOGO</span>
        </button>

        {/* Atalho Host Studio */}
        <div className="pt-2 flex justify-center">
          <Link
            href="/admin"
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5 font-mono px-3 py-1 rounded-lg bg-slate-900/60 border border-slate-800"
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>Host Studio & Telão TV</span>
          </Link>
        </div>
      </div>

      {/* BASE (20% DA TELA): VERSÃO & CONTROLES */}
      <footer className="w-full max-w-sm z-10 flex items-center justify-between py-3 px-2 text-slate-500 font-mono text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>v2026.6.5</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all active:scale-95 cursor-pointer shadow-md"
            title={isMuted ? 'Ativar Som' : 'Desativar Som'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all active:scale-95 cursor-pointer shadow-md"
            title="Configurações do Sistema"
          >
            <Settings className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL 1: ENTRADA DO CONVIDADO (TELA 2 INTEGRADA)                          */}
      {/* ========================================================================= */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm console-card p-5 relative overflow-hidden flex flex-col justify-between max-h-[92vh]">
            {/* Header com Botão Fechar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Users className="w-4 h-4" />
                </div>
                <h2
                  style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                  className="text-lg uppercase tracking-wider text-white"
                >
                  IDENTIFICAÇÃO DO TRIPULANTE
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-700 hover:border-red-500 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensagem de Erro */}
            {errorMessage && (
              <div className="mb-3 bg-red-950/80 border border-red-500/60 text-red-200 text-xs p-3 rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Formulário */}
            <form onSubmit={handleGuestSubmit} className="space-y-4 overflow-y-auto pr-1">
              {/* Campo Código da Sala */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-300 block">
                  Código da Sala (4 Dígitos)
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={roomCode}
                  onChange={handleCodeChange}
                  placeholder="EX: A7X9"
                  style={{ fontFamily: 'var(--font-mono), Space Mono, monospace' }}
                  className="w-full input-fenda rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-widest text-cyan-400 uppercase placeholder-slate-700 outline-none"
                />
              </div>

              {/* Campo Nome */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-300 block">
                  Seu Nome / Apelido RP
                </label>
                <input
                  type="text"
                  required
                  maxLength={20}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ex: RedSus"
                  className="w-full input-fenda rounded-2xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none"
                />
              </div>

              {/* Paleta Seletora de Cores (Grid 4x2) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono font-bold uppercase text-slate-300 flex items-center justify-between">
                  <span>Cor do Traje</span>
                  <span className="text-cyan-400">
                    {AVATAR_COLORS.find((c) => c.hex === selectedColor)?.name}
                  </span>
                </label>

                <div className="grid grid-cols-4 gap-2.5 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                  {AVATAR_COLORS.map((color) => {
                    const isSelected = selectedColor === color.hex;
                    return (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => setSelectedColor(color.hex)}
                        style={{ backgroundColor: color.hex }}
                        className={`h-10 rounded-xl transition-all relative flex items-center justify-center shadow-md cursor-pointer ${
                          isSelected
                            ? 'ring-3 ring-white scale-105 border-2 border-slate-950'
                            : 'opacity-75 hover:opacity-100 hover:scale-98'
                        }`}
                        title={color.name}
                      >
                        {isSelected && <Check className="w-5 h-5 text-slate-950 stroke-[3.5] drop-shadow" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rodapé Fixo: Botão Verde 3D */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending || roomCode.length !== 4 || !guestName.trim()}
                  className="w-full h-[54px] rounded-2xl btn-3d-green flex items-center justify-center gap-2 text-base font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>🚀 ENTRAR NO LOBBY</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGRAS DO JOGO (PHYGITAL AMONG US)                              */}
      {/* ========================================================================= */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm console-card p-5 relative overflow-hidden flex flex-col justify-between max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-yellow-400">
                <BookOpen className="w-5 h-5" />
                <h2
                  style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                  className="text-lg uppercase tracking-wider text-white"
                >
                  REGRAS DO JOGO RP
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 my-3 overflow-y-auto pr-1 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>TRIPULANTES</span>
                </div>
                <p>
                  Caminhe pelos cômodos físicos do local, encontre as placas com QR Code e complete suas tarefas pelo celular. Se encontrar um jogador eliminado, aperte <strong>REPORTAR</strong>!
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="font-bold text-red-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>IMPOSTORES</span>
                </div>
                <p>
                  Finja fazer tarefas. Quando estiver sozinho com um tripulante, aperte <strong>ABATER</strong> e informe discretamente a eliminação. Use <strong>SABOTAR</strong> para apagar as luzes!
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  <span>REUNIÃO & VOTAÇÃO</span>
                </div>
                <p>
                  Quando a sirene tocar, todos devem se reunir imediatamente no ponto central. Debatam cara a cara e votem pelo tablet do celular em quem é o suspeito!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="w-full h-[48px] rounded-xl btn-3d-amber text-sm font-black uppercase cursor-pointer"
            >
              ENTENDI AS REGRAS
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONFIGURAÇÕES & ÁUDIO                                           */}
      {/* ========================================================================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm console-card p-5 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" />
                <h2
                  style={{ fontFamily: 'var(--font-anton), Anton, sans-serif' }}
                  className="text-lg uppercase tracking-wider text-white"
                >
                  DEFINIÇÕES DO SISTEMA
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="font-semibold text-slate-200">Efeitos Sonoros (Sirene/Bipes)</span>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                    !isMuted ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {!isMuted ? 'ATIVADO' : 'MUTADO'}
                </button>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-slate-400">
                <div className="font-bold text-slate-200">Plataforma Phygital WebSocket</div>
                <p>Latência estimada: &lt; 50ms (Supabase Realtime Broadcast Channels)</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="w-full h-[48px] rounded-xl btn-3d-slate text-sm font-black uppercase cursor-pointer"
            >
              SALVAR & FECHAR
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
