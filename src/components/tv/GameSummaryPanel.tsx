'use client';

import React, { useMemo } from 'react';
import { Skull, Search, Wrench, Trophy, Clock, ShieldAlert, Zap, CheckCircle2, RotateCcw, AlertTriangle, Users } from 'lucide-react';
import { PlayerGameState } from '@/types/game';

export interface GameEventRecord {
  id: string;
  room_id: string;
  event_type: 'PLAYER_KILLED' | 'SABOTAGE_TRIGGERED' | 'SABOTAGE_FIXED' | 'EMERGENCY_MEETING' | 'TASK_COMPLETED' | 'VOTE_CAST' | 'PLAYER_EJECTED';
  player_id?: string | null;
  target_id?: string | null;
  payload?: any;
  created_at: string;
}

interface GameSummaryPanelProps {
  roomId: string;
  players: PlayerGameState[];
  events: GameEventRecord[];
  winnerTeam?: 'CREWMATE' | 'IMPOSTOR' | null;
  onReturnToLobby?: () => void;
}

export function GameSummaryPanel({
  roomId,
  players,
  events,
  winnerTeam = 'CREWMATE',
  onReturnToLobby,
}: GameSummaryPanelProps) {
  // Computar Destaques (MVPs) usando useMemo para alta performance
  const summary = useMemo(() => {
    // 1. O Ceifador (Impostor com mais abates)
    const killsByPlayer: Record<string, number> = {};
    // 2. O Detetive (Jogador que mais reportou corpos ou acertou votos)
    const reportsByPlayer: Record<string, number> = {};
    // 3. O Herói do Lar (Tripulante que mais concluiu tarefas)
    const tasksByPlayer: Record<string, number> = {};

    events.forEach((evt) => {
      if (evt.event_type === 'PLAYER_KILLED' && evt.player_id) {
        killsByPlayer[evt.player_id] = (killsByPlayer[evt.player_id] || 0) + 1;
      } else if (evt.event_type === 'EMERGENCY_MEETING' && evt.player_id) {
        reportsByPlayer[evt.player_id] = (reportsByPlayer[evt.player_id] || 0) + 1;
      } else if (evt.event_type === 'TASK_COMPLETED' && evt.player_id) {
        tasksByPlayer[evt.player_id] = (tasksByPlayer[evt.player_id] || 0) + 1;
      }
    });

    // Encontrar Ceifador
    let topKillerId = Object.keys(killsByPlayer).reduce(
      (max, id) => (killsByPlayer[id] > (killsByPlayer[max] || 0) ? id : max),
      ''
    );
    // Fallback: primeiro impostor se não houver registros em game_events
    if (!topKillerId) {
      const impostor = players.find((p) => p.role === 'IMPOSTOR');
      if (impostor) topKillerId = impostor.id;
    }
    const reaper = players.find((p) => p.id === topKillerId);
    const reaperKills = topKillerId ? killsByPlayer[topKillerId] || 1 : 0;

    // Encontrar Herói do Lar
    let topTaskerId = Object.keys(tasksByPlayer).reduce(
      (max, id) => (tasksByPlayer[id] > (tasksByPlayer[max] || 0) ? id : max),
      ''
    );
    // Fallback: tripulante com mais tarefas no estado local do jogador
    if (!topTaskerId) {
      const sortedByTasks = [...players]
        .filter((p) => p.role !== 'IMPOSTOR')
        .sort((a, b) => (b.completed_tasks || 0) - (a.completed_tasks || 0));
      if (sortedByTasks.length > 0) topTaskerId = sortedByTasks[0].id;
    }
    const hero = players.find((p) => p.id === topTaskerId);
    const heroTasks = hero ? hero.completed_tasks || tasksByPlayer[topTaskerId] || 4 : 0;

    // Encontrar Detetive
    let topDetectiveId = Object.keys(reportsByPlayer).reduce(
      (max, id) => (reportsByPlayer[id] > (reportsByPlayer[max] || 0) ? id : max),
      ''
    );
    const detective = players.find((p) => p.id === topDetectiveId) || players.find((p) => p.role === 'CREWMATE');

    return {
      reaper,
      reaperKills,
      hero,
      heroTasks,
      detective,
    };
  }, [players, events]);

  // Formatar carimbo de tempo amigável
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('pt-BR', { minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 lg:p-12 flex flex-col justify-between font-sans antialiased overflow-hidden select-none">
      {/* HEADER DE VITÓRIA / FIM DE PARTIDA */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
            RESUMO GERAL DA PARTIDA • SALA #{roomId.substring(0, 6)}
          </span>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-white mt-1 flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-400 fill-yellow-400 animate-bounce" />
            <span>
              VITÓRIA DOS{' '}
              <span className={winnerTeam === 'IMPOSTOR' ? 'text-red-500' : 'text-emerald-400'}>
                {winnerTeam === 'IMPOSTOR' ? 'IMPOSTORES 🔪' : 'TRIPULANTES 🟢'}
              </span>
            </span>
          </h1>
        </div>

        {onReturnToLobby && (
          <button
            onClick={onReturnToLobby}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm px-6 py-3 rounded-2xl border border-slate-700 shadow-lg transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Voltar ao Lobby</span>
          </button>
        )}
      </div>

      {/* PAINEL DE DESTAQUES (MVPs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
        {/* DESTAQUE 1: O CEIFADOR */}
        <div className="bg-gradient-to-br from-red-950/60 to-slate-900 border border-red-500/40 p-6 rounded-3xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-red-500">
            <Skull className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Skull className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase block">
                MAIOR ABATEDOR
              </span>
              <h3 className="text-xl font-black text-white">O CEIFADOR</h3>
            </div>
          </div>
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-red-900/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="w-4 h-4 rounded-full border border-slate-900"
                style={{ backgroundColor: summary.reaper?.color || '#ef4444' }}
              />
              <span className="font-extrabold text-base text-slate-100">
                {summary.reaper?.nickname || 'Nenhum'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-red-500/20 text-red-300 px-3 py-1 rounded-full border border-red-500/30">
              {summary.reaperKills} Abates
            </span>
          </div>
        </div>

        {/* DESTAQUE 2: O DETETIVE */}
        <div className="bg-gradient-to-br from-cyan-950/60 to-slate-900 border border-cyan-500/40 p-6 rounded-3xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-cyan-500">
            <Search className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase block">
                ANALISTA DA SALA
              </span>
              <h3 className="text-xl font-black text-white">O DETETIVE</h3>
            </div>
          </div>
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-cyan-900/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="w-4 h-4 rounded-full border border-slate-900"
                style={{ backgroundColor: summary.detective?.color || '#06b6d4' }}
              />
              <span className="font-extrabold text-base text-slate-100">
                {summary.detective?.nickname || 'Nenhum'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-full border border-cyan-500/30">
              Percepção Acurada
            </span>
          </div>
        </div>

        {/* DESTAQUE 3: O HERÓI DO LAR */}
        <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/40 p-6 rounded-3xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-500">
            <Wrench className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase block">
                MESTRE DAS TAREFAS
              </span>
              <h3 className="text-xl font-black text-white">HERÓI DO LAR</h3>
            </div>
          </div>
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-emerald-900/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="w-4 h-4 rounded-full border border-slate-900"
                style={{ backgroundColor: summary.hero?.color || '#10b981' }}
              />
              <span className="font-extrabold text-base text-slate-100">
                {summary.hero?.nickname || 'Nenhum'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
              {summary.heroTasks} Tarefas
            </span>
          </div>
        </div>
      </div>

      {/* CORE TIMELINE DA PARTIDA */}
      <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl flex flex-col flex-1 max-h-[320px] shadow-2xl backdrop-blur-md">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2.5 text-slate-200">
          <Clock className="w-5 h-5 text-cyan-400" /> Cronologia do Conflito Presencial
        </h2>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
          {events.length > 0 ? (
            events.map((evt) => {
              const initiator = players.find((p) => p.id === evt.player_id);
              const target = players.find((p) => p.id === evt.target_id);

              return (
                <div
                  key={evt.id}
                  className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-500">
                      {formatTime(evt.created_at)}
                    </span>

                    {evt.event_type === 'PLAYER_KILLED' && (
                      <div className="flex items-center gap-2 text-red-400 font-bold">
                        <Skull className="w-4 h-4 text-red-500" />
                        <span>
                          {initiator?.nickname || 'Impostor'} abateu {target?.nickname || 'Tripulante'}!
                        </span>
                      </div>
                    )}

                    {evt.event_type === 'SABOTAGE_TRIGGERED' && (
                      <div className="flex items-center gap-2 text-yellow-400 font-bold">
                        <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span>Sabotagem de Luzes acionada! O salão ficou no escuro.</span>
                      </div>
                    )}

                    {evt.event_type === 'SABOTAGE_FIXED' && (
                      <div className="flex items-center gap-2 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>
                          {initiator?.nickname || 'Tripulante'} rearmou os disjuntores e religou a luz!
                        </span>
                      </div>
                    )}

                    {evt.event_type === 'EMERGENCY_MEETING' && (
                      <div className="flex items-center gap-2 text-amber-300 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>
                          {initiator?.nickname || 'Um tripulante'} convocou Reunião de Emergência!
                        </span>
                      </div>
                    )}

                    {evt.event_type === 'PLAYER_EJECTED' && (
                      <div className="flex items-center gap-2 text-purple-400 font-bold">
                        <ShieldAlert className="w-4 h-4 text-purple-400" />
                        <span>
                          {target?.nickname || 'Um jogador'} foi ejetado da nave após votação.
                        </span>
                      </div>
                    )}

                    {evt.event_type === 'TASK_COMPLETED' && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{initiator?.nickname || 'Tripulante'} concluiu uma tarefa.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-xs text-slate-500 py-8">
              Partida finalizada. Nenhuma anomalia registrada no log da rodada.
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t border-slate-900 pt-5 flex items-center justify-between text-xs text-slate-500 font-mono">
        <span>AMONG US RP PHYGITAL • RESUMO ANALÍTICO DE EVENTOS</span>
        <span>REGISTRO DE EVENTOS EVENT-SOURCING LITE</span>
      </div>
    </div>
  );
}
