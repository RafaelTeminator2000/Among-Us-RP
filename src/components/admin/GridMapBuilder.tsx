'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MapData, MapRoom, MapTask } from '@/types/map-editor';
import {
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Square,
  Move,
  Maximize2,
  Sparkles,
  RefreshCw,
  Layers,
  MapPin,
} from 'lucide-react';

interface GridMapBuilderProps {
  roomId: string;
  initialMapData?: MapData | null;
  onSaveSuccess?: (mapData: MapData) => void;
}

const PRESET_COLORS = [
  '#1868db', // Azul Institucional
  '#10b981', // Verde Sacristia
  '#f59e0b', // Amarelo Altar
  '#ef4444', // Vermelho Corredor
  '#8b5cf6', // Roxo Nave
  '#ec4899', // Rosa Entrada
  '#06b6d4', // Ciano Recepção
  '#64748b', // Esdras / Cinza
];

const DEFAULT_ROOMS: MapRoom[] = [
  { id: 'room_nave', name: 'Nave Principal', x: 10, y: 15, width: 45, height: 40, color: '#1868db' },
  { id: 'room_altar', name: 'Altar Principal', x: 60, y: 15, width: 30, height: 25, color: '#f59e0b' },
  { id: 'room_sacristia', name: 'Sacristia', x: 60, y: 45, width: 30, height: 35, color: '#10b981' },
];

const DEFAULT_TASKS: MapTask[] = [
  { id: 'task_1', roomId: 'room_nave', pointToken: 'POINT_01', x: 25, y: 30 },
  { id: 'task_2', roomId: 'room_altar', pointToken: 'POINT_02', x: 75, y: 25 },
  { id: 'task_3', roomId: 'room_sacristia', pointToken: 'POINT_03', x: 75, y: 60 },
];

type DragTarget =
  | { type: 'MOVE_ROOM'; id: string; startMouseX: number; startMouseY: number; startX: number; startY: number }
  | { type: 'RESIZE_ROOM'; id: string; startMouseX: number; startMouseY: number; startW: number; startH: number }
  | { type: 'MOVE_TASK'; id: string; startMouseX: number; startMouseY: number; startX: number; startY: number }
  | null;

export const GridMapBuilder: React.FC<GridMapBuilderProps> = ({
  roomId,
  initialMapData,
  onSaveSuccess,
}) => {
  const [rooms, setRooms] = useState<MapRoom[]>(() => initialMapData?.rooms || DEFAULT_ROOMS);
  const [tasks, setTasks] = useState<MapTask[]>(() => initialMapData?.tasks || DEFAULT_TASKS);

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [dragState, setDragState] = useState<DragTarget>(null);
  const canvasRef = useRef<SVGSVGElement | HTMLDivElement | null>(null);
  const supabase = createClient();

  // Atualizar lista inicial se vier assincronamente ou carregar do Supabase/localStorage
  useEffect(() => {
    if (initialMapData) {
      if (Array.isArray(initialMapData.rooms) && initialMapData.rooms.length > 0) {
        setRooms(initialMapData.rooms);
      }
      if (Array.isArray(initialMapData.tasks)) {
        setTasks(initialMapData.tasks);
      }
      return;
    }

    if (!roomId) return;

    const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);

    if (!isValidUuid) {
      try {
        const localSaved = localStorage.getItem(`demo_map_data_${roomId}`);
        if (localSaved) {
          const parsed: MapData = JSON.parse(localSaved);
          if (Array.isArray(parsed.rooms) && parsed.rooms.length > 0) setRooms(parsed.rooms);
          if (Array.isArray(parsed.tasks)) setTasks(parsed.tasks);
        }
      } catch (err) {
        console.warn('[GridMapBuilder] Erro ao carregar dados locais de demonstração:', err);
      }
      return;
    }

    // Se for um UUID válido, buscar do Supabase
    const fetchRemoteMap = async () => {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('map_data')
          .eq('id', roomId)
          .maybeSingle();

        if (!error && data?.map_data) {
          const remoteData = data.map_data as unknown as MapData;
          if (Array.isArray(remoteData.rooms) && remoteData.rooms.length > 0) setRooms(remoteData.rooms);
          if (Array.isArray(remoteData.tasks)) setTasks(remoteData.tasks);
        }
      } catch (err) {
        console.warn('[GridMapBuilder] Erro ao buscar mapa do Supabase:', err);
      }
    };

    fetchRemoteMap();
  }, [initialMapData, roomId, supabase]);

  // Função auxiliar: Encontrar cômodo que contém uma coordenada percentual (x, y)
  const findRoomAt = useCallback(
    (x: number, y: number): string => {
      const match = rooms.find(
        (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
      );
      return match ? match.id : '';
    },
    [rooms]
  );

  // Adicionar Nova Sala com valores padrão inteligentes
  const handleAddRoom = () => {
    const newId = `room_${Date.now()}`;
    const newRoom: MapRoom = {
      id: newId,
      name: `Sala ${rooms.length + 1}`,
      x: Math.min(80, 10 + (rooms.length * 5) % 50),
      y: Math.min(80, 10 + (rooms.length * 5) % 50),
      width: 25,
      height: 25,
      color: PRESET_COLORS[rooms.length % PRESET_COLORS.length],
    };

    setRooms((prev) => [...prev, newRoom]);
    setSelectedRoomId(newId);
    setSelectedTaskId(null);
  };

  // Adicionar Novo Ponto de Tarefa (Task Node)
  const handleAddTask = () => {
    const newId = `task_${Date.now()}`;
    const nextTokenNum = String(tasks.length + 1).padStart(2, '0');
    const defaultX = 50;
    const defaultY = 50;
    const assignedRoomId = findRoomAt(defaultX, defaultY);

    const newTask: MapTask = {
      id: newId,
      roomId: assignedRoomId,
      pointToken: `POINT_${nextTokenNum}`,
      x: defaultX,
      y: defaultY,
    };

    setTasks((prev) => [...prev, newTask]);
    setSelectedTaskId(newId);
    setSelectedRoomId(null);
  };

  // Excluir Sala Selecionada
  const handleDeleteRoom = (id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    // Limpar referência do roomId nas tarefas associadas
    setTasks((prev) => prev.map((t) => (t.roomId === id ? { ...t, roomId: '' } : t)));
    if (selectedRoomId === id) setSelectedRoomId(null);
  };

  // Excluir Tarefa Selecionada
  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTaskId === id) setSelectedTaskId(null);
  };

  // Handler de MouseDown para iniciar o arrasto de mover sala
  const handleRoomMouseDown = (e: React.MouseEvent, room: MapRoom) => {
    e.stopPropagation();
    setSelectedRoomId(room.id);
    setSelectedTaskId(null);

    setDragState({
      type: 'MOVE_ROOM',
      id: room.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: room.x,
      startY: room.y,
    });
  };

  // Handler de MouseDown para iniciar o redimensionamento da sala
  const handleResizeMouseDown = (e: React.MouseEvent, room: MapRoom) => {
    e.stopPropagation();
    setSelectedRoomId(room.id);
    setSelectedTaskId(null);

    setDragState({
      type: 'RESIZE_ROOM',
      id: room.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startW: room.width,
      startH: room.height,
    });
  };

  // Handler de MouseDown para arrastar nó de tarefa
  const handleTaskMouseDown = (e: React.MouseEvent, task: MapTask) => {
    e.stopPropagation();
    setSelectedTaskId(task.id);
    setSelectedRoomId(null);

    setDragState({
      type: 'MOVE_TASK',
      id: task.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: task.x,
      startY: task.y,
    });
  };

  // Handler de MouseMove global no Canvas
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - dragState.startMouseX) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragState.startMouseY) / rect.height) * 100;

      if (dragState.type === 'MOVE_ROOM') {
        const room = rooms.find((r) => r.id === dragState.id);
        if (!room) return;

        const newX = Math.max(0, Math.min(100 - room.width, dragState.startX + deltaXPercent));
        const newY = Math.max(0, Math.min(100 - room.height, dragState.startY + deltaYPercent));

        setRooms((prev) =>
          prev.map((r) => (r.id === dragState.id ? { ...r, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 } : r))
        );
      } else if (dragState.type === 'RESIZE_ROOM') {
        const room = rooms.find((r) => r.id === dragState.id);
        if (!room) return;

        const newW = Math.max(5, Math.min(100 - room.x, dragState.startW + deltaXPercent));
        const newH = Math.max(5, Math.min(100 - room.y, dragState.startH + deltaYPercent));

        setRooms((prev) =>
          prev.map((r) => (r.id === dragState.id ? { ...r, width: Math.round(newW * 10) / 10, height: Math.round(newH * 10) / 10 } : r))
        );
      } else if (dragState.type === 'MOVE_TASK') {
        const newX = Math.max(2, Math.min(98, dragState.startX + deltaXPercent));
        const newY = Math.max(2, Math.min(98, dragState.startY + deltaYPercent));
        const roundedX = Math.round(newX * 10) / 10;
        const roundedY = Math.round(newY * 10) / 10;

        const assignedRoomId = findRoomAt(roundedX, roundedY);

        setTasks((prev) =>
          prev.map((t) =>
            t.id === dragState.id ? { ...t, x: roundedX, y: roundedY, roomId: assignedRoomId } : t
          )
        );
      }
    },
    [dragState, rooms, findRoomAt]
  );

  const handleMouseUp = () => {
    setDragState(null);
  };

  // Persistir o mapa no Supabase (ou localStorage em modo demo)
  const handleSaveMap = async () => {
    if (!roomId) {
      setSaveFeedback({ type: 'error', message: 'ID da sala não fornecido.' });
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const mapDataPayload: MapData = {
        rooms,
        tasks,
      };

      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);

      if (!isValidUuid) {
        // ID de demonstração ou não-UUID (ex: "demo-room-id"): salvar localmente no localStorage
        localStorage.setItem(`demo_map_data_${roomId}`, JSON.stringify(mapDataPayload));

        setSaveFeedback({
          type: 'success',
          message: 'Configurações do Mapa salvas com sucesso (Modo Demonstração)!',
        });

        if (onSaveSuccess) {
          onSaveSuccess(mapDataPayload);
        }

        setTimeout(() => {
          setSaveFeedback(null);
        }, 4000);
        return;
      }

      const { error } = await supabase
        .from('rooms')
        .update({ map_data: mapDataPayload as any })
        .eq('id', roomId);

      if (error) {
        throw error;
      }

      setSaveFeedback({ type: 'success', message: 'Configurações do Mapa salvas no Supabase!' });

      if (onSaveSuccess) {
        onSaveSuccess(mapDataPayload);
      }

      setTimeout(() => {
        setSaveFeedback(null);
      }, 4000);
    } catch (err: any) {
      const detailedMessage =
        err?.message ||
        err?.details ||
        err?.hint ||
        (typeof err === 'object' && err !== null && Object.keys(err).length > 0
          ? JSON.stringify(err)
          : String(err));

      console.error('[GridMapBuilder] Erro detalhado ao salvar mapa:', detailedMessage, err);
      setSaveFeedback({
        type: 'error',
        message: detailedMessage || 'Falha ao salvar mapa no Supabase. Tente novamente.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const currentRoom = rooms.find((r) => r.id === selectedRoomId);
  const currentTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="w-full flex flex-col gap-6 bg-slate-950 text-white p-6 rounded-3xl border border-slate-800 shadow-2xl font-sans">
      {/* Header do Construtor */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-black tracking-wider uppercase text-cyan-400 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <span>Grid Map Builder • Host Tactical Panel</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Desenhe o layout vetorial do espaço físico real da sala (coordenadas relativas 0-100%).
          </p>
        </div>

        {/* Feedback visual de salvamento */}
        <div className="flex items-center gap-3">
          {saveFeedback && (
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
                saveFeedback.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
              }`}
            >
              {saveFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              <span>{saveFeedback.message}</span>
            </div>
          )}

          <button
            onClick={handleSaveMap}
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Salvando...' : 'Salvar Configurações do Mapa'}</span>
          </button>
        </div>
      </div>

      {/* Grid Principal: Paleta Lateral + Interactive Canvas SVG */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Paleta Lateral Esquerda (Controles & Propriedades) */}
        <div className="w-full lg:w-80 flex flex-col gap-5 shrink-0">
          {/* Botões de Ação Rápida */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Ferramentas de Criação</span>
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleAddRoom}
                className="py-2.5 px-3 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/50 text-cyan-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Sala</span>
              </button>

              <button
                onClick={handleAddTask}
                className="py-2.5 px-3 bg-amber-950/80 hover:bg-amber-900 border border-amber-700/50 text-amber-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Ponto QR</span>
              </button>
            </div>
          </div>

          {/* Painel de Edição de Sala Selecionada */}
          {currentRoom && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 animate-fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-black uppercase text-cyan-400 flex items-center gap-1.5">
                  <Square className="w-4 h-4" style={{ color: currentRoom.color }} />
                  Propriedades da Sala
                </span>
                <button
                  onClick={() => handleDeleteRoom(currentRoom.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  title="Excluir Sala"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Nome do Cômodo Físico:
                </label>
                <input
                  type="text"
                  value={currentRoom.name}
                  onChange={(e) =>
                    setRooms((prev) =>
                      prev.map((r) => (r.id === currentRoom.id ? { ...r, name: e.target.value } : r))
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                />
              </div>

              {/* Cores Táticas Pré-definidas */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1.5">
                  Cor da Zona no Mapa:
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        setRooms((prev) =>
                          prev.map((r) => (r.id === currentRoom.id ? { ...r, color: c } : r))
                        )
                      }
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        currentRoom.color === c ? 'scale-125 border-white shadow-md' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Controles Numéricos de Dimensão (%) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] text-slate-400 block">Largura (W %):</label>
                  <input
                    type="number"
                    min={5}
                    max={100 - currentRoom.x}
                    value={currentRoom.width}
                    onChange={(e) => {
                      const val = Math.max(5, Math.min(100 - currentRoom.x, Number(e.target.value)));
                      setRooms((prev) =>
                        prev.map((r) => (r.id === currentRoom.id ? { ...r, width: val } : r))
                      );
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-cyan-300"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block">Altura (H %):</label>
                  <input
                    type="number"
                    min={5}
                    max={100 - currentRoom.y}
                    value={currentRoom.height}
                    onChange={(e) => {
                      const val = Math.max(5, Math.min(100 - currentRoom.y, Number(e.target.value)));
                      setRooms((prev) =>
                        prev.map((r) => (r.id === currentRoom.id ? { ...r, height: val } : r))
                      );
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-cyan-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Painel de Edição de Tarefa Selecionada */}
          {currentTask && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 animate-fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-amber-400" />
                  Propriedades do Ponto QR
                </span>
                <button
                  onClick={() => handleDeleteTask(currentTask.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  title="Excluir Ponto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Token do QR Code Físico Plastificado:
                </label>
                <input
                  type="text"
                  value={currentTask.pointToken}
                  onChange={(e) =>
                    setTasks((prev) =>
                      prev.map((t) => (t.id === currentTask.id ? { ...t, pointToken: e.target.value } : t))
                    )
                  }
                  placeholder="Ex: POINT_01, POINT_02"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Cômodo Associado:
                </label>
                <select
                  value={currentTask.roomId}
                  onChange={(e) =>
                    setTasks((prev) =>
                      prev.map((t) => (t.id === currentTask.id ? { ...t, roomId: e.target.value } : t))
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                >
                  <option value="">-- Sem Cômodo (Solto) --</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Dica do Editor */}
          {!currentRoom && !currentTask && (
            <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl text-xs text-slate-400 space-y-2 text-center">
              <Move className="w-5 h-5 mx-auto text-slate-500" />
              <p>
                Clique e arraste os cômodos ou pontos no canvas para reposicionar em <strong>0-100%</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Interactive SVG Canvas Area */}
        <div className="flex-1 w-full relative select-none">
          <div className="flex justify-between items-center mb-2 px-1 text-xs text-slate-400 font-mono">
            <span>Grid Scale: Relative 0-100%</span>
            <span>
              Rooms: <strong className="text-cyan-400">{rooms.length}</strong> | QR Tasks:{' '}
              <strong className="text-amber-400">{tasks.length}</strong>
            </span>
          </div>

          <div
            ref={canvasRef as any}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full aspect-[4/3] bg-slate-950 rounded-3xl border-2 border-slate-800 relative overflow-hidden shadow-2xl cursor-crosshair"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(51, 65, 85, 0.15) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(51, 65, 85, 0.15) 1px, transparent 1px)
              `,
              backgroundSize: '10% 10%',
            }}
          >
            {/* Renderização das Salas (Rooms) */}
            {rooms.map((room) => {
              const isSelected = selectedRoomId === room.id;

              return (
                <div
                  key={room.id}
                  onMouseDown={(e) => handleRoomMouseDown(e, room)}
                  style={{
                    position: 'absolute',
                    left: `${room.x}%`,
                    top: `${room.y}%`,
                    width: `${room.width}%`,
                    height: `${room.height}%`,
                    backgroundColor: room.color,
                  }}
                  className={`rounded-2xl p-3 flex flex-col justify-between cursor-grab active:cursor-grabbing transition-shadow border-2 shadow-lg backdrop-blur-sm ${
                    isSelected
                      ? 'border-amber-400 ring-4 ring-amber-400/20 shadow-amber-500/20 z-20'
                      : 'border-white/20 hover:border-white/60 z-10'
                  }`}
                >
                  {/* Nome da Sala */}
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-black text-white uppercase tracking-wider drop-shadow-md truncate">
                      {room.name}
                    </span>
                    <span className="text-[9px] font-mono text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
                      {Math.round(room.width)}x{Math.round(room.height)}%
                    </span>
                  </div>

                  {/* Handle de Redimensionamento no Canto Inferior Direito */}
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, room)}
                    className="self-end p-1 bg-black/60 hover:bg-black text-white rounded cursor-nwse-resize transition-all border border-white/20"
                    title="Arrastar para Redimensionar"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}

            {/* Renderização dos Nós de Tarefas (Task Nodes) */}
            {tasks.map((task) => {
              const isSelected = selectedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  onMouseDown={(e) => handleTaskMouseDown(e, task)}
                  style={{
                    position: 'absolute',
                    left: `${task.x}%`,
                    top: `${task.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`group z-30 cursor-grab active:cursor-grabbing flex flex-col items-center gap-1 transition-transform ${
                    isSelected ? 'scale-125 z-40' : 'hover:scale-110'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center border-2 shadow-xl transition-colors ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 border-white ring-4 ring-amber-400/30'
                        : task.roomId
                        ? 'bg-slate-900 text-amber-400 border-amber-400'
                        : 'bg-red-950 text-red-400 border-red-500'
                    }`}
                  >
                    <MapPin className="w-5 h-5 animate-pulse" />
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black font-mono bg-slate-950/90 text-amber-300 border border-slate-800 shadow uppercase">
                    {task.pointToken}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
