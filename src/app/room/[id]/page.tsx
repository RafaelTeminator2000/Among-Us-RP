'use client';

import React, { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GameMapHUD } from '@/components/GameMapHUD';
import { ImpostorKillButton } from '@/components/game/ImpostorKillButton';
import { VotingSessionScreen } from '@/components/game/VotingSessionScreen';
import { EliminationScreen } from '@/components/minigames/EliminationScreen';
import { TaskQrReader } from '@/components/minigames/TaskQrReader';
import { WireMinigame } from '@/components/minigames/WireMinigame';
import { ScratchMapPlan, TaskNode } from '@/types/grid-editor';
import { PlayerGameState } from '@/types/game';
import { Users, Shield, Skull, AlertTriangle, CheckCircle2, Play, QrCode, Wrench, X, RefreshCw } from 'lucide-react';

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const { id: roomId } = use(params);

  const [roomStatus, setRoomStatus] = useState<'LOBBY' | 'PLAYING' | 'EMERGENCY_MEETING' | 'ENDED'>('LOBBY');
  const [playerRole, setPlayerRole] = useState<'CREWMATE' | 'IMPOSTOR'>('CREWMATE');
  const [playerStatus, setPlayerStatus] = useState<'ALIVE' | 'ELIMINATED'>('ALIVE');
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('Jogador');
  const [playerColor, setPlayerColor] = useState<string>('#ef4444');
  const [mapData, setMapData] = useState<ScratchMapPlan | null>(null);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [isSabotaged, setIsSabotaged] = useState<boolean>(false);
  const [allPlayers, setAllPlayers] = useState<PlayerGameState[]>([]);

  // Estado para modais de tarefas e minigames
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);
  const [activeMinigame, setActiveMinigame] = useState<'qr' | 'wires' | null>(null);
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);

  const supabase = createClient();

  // 1. Carregar dados iniciais da sala e do jogador na sessão atual
  useEffect(() => {
    const initSession = async () => {
      // Buscar dados da sala e o mapa gerado pelo Host
      const { data: room } = await supabase
        .from('rooms')
        .select('status, map_data')
        .eq('id', roomId)
        .single();

      if (room) {
        if (room.status) setRoomStatus(room.status as any);
        if (room.map_data) setMapData(room.map_data as unknown as ScratchMapPlan);
      }

      // Recuperar o ID do jogador salvo no localStorage durante o Guest Join
      const storedPlayerId =
        localStorage.getItem(`room_player_${roomId}`) ||
        localStorage.getItem('current_player_id');

      if (storedPlayerId) {
        setPlayerId(storedPlayerId);
        const { data: player } = await supabase
          .from('room_players')
          .select('id, player_name, color_hex, role, status, completed_tasks')
          .eq('id', storedPlayerId)
          .single();

        if (player) {
          if (player.player_name) setPlayerName(player.player_name);
          if (player.color_hex) setPlayerColor(player.color_hex);
          if (player.role) setPlayerRole(player.role as any);
          if (player.status) setPlayerStatus(player.status as any);
          if (Array.isArray(player.completed_tasks)) {
            setCompletedTasks(player.completed_tasks as string[]);
          }
        }
      }

      // Buscar lista completa de jogadores da sala para HUD / EliminationScreen
      const { data: playersData } = await supabase
        .from('room_players')
        .select('id, player_name, color_hex, role, status, completed_tasks')
        .eq('room_id', roomId);

      if (playersData) {
        const formattedPlayers: PlayerGameState[] = playersData.map((p) => ({
          id: p.id,
          nickname: p.player_name,
          color: p.color_hex || '#3b82f6',
          role: p.role as any,
          is_alive: p.status === 'ALIVE',
          is_host: false,
          completed_tasks: Array.isArray(p.completed_tasks) ? p.completed_tasks.length : 0,
          total_tasks: 4,
          has_voted: false,
          voted_for_id: null,
        }));
        setAllPlayers(formattedPlayers);
      }
    };

    initSession();

    // 2. Escutar mudanças de estado da sala em tempo real via Supabase Realtime
    const channel = supabase
      .channel(`room-sync:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status) setRoomStatus(updated.status);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.id === playerId) {
            if (updated.status) setPlayerStatus(updated.status);
            if (updated.role) setPlayerRole(updated.role);
          }

          // Atualizar lista geral de jogadores
          setAllPlayers((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? {
                    ...p,
                    is_alive: updated.status === 'ALIVE',
                    role: updated.role || p.role,
                  }
                : p
            )
          );
        }
      )
      .on('broadcast', { event: 'PLAYER_KILLED' }, (payload) => {
        if (payload.payload?.victimId === playerId) {
          setPlayerStatus('ELIMINATED');
        }
      })
      .on('broadcast', { event: 'EMERGENCY_MEETING' }, () => {
        setRoomStatus('EMERGENCY_MEETING');
      })
      .on('broadcast', { event: 'SABOTAGE_TRIGGERED' }, () => {
        setIsSabotaged(true);
      })
      .on('broadcast', { event: 'SABOTAGE_FIXED' }, () => {
        setIsSabotaged(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId, supabase]);

  // Concluir uma tarefa e persistir
  const handleCompleteTask = async (taskId: string) => {
    if (completedTasks.includes(taskId)) return;

    const newCompleted = [...completedTasks, taskId];
    setCompletedTasks(newCompleted);
    setSelectedTask(null);
    setActiveMinigame(null);
    setTaskFeedback('✅ Tarefa concluída com sucesso!');
    setTimeout(() => setTaskFeedback(null), 3000);

    if (playerId) {
      await supabase
        .from('room_players')
        .update({ completed_tasks: newCompleted as any })
        .eq('id', playerId);
    }
  };

  // Se o jogador estiver eliminado, exibe a tela de morte sem fantasmas
  if (playerStatus === 'ELIMINATED') {
    const meAsPlayer: PlayerGameState = {
      id: playerId || 'self',
      nickname: playerName,
      color: playerColor,
      role: playerRole,
      is_alive: false,
      is_host: false,
      completed_tasks: completedTasks.length,
      total_tasks: 4,
      has_voted: false,
      voted_for_id: null,
    };

    return (
      <div className="min-h-screen bg-slate-950 p-4 flex items-center justify-center">
        <EliminationScreen
          eliminatedPlayer={meAsPlayer}
          players={allPlayers.length > 0 ? allPlayers : [meAsPlayer]}
          onReturnToLobby={() => {
            setPlayerStatus('ALIVE');
          }}
        />
      </div>
    );
  }

  // Se a sala estiver em Reunião de Emergência / Votação
  if (roomStatus === 'EMERGENCY_MEETING') {
    return (
      <div className="min-h-screen bg-slate-950 p-4 flex items-center justify-center">
        <VotingSessionScreen
          roomId={roomId}
          currentPlayerId={playerId}
          reporterName="Alguém"
          onVotingEnded={() => setRoomStatus('PLAYING')}
        />
      </div>
    );
  }

  // Se a sala estiver no Lobby aguardando início
  if (roomStatus === 'LOBBY') {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col justify-between max-w-md mx-auto font-sans relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-10 left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <header className="flex justify-between items-center border-b border-slate-800 pb-3 z-10">
          <h1 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Among Us RP • #{roomId.substring(0, 4)}</span>
          </h1>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase animate-pulse">
            Lobby de Espera
          </span>
        </header>

        <main className="my-auto space-y-6 text-center z-10">
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              <Users className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-wider">
                Aguardando Host...
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                O Host está configurando o mapa tático da nave. A partida começará em breve.
              </p>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Seu Perfil RP:</span>
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-900"
                  style={{ backgroundColor: playerColor }}
                />
                <span className="font-bold text-slate-200">{playerName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Sincronizando em tempo real com Supabase</span>
          </div>
        </main>

        <footer className="z-10 text-center text-[10px] text-slate-600">
          Among Us RP Presencial • Código da Sala: <strong className="text-slate-400">{roomId}</strong>
        </footer>
      </div>
    );
  }

  // Estado de Jogo Ativo (PLAYING)
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col justify-between max-w-md mx-auto font-sans relative">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-3 z-10">
        <h1 className="text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>Among Us RP • #{roomId.substring(0, 4)}</span>
        </h1>
        <div
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            playerRole === 'IMPOSTOR'
              ? 'bg-red-600/20 text-red-400 border border-red-500/60'
              : 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/60'
          }`}
        >
          {playerRole === 'IMPOSTOR' ? '🔪 IMPOSTOR' : '🟢 TRIPULANTE'}
        </div>
      </header>

      {/* Feedback Toast */}
      {taskFeedback && (
        <div className="bg-emerald-600 text-white text-xs font-bold p-3 rounded-2xl shadow-xl text-center border border-emerald-400 animate-fade-in z-30">
          {taskFeedback}
        </div>
      )}

      {/* Exibição do Mapa Interativo Phygital */}
      <main className="my-auto space-y-4 z-10 py-4">
        {mapData ? (
          <GameMapHUD
            mapData={mapData}
            completedTasks={completedTasks}
            onSelectTaskNode={(node: TaskNode) => {
              setSelectedTask(node);
            }}
            isSabotaged={isSabotaged}
          />
        ) : (
          <div className="text-center text-xs text-slate-500 py-12 bg-slate-900/50 rounded-3xl border border-slate-800">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
            Carregando mapa tático da sala...
          </div>
        )}
      </main>

      {/* Modal de Seleção / Execução de Tarefa */}
      {selectedTask && !activeMinigame && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative">
            <button
              onClick={() => setSelectedTask(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center mx-auto">
              <Wrench className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-100 uppercase">
                {selectedTask.room_name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tipo: <span className="text-cyan-400 font-mono font-bold">{selectedTask.type}</span>
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => setActiveMinigame('qr')}
                className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all"
              >
                <QrCode className="w-4 h-4" />
                <span>Escanear QR Code Físico</span>
              </button>

              <button
                onClick={() => setActiveMinigame('wires')}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl text-xs uppercase tracking-wider border border-slate-700 transition-all"
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                <span>Minigame de Fiação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minigame QR Code Reader */}
      {activeMinigame === 'qr' && (
        <div className="fixed inset-0 bg-slate-950 z-50 p-4 flex items-center justify-center">
          <div className="w-full max-w-md">
            <TaskQrReader
              expectedTaskTitle={selectedTask?.room_name}
              onScanSuccess={(code) => {
                handleCompleteTask(selectedTask?.id || code);
              }}
              onCancel={() => {
                setActiveMinigame(null);
                setSelectedTask(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Minigame de Fiação */}
      {activeMinigame === 'wires' && (
        <div className="fixed inset-0 bg-slate-950 z-50 p-4 flex items-center justify-center">
          <div className="w-full max-w-md">
            <WireMinigame
              onComplete={() => {
                handleCompleteTask(selectedTask?.id || 'wire-task');
              }}
              onCancel={() => {
                setActiveMinigame(null);
                setSelectedTask(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Botão de Abate flutuante exclusivo para o Impostor */}
      {playerRole === 'IMPOSTOR' && roomStatus === 'PLAYING' && (
        <div className="fixed bottom-6 right-6 z-30">
          <ImpostorKillButton roomId={roomId} impostorId={playerId} />
        </div>
      )}
    </div>
  );
}
