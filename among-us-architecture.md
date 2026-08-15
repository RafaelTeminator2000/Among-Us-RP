# Plano de Arquitetura e Próximas Etapas: Among Us RP Phygital
**Autor:** Cofundador Técnico & Arquiteto de Software [i]
**Data:** Agosto de 2026 [i]
**Tecnologias Core:** Next.js 15 (App Router / Turbopack), Tailwind CSS v4, TypeScript 5, Supabase (Auth, RLS, Realtime / WebSockets) [312, 313, 318].

---

## 1. Diagnóstico do Estado Atual do Repositório

Com base na análise do repositório `RafaelTeminator2000/Among-Us-RP` [102, 103], identificamos que a fundação do projeto está consolidada com uma arquitetura moderna e de alta performance:

1. **Roteador Principal de Estado (`src/app/room/[id]/page.tsx`):** Já está implementado e compatível com o Next.js 15 App Router utilizando o padrão assíncrono para o tratamento de parâmetros (`params: Promise<{ id: string }>`) [312]. Ele atua como o coração reativo (FSM) controlando as transições de estado síncronas entre os modos `LOBBY`, `PLAYING` (com o mapa e HUD), `EMERGENCY_MEETING` (votação sincronizada) e `ELIMINATED` [312].
2. **Sincronização em Tempo Real:** Conexão direta com o Supabase Realtime, inscrevendo os clientes no canal `room-sync:{roomId}` para ouvir broadcasts essenciais como `PLAYER_KILLED`, `EMERGENCY_MEETING`, `SABOTAGE_TRIGGERED` e `SABOTAGE_FIXED` [312].
3. **Mecânicas de Gameplay Consolidadas:** 
   - HUD principal (`GameMapHUD`) para navegação física [312].
   - Leitor de QR Codes nativo (`TaskQrReader`) para validação de locais físicos de tarefas [312, 316].
   - Minigame clássico de fiação elétrica (`WireMinigame`) [312, 315].
   - Sistema de Abate do Impostor (`ImpostorKillButton`) com controle de recarga (*cooldown*) e seleção direta no celular [307, 312].
   - Tela de Eliminação instantânea sem suporte a fantasmas (`EliminationScreen`) para evitar discussões físicas e burlas na atuação presencial [288, 312].

---

## 2. Arquiteturas Detalhadas de Integração para as 4 Próximas Etapas

Para evoluirmos de um protótipo funcional para uma plataforma de nível de produção robusta, escalável e com setup físico simplificado, desenhamos a arquitetura técnica das próximas 4 implementações críticas.

### (a) Grid Map Builder (Host Visual Editor)
Para que o mestre do jogo monte salas e caminhos do zero sem depender de plantas baixas [266, 268]:
- **Persistência de Dados:** O Host edita o mapa em uma interface drag-and-drop baseada em grade SVG 2D. O mapa final é serializado em um documento JSON leve e salvo na coluna `rooms.map_data` [265, 273].
- **Estrutura do JSON do Mapa:**
  ```json
  {
    "gridSize": { "rows": 12, "cols": 12 },
    "rooms": [
      { "id": "altar", "name": "Altar", "x": 1, "y": 1, "w": 4, "h": 3, "color": "#1868db" },
      { "id": "corredor", "name": "Corredor Central", "x": 1, "y": 4, "w": 10, "h": 1, "color": "#334155" }
    ],
    "nodes": [
      { "id": "node_01", "room_id": "altar", "type": "WIRES", "label": "Ligar Fios", "x": 15, "y": 25 }
    ]
  }
  ```
- **Fluxo de Dados:** O banco não carrega imagens pesadas [271]. Os PWAs dos jogadores lêem o JSON de `rooms.map_data` via assinatura em tempo real e renderizam o SVG nativo correspondente, garantindo consumo mínimo de banda e renderização instantânea [261, 269].

### (b) Gerador de PDF e Kit de Impressão de QR Codes Permanentes
Para eliminar o desperdício de papel e setup físico complexo a cada partida, adotamos a arquitetura de **Mapeamento de Pontos Genéricos** [291, 292]:
1. **Kit Físico Permanente:** Imprime-se uma única vez uma coleção de QR Codes fixos plastificados (ex: `POINT_01`, `POINT_02`, `POINT_03`, `EMERGENCY_DESK`) e crachás individuais para os jogadores [291, 292, 294].
2. **Dynamic Mapping:** No painel do Host, as salas e tarefas desenhadas são associadas logicamente aos tokens genéricos (`POINT_XX`) daquela partida.
3. **Lógica de Scanner:** Quando um Crewmate escaneia o `POINT_01` (colado na parede do altar), o PWA detecta o token, consulta a tabela de relacionamento atual, mapeia que para essa rodada o Altar tem a tarefa `WIRES`, e abre o minigame correspondente de ligar os fios [257, 292].

### (c) Sistema de Sabotagem de Luzes Reativo em Tempo Real
- **Gatilho (Impostor):** O Impostor ativa a sabotagem de escuridão no seu celular [259].
- **Sincronização:** Supabase Realtime emite uma notificação em lote (`SABOTAGE_TRIGGERED`) [312].
- **Bloqueio Reativo:** A tela dos celulares de todos os Tripulantes vivos entra em "Modo Escuridão" (fundo preto com piscar vermelho e chiado sonoro via Web Audio API) [259, 295]. O mapa interativo esconde o layout das salas e exibe apenas um marcador de perigo no local físico do disjuntor gerador [264].
- **Resolução Phygital:** Um tripulante deve se dirigir ao local do gerador, escanear o QR Code de sabotagem correspondente e resolver o minigame de rearmar os disjuntores em tempo real, disparando o evento `SABOTAGE_FIXED` que destrava as interfaces de todos [259, 312].

### (d) Modo Telão (TV Dashboard) & Web Audio API
- **Visualização Centralizada:** Rota `/room/[id]/tv` projetada para Smart TVs ou projetores [293]. Exibe o status da partida, barra de progresso global em tempo real e anúncios síncronos de reuniões de emergência com contagem regressiva [293].
- **Efeitos Sonoros Imersivos (Web Audio API):** Elimina a necessidade de o mestre gritar ou usar caixas de som manuais [293]. Os eventos de áudio são gerados de forma programática e síncrona nos celulares dos jogadores e na TV através de osciladores e buffers de áudio carregados localmente, garantindo latência inferior a 10ms [293, 295].

---

## 3. Implementações de Código Limpo e Otimizado

### Componente A: Construtor de Mapa em Grade SVG (Host Level Editor)

Componente leve de arrastar e soltar (drag and drop) baseado em coordenadas matriciais em React/TypeScript, gerando o layout vetorial responsivo que será salvo no Supabase.

```typescript
import React, { useState } from "react";

interface GridRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface GridMapBuilderProps {
  onSave: (mapData: { rooms: GridRoom[] }) => void;
}

export const GridMapBuilder: React.FC<GridMapBuilderProps> = ({ onSave }) => {
  const [rooms, setRooms] = useState<GridRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const gridSize = 10; // Grade de 10x10

  const handleCellClick = (x: number, y: number) => {
    if (selectedRoom) {
      setRooms((prev) =>
        prev.map((r) => (r.id === selectedRoom ? { ...r, x, y } : r))
      );
    } else {
      const newRoom: GridRoom = {
        id: `room_${Date.now()}`,
        name: `Sala ${rooms.length + 1}`,
        x,
        y,
        w: 2,
        h: 2,
        color: "#1868db", // Cor institucional
      };
      setRooms((prev) => [...prev, newRoom]);
      setSelectedRoom(newRoom.id);
    }
  };

  const updateRoomSize = (id: string, dw: number, dh: number) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, w: Math.max(1, r.w + dw), h: Math.max(1, r.h + dh) } : r
      )
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 p-6 bg-slate-950 text-white rounded-lg border border-slate-800">
      {/* Visual Canvas */}
      <div className="flex-1">
        <h3 className="text-lg font-bold mb-4 text-sky-400">Desenho da Igreja / Salão</h3>
        <div 
          className="grid grid-cols-10 gap-1 bg-slate-900 p-2 rounded-lg border border-slate-800 relative"
          style={{ aspectRatio: "1/1" }}
        >
          {Array.from({ length: gridSize * gridSize }).map((_, i) => {
            const x = i % gridSize;
            const y = Math.floor(i / gridSize);
            return (
              <button
                key={i}
                onClick={() => handleCellClick(x, y)}
                className="bg-slate-950 hover:bg-slate-800/50 rounded-sm border border-slate-900 transition-colors"
                style={{ aspectRatio: "1/1" }}
              />
            );
          })}

          {/* Renderização das Salas em Vetores SVG */}
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRoom(room.id);
              }}
              style={{
                position: "absolute",
                left: `${(room.x / gridSize) * 100}%`,
                top: `${(room.y / gridSize) * 100}%`,
                width: `${(room.w / gridSize) * 100}%`,
                height: `${(room.h / gridSize) * 100}%`,
                backgroundColor: room.color,
              }}
              className={`absolute rounded-lg border-2 p-2 flex flex-col justify-between cursor-pointer transition-all ${
                selectedRoom === room.id ? "border-amber-400 scale-[1.02]" : "border-sky-500"
              }`}
            >
              <span className="text-xs font-bold truncate">{room.name}</span>
              {selectedRoom === room.id && (
                <div className="flex gap-1 justify-end">
                  <button 
                    onClick={() => updateRoomSize(room.id, 1, 0)} 
                    className="p-1 bg-black/60 rounded text-[10px] hover:bg-black"
                  >
                    +W
                  </button>
                  <button 
                    onClick={() => updateRoomSize(room.id, 0, 1)} 
                    className="p-1 bg-black/60 rounded text-[10px] hover:bg-black"
                  >
                    +H
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Editor de Propriedades */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        <h3 className="text-lg font-bold text-sky-400">Propriedades do Mapa</h3>
        {selectedRoom ? (
          <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 flex flex-col gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nome da Zona</label>
              <input
                type="text"
                value={rooms.find((r) => r.id === selectedRoom)?.name || ""}
                onChange={(e) =>
                  setRooms((prev) =>
                    prev.map((r) => (r.id === selectedRoom ? { ...r, name: e.target.value } : r))
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Cor</label>
              <input
                type="color"
                value={rooms.find((r) => r.id === selectedRoom)?.color || "#1868db"}
                onChange={(e) =>
                  setRooms((prev) =>
                    prev.map((r) => (r.id === selectedRoom ? { ...r, color: e.target.value } : r))
                  )
                }
                className="w-full bg-transparent border-0 rounded h-10 cursor-pointer"
              />
            </div>
            <button
              onClick={() => {
                setRooms((prev) => prev.filter((r) => r.id !== selectedRoom));
                setSelectedRoom(null);
              }}
              className="mt-2 w-full py-2 bg-red-600/80 hover:bg-red-600 text-sm font-semibold rounded"
            >
              Excluir Zona
            </button>
          </div>
        ) : (
          <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 text-sm text-slate-400 text-center">
            Clique na grade para criar uma nova sala física de tarefas.
          </div>
        )}

        <button
          onClick={() => onSave({ rooms })}
          className="w-full py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 font-bold rounded-lg transition-all"
        >
          Salvar Configurações de Coordenadas
        </button>
      </div>
    </div>
  );
};
```

---

### Componente B: Bloqueio Reativo de Sabotagem (PWA Crewmate)

Este componente intercepta a tela do Tripulante ao receber o broadcast de sabotagem de luzes, forçando-o a ir presencialmente até o QR Code do painel elétrico.

```typescript
import React, { useState } from "react";
import { AlertTriangle, Zap } from "lucide-react";

interface SabotagemOverlayProps {
  isSabotaged: boolean;
  onScanResolved: (tokenScanned: string) => void;
}

export const SabotagemOverlay: React.FC<SabotagemOverlayProps> = ({ isSabotaged, onScanResolved }) => {
  const [isRearming, setIsRearming] = useState(false);
  const [switches, setSwitches] = useState([false, false, true, false, true]); // Estados dos disjuntores

  if (!isSabotaged) return null;

  const handleSwitchToggle = (index: number) => {
    const updated = [...switches];
    updated[index] = !updated[index];
    setSwitches(updated);

    // Se todos os disjuntores estiverem ligados (true), a sabotagem é resolvida
    if (updated.every((state) => state === true)) {
      onScanResolved("SABOTAGE_LIGHTS_RESOLVED");
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6 text-white animate-pulse">
      <div className="absolute inset-0 bg-red-950/20 pointer-events-none border-4 border-red-600 animate-pulse" />
      
      <AlertTriangle className="w-16 h-16 text-red-500 mb-4 animate-bounce" />
      <h2 className="text-2xl font-black text-center tracking-wider uppercase mb-2">
        SISTEMA DE LUZES SABOTADO
      </h2>
      <p className="text-slate-400 text-sm text-center max-w-xs mb-8">
        A energia do local físico foi desativada. Dirija-se imediatamente ao Gerador Principal para rearmar os disjuntores.
      </p>

      {!isRearming ? (
        <button
          onClick={() => setIsRearming(true)}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all active:scale-95"
        >
          <Zap className="w-5 h-5" /> Abrir Painel de Disjuntores
        </button>
      ) : (
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col gap-6">
          <h3 className="text-center font-bold text-amber-400">Rearme de Segurança</h3>
          
          <div className="flex justify-around items-center py-4 bg-slate-950 rounded-lg">
            {switches.map((state, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <span className={`text-[10px] ${state ? "text-green-400" : "text-red-500"}`}>
                  {state ? "ON" : "OFF"}
                </span>
                <button
                  onClick={() => handleSwitchToggle(idx)}
                  className={`w-8 h-16 rounded-md p-1 flex flex-col justify-between transition-colors ${
                    state ? "bg-green-600" : "bg-red-600"
                  }`}
                >
                  <div className={`w-6 h-6 bg-white rounded shadow-md transition-transform duration-200 ${
                    state ? "transform translate-y-8" : ""
                  }`} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setIsRearming(false)}
            className="w-full py-2 text-xs text-slate-500 hover:text-slate-400 font-semibold text-center"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );
};
```

---

### Componente C: Gerenciador de Áudio Imersivo (Web Audio API)

Uma classe de serviço estática em TypeScript para gerenciar efeitos sonoros síncronos de baixa latência em toda a sala do evento presencial.

```typescript
export class AudioSystem {
  private static context: AudioContext | null = null;

  private static getContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.context;
  }

  // Toca o alerta de emergência síncrono utilizando osciladores sintéticos
  public static playEmergencyMeetingAlert() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Primeiro oscilador (Tom base)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(140, now);
      osc1.frequency.linearRampToValueAtTime(80, now + 1.2);

      // Segundo oscilador para dar dissonância dramática
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(145, now);
      osc2.frequency.linearRampToValueAtTime(85, now + 1.2);

      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
      
      gain2.gain.setValueAtTime(0.2, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 1.5);

      osc2.start(now);
      osc2.stop(now + 1.5);
    } catch (err) {
      console.warn("Falha ao inicializar o Web Audio Context:", err);
    }
  }

  // Chiado elétrico para sabotagem de luzes
  public static playSabotageNoise() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 1.0; // 1 segundo de ruído
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Preenche o buffer com ruído branco
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      // Filtro passa-faixa para simular curto elétrico
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1000;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noiseNode.start(now);
      noiseNode.stop(now + 0.8);
    } catch (err) {
      console.warn("Falha no Web Audio API:", err);
    }
  }
}
```

---

## 4. Desenho de UI (Wireframes e Design Tokens)

O Modo Telão (`/room/[id]/tv`) utiliza um tema otimizado para projeção, priorizando contraste em salas escuras (Design de Contraste para Ambientes Phygital):

### Wireframe Textual do Modo Telão (Smart TV / Projetor)

```
================================================================================
| [A7X9] LOBBY ATIVO                                 | BARRA GLOBAL:  78%      |
|------------------------------------------------------------------------------|
|                                                                              |
|      (O)  (O)  (O)  (O)  (O)                 / \   ALERT                    |
|      Red  Blue Green Pink Gray               / ! \  EMERGENCY MEETING!       |
|                                             /_____\                          |
|                                                                              |
|  Debate Ativo: 100s restantes              Votem Secretamente no Celular     |
================================================================================
```

#### Design Tokens Aplicados (Acessibilidade e Visibilidade Escura):
- **Primary Background:** `#090d16` (Deep Space Dark) para absorção de luz no projetor.
- **Accents:** `#1868db` (Atlassian Blue institucional) [33], `#e11d48` (Red Alert) e `#f59e0b` (Amber Alert).
- **Typography:** Sans-serif pesada de alta visibilidade e espaçamento de caracteres otimizado para visualização a mais de 5 metros de distância.

---

## 5. Próximos Passos e Cronograma de Entrega

Para consolidarmos este MVP Phygital, sugerimos a execução em espiral de 4 sprints:

```
[Mapeamento de Coordenadas] -> [Geração de PDF do Kit] -> [Lógica de Sabotagem] -> [Projeção e Áudio]
```

1. **Sprint 1: Conclusão do Editor de Grade do Host (Grid Map Builder):** Integrar o componente React SVG acima e salvar a coluna `map_data` no Supabase [265].
2. **Sprint 2: Motor de Mapeamento Dinâmico (QR Kit):** Criar a rota de geração do PDF estático dos QR Codes e a amarração lógica no banco [291, 292].
3. **Sprint 3: Orquestração em Tempo Real de Sabotagem:** Testar o tempo de resposta do Supabase Realtime sob estresse simulando mais de 20 conexões móveis simultâneas [252, 335].
4. **Sprint 4: Imersão Sonoplasta e Telão:** Validar as transições de visualização e áudio da TV central [293].
