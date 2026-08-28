'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  ArrowLeft,
  Grid,
  Shield,
  Sparkles,
  Megaphone,
  CreditCard,
  Zap,
  Gauge,
  KeyRound,
  Wrench,
  Flame,
  Trash2,
  Wind,
  Compass,
  Fuel,
  Skull,
  Radio,
  FlaskConical,
  UploadCloud,
  Layers,
  LucideIcon,
  Loader2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export interface QrCardDefinition {
  token: string;
  title: string;
  category: 'REPORT' | 'EMERGENCY' | 'SABOTAGE' | 'TASK' | 'MULTI_STEP';
  description: string;
  icon: LucideIcon;
  badge: string;
}

export const TACTICAL_CARDS: QrCardDefinition[] = [
  // --- EMERGÊNCIA & REPORTS ---
  {
    token: 'REPORT_BODY',
    title: 'REPORT DE CORPO ENCONTRADO',
    category: 'REPORT',
    description: 'Aponte o scanner do celular neste QR Code para convocar uma REUNIÃO DE EMERGÊNCIA imediata!',
    icon: Skull,
    badge: 'ALERTA MÁXIMO',
  },
  {
    token: 'EMERGENCY_BUTTON',
    title: 'BOTÃO DE EMERGÊNCIA CENTRAL',
    category: 'EMERGENCY',
    description: 'Aponte o scanner para abrir o painel de Reunião de Emergência da nave (Cafeteria).',
    icon: Megaphone,
    badge: 'MESA TÁTICA',
  },

  // --- SABOTAGENS PRESENCIAIS (MECÂNICAS E CRÍTICAS) ---
  {
    token: 'TASK_BREAKER',
    title: 'QUADRO DE LUZ / DISJUNTORES',
    category: 'SABOTAGE',
    description: 'Aponte o scanner no Quadro Elétrico para rearmar os disjuntores e acender as luzes da nave.',
    icon: Zap,
    badge: 'SABOTAGEM • LUZES',
  },
  {
    token: 'TASK_COMMS',
    title: 'CONSERTO DAS COMUNICAÇÕES',
    category: 'SABOTAGE',
    description: 'Aponte o scanner na Sala de Rádio para calibrar a frequência e restabelecer o sinal de comunicações.',
    icon: Radio,
    badge: 'SABOTAGEM • COMUNICAÇÃO',
  },
  {
    token: 'TASK_REACTOR',
    title: 'ESTABILIZADOR DO REATOR',
    category: 'SABOTAGE',
    description: 'Alerta de Fusão (45s)! Aponte o scanner na Sala do Reator para sincronizar os painéis e estabilizar o núcleo.',
    icon: Flame,
    badge: 'CRÍTICA • REATOR (45s)',
  },
  {
    token: 'TASK_CLEAN_O2',
    title: 'PURGADOR DE OXIGÊNIO (O2)',
    category: 'SABOTAGE',
    description: 'Alerta de Asfixia (45s)! Aponte o scanner na Sala de O2 para purgar os filtros e restabelecer o oxigênio.',
    icon: Wind,
    badge: 'CRÍTICA • OXIGÊNIO (45s)',
  },

  // --- TAREFAS MULTI-ETAPAS (DESLOCAMENTO PRESENCIAL) ---
  {
    token: 'TASK_GARBAGE_P1',
    title: 'ESVAZIAR LIXO (PARTE 1)',
    category: 'MULTI_STEP',
    description: 'Puxe e segure a alavanca do triturador para esvaziar a primeira lixeira.',
    icon: Trash2,
    badge: 'MULTI-ETAPAS • PARTE 1/2',
  },
  {
    token: 'TASK_GARBAGE_P2',
    title: 'ESVAZIAR LIXO (PARTE 2)',
    category: 'MULTI_STEP',
    description: 'Puxe e segure a alavanca da escotilha principal para ejetar os resíduos ao espaço.',
    icon: Trash2,
    badge: 'MULTI-ETAPAS • PARTE 2/2',
  },
  {
    token: 'TASK_REFUEL_P1',
    title: 'COMBUSTÍVEL: TANQUE / GALÃO',
    category: 'MULTI_STEP',
    description: 'Mantenha pressionado o botão de vazão do tanque para abastecer o galão de combustível.',
    icon: Fuel,
    badge: 'MULTI-ETAPAS • TANQUE (P1)',
  },
  {
    token: 'TASK_REFUEL_P2',
    title: 'COMBUSTÍVEL: MOTOR SUPERIOR',
    category: 'MULTI_STEP',
    description: 'Despeje o combustível do galão no bocal de entrada do Motor Superior.',
    icon: Fuel,
    badge: 'MULTI-ETAPAS • MOTOR 1 (P2)',
  },
  {
    token: 'TASK_REFUEL_P3',
    title: 'COMBUSTÍVEL: MOTOR INFERIOR',
    category: 'MULTI_STEP',
    description: 'Despeje o combustível do galão no bocal de entrada do Motor Inferior.',
    icon: Fuel,
    badge: 'MULTI-ETAPAS • MOTOR 2 (P3)',
  },
  {
    token: 'TASK_DIVERT_POWER_P1',
    title: 'DIRECIONAR ENERGIA: PAINEL PRINCIPAL',
    category: 'MULTI_STEP',
    description: 'Conecte os circuitos de energia no painel central para liberar o bypass.',
    icon: Zap,
    badge: 'MULTI-ETAPAS • PARTE 1/2',
  },
  {
    token: 'TASK_DIVERT_POWER_P2',
    title: 'DIRECIONAR ENERGIA: DISJUNTOR ALVO',
    category: 'MULTI_STEP',
    description: 'Ative o disjuntor da sala alvo para receber e ligar a energia redirecionada.',
    icon: Zap,
    badge: 'MULTI-ETAPAS • PARTE 2/2',
  },
  {
    token: 'TASK_UPLOAD_DATA_P1',
    title: 'TRANSMISSÃO DE DADOS: DOWNLOAD',
    category: 'MULTI_STEP',
    description: 'Baixe os arquivos de telemetria do terminal para o dispositivo portátil.',
    icon: UploadCloud,
    badge: 'MULTI-ETAPAS • PARTE 1/2',
  },
  {
    token: 'TASK_UPLOAD_DATA_P2',
    title: 'TRANSMISSÃO DE DADOS: UPLOAD',
    category: 'MULTI_STEP',
    description: 'Transmita os pacotes de dados descarregados para o servidor central da nave.',
    icon: UploadCloud,
    badge: 'MULTI-ETAPAS • PARTE 2/2',
  },

  // --- TAREFAS DOS TRIPULANTES (MINIGAMES ETAPA ÚNICA) ---
  {
    token: 'TASK_WIRE',
    title: 'REPARAR FIAÇÃO ELÉTRICA',
    category: 'TASK',
    description: 'Conecte os cabos coloridos para reestabelecer a energia do setor.',
    icon: Zap,
    badge: 'TAREFA ELÉTRICA',
  },
  {
    token: 'TASK_CARD_SWIPE',
    title: 'PASSAR O CARTÃO DE ACESSO',
    category: 'TASK',
    description: 'Passe o cartão de credencial na velocidade correta para liberar o painel.',
    icon: CreditCard,
    badge: 'TAREFA ADMIN',
  },
  {
    token: 'TASK_MANIFOLDS',
    title: 'DESBLOQUEAR COLETORES (1-10)',
    category: 'TASK',
    description: 'Pressione os botões numéricos na sequência correta de 1 a 10.',
    icon: KeyRound,
    badge: 'TAREFA REATOR',
  },
  {
    token: 'TASK_DISTRIBUTOR',
    title: 'CALIBRAR DISTRIBUIDOR',
    category: 'TASK',
    description: 'Sincronize as engrenagens dos três anéis no momento exato.',
    icon: Gauge,
    badge: 'TAREFA ELÉTRICA',
  },
  {
    token: 'TASK_KEYPAD',
    title: 'DIGITAR CÓDIGO DE SEGURANÇA',
    category: 'TASK',
    description: 'Insira o código alfanumérico correto no painel de comando.',
    icon: Wrench,
    badge: 'TAREFA SEGURANÇA',
  },
  {
    token: 'TASK_ASTEROIDS',
    title: 'DESTRUIR ASTEROIDES',
    category: 'TASK',
    description: 'Utilize os canhões laser para destruir 20 asteroides no setor.',
    icon: Radio,
    badge: 'TAREFA ARMAS',
  },
  {
    token: 'TASK_GARBAGE',
    title: 'ESVAZIAR LIXO (ÚNICO)',
    category: 'TASK',
    description: 'Puxe e segure a alavanca do triturador para esvaziar os resíduos.',
    icon: Trash2,
    badge: 'TAREFA NAVEGAÇÃO',
  },
  {
    token: 'TASK_ALIGN_ENGINE',
    title: 'ALINHAR MOTOR PRINCIPAL',
    category: 'TASK',
    description: 'Ajuste a alavanca até alinhar o motor com a linha guia pontilhada.',
    icon: Compass,
    badge: 'TAREFA MOTOR',
  },
  {
    token: 'TASK_REFUEL',
    title: 'ABASTECER MOTOR (COMPLETO)',
    category: 'TASK',
    description: 'Mantenha pressionado o botão de vazão até encher o galão do motor.',
    icon: Fuel,
    badge: 'TAREFA MOTOR',
  },
  {
    token: 'TASK_INSPECT_SAMPLE',
    title: 'ANALISAR / ENVIAR AMOSTRA',
    category: 'TASK',
    description: 'Inicie a incubação de 60s na enfermaria e selecione o frasco anômalo.',
    icon: FlaskConical,
    badge: 'TAREFA MEDBAY',
  },
  {
    token: 'TASK_DIVERT_POWER',
    title: 'DIRECIONAR ENERGIA (COMPLETO)',
    category: 'TASK',
    description: 'Conecte o circuito de energia e ative o disjuntor da sala alvo.',
    icon: Zap,
    badge: 'TAREFA ELÉTRICA',
  },
  {
    token: 'TASK_UPLOAD_DATA',
    title: 'ENVIAR DADOS (COMPLETO)',
    category: 'TASK',
    description: 'Transmita os pacotes de dados da estação para a Central da nave.',
    icon: UploadCloud,
    badge: 'TAREFA DADOS',
  },
];

function QrPrintContent() {
  const searchParams = useSearchParams();
  const paramRoomId = searchParams.get('roomId');
  const paramCode = searchParams.get('code');

  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MULTI_STEP' | 'SABOTAGE' | 'EMERGENCY_REPORT' | 'TASK'>('ALL');

  const [returnUrl, setReturnUrl] = useState<string>(() => {
    const roomId = paramRoomId || (typeof window !== 'undefined' ? localStorage.getItem('host_current_room_id') : null);
    const code = paramCode || (typeof window !== 'undefined' ? localStorage.getItem('host_current_room_code') : null);

    if (roomId || code) {
      const query = new URLSearchParams();
      if (roomId) query.set('roomId', roomId);
      if (code) query.set('code', code);
      return `/admin?${query.toString()}`;
    }
    return '/admin';
  });

  useEffect(() => {
    const roomId = paramRoomId || (typeof window !== 'undefined' ? localStorage.getItem('host_current_room_id') : null);
    const code = paramCode || (typeof window !== 'undefined' ? localStorage.getItem('host_current_room_code') : null);

    if (roomId || code) {
      const query = new URLSearchParams();
      if (roomId) query.set('roomId', roomId);
      if (code) query.set('code', code);
      setReturnUrl(`/admin?${query.toString()}`);
    }
  }, [paramRoomId, paramCode]);

  const handlePrint = () => {
    window.print();
  };

  const filteredCards = TACTICAL_CARDS.filter((card) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'MULTI_STEP') return card.category === 'MULTI_STEP';
    if (selectedFilter === 'SABOTAGE') return card.category === 'SABOTAGE';
    if (selectedFilter === 'EMERGENCY_REPORT') return card.category === 'REPORT' || card.category === 'EMERGENCY';
    if (selectedFilter === 'TASK') return card.category === 'TASK' || card.category === 'MULTI_STEP';
    return true;
  });

  const multiStepCount = TACTICAL_CARDS.filter((c) => c.category === 'MULTI_STEP').length;
  const sabotageCount = TACTICAL_CARDS.filter((c) => c.category === 'SABOTAGE').length;
  const emergencyCount = TACTICAL_CARDS.filter((c) => c.category === 'REPORT' || c.category === 'EMERGENCY').length;
  const taskCount = TACTICAL_CARDS.filter((c) => c.category === 'TASK' || c.category === 'MULTI_STEP').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 antialiased font-sans">
      {/* Controles do Host - Escondidos ao Imprimir */}
      <div className="max-w-5xl mx-auto mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl print:hidden">
        <div>
          <Link
            href={returnUrl}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Painel do Host
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            <span>Kit de QR Codes Táticos Presenciais ({TACTICAL_CARDS.length} Cartões)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Imprima o kit completo com Tarefas Multi-Etapas, Sabotagens (Luzes, Rádio, Reator e O2), Botão de Emergência, Report de Corpo e Minigames.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Folha A4 ({filteredCards.length})</span>
          </button>
        </div>
      </div>

      {/* Filtros de Categoria na Tela */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-wrap gap-2.5 items-center justify-between print:hidden">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-2 ${
              selectedFilter === 'ALL'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/40">{TACTICAL_CARDS.length}</span>
          </button>

          <button
            onClick={() => setSelectedFilter('MULTI_STEP')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-2 ${
              selectedFilter === 'MULTI_STEP'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 font-black'
                : 'bg-slate-900 text-amber-300 border border-amber-900/40 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Multi-Etapas (9)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/40">{multiStepCount}</span>
          </button>

          <button
            onClick={() => setSelectedFilter('SABOTAGE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-2 ${
              selectedFilter === 'SABOTAGE'
                ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/30 font-black'
                : 'bg-slate-900 text-purple-300 border border-purple-900/40 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Sabotagens (4)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/40">{sabotageCount}</span>
          </button>

          <button
            onClick={() => setSelectedFilter('EMERGENCY_REPORT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-2 ${
              selectedFilter === 'EMERGENCY_REPORT'
                ? 'bg-red-500 text-white shadow-md shadow-red-500/30 font-black'
                : 'bg-slate-900 text-red-300 border border-red-900/40 hover:text-white'
            }`}
          >
            <Skull className="w-3.5 h-3.5" />
            <span>Emergência & Reports</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/40">{emergencyCount}</span>
          </button>

          <button
            onClick={() => setSelectedFilter('TASK')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-2 ${
              selectedFilter === 'TASK'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 font-black'
                : 'bg-slate-900 text-emerald-300 border border-emerald-900/40 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Todas as Tarefas</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/40">{taskCount}</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Exibindo {filteredCards.length} de {TACTICAL_CARDS.length} cartões
        </div>
      </div>

      {/* Dica do Host (Tela) */}
      <div className="max-w-5xl mx-auto mb-6 p-4 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl text-xs text-cyan-300 flex items-center gap-3 print:hidden">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
        <span>
          <strong>Dica Multi-Etapas:</strong> Cole os QR Codes das etapas em salas diferentes da casa ou do espaço físico. Os tripulantes precisarão andar entre as salas (ex: Tanque $\rightarrow$ Motores) para completar suas missões!
        </span>
      </div>

      {/* Grid de Impressão de Cartões Táticos */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:p-0 print:max-w-none">
        {filteredCards.map((card) => {
          const IconComp = card.icon;
          const isReport = card.category === 'REPORT';
          const isEmergency = card.category === 'EMERGENCY';
          const isSabotage = card.category === 'SABOTAGE';
          const isMultiStep = card.category === 'MULTI_STEP';
          const isCriticalSabotage = card.token === 'TASK_REACTOR' || card.token === 'TASK_CLEAN_O2';

          return (
            <div
              key={card.token + '_' + card.title}
              className={`flex flex-col items-center justify-between border-2 p-6 rounded-3xl text-center aspect-[4/3] break-inside-avoid shadow-xl print:border-2 print:border-black print:text-black print:bg-white print:rounded-none print:shadow-none print:aspect-auto ${
                isReport
                  ? 'border-red-500/60 bg-red-950/40'
                  : isEmergency
                  ? 'border-amber-500/60 bg-amber-950/40'
                  : isSabotage
                  ? isCriticalSabotage
                    ? 'border-red-600/80 bg-red-950/50 shadow-red-500/10'
                    : 'border-purple-500/60 bg-purple-950/40'
                  : isMultiStep
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-slate-700 bg-slate-900/60 border-dashed'
              }`}
            >
              {/* Header do Card */}
              <div className="w-full flex items-center justify-between border-b border-slate-800 pb-2.5 print:border-black">
                <span
                  className={`text-[11px] font-black tracking-widest uppercase print:text-black flex items-center gap-1.5 ${
                    isReport
                      ? 'text-red-400 animate-pulse'
                      : isEmergency
                      ? 'text-amber-400'
                      : isSabotage
                      ? isCriticalSabotage
                        ? 'text-red-400 font-black'
                        : 'text-purple-400 font-bold'
                      : isMultiStep
                      ? 'text-amber-400 font-black'
                      : 'text-cyan-400'
                  }`}
                >
                  <IconComp className="w-4 h-4 print:text-black" />
                  {card.title}
                </span>
                <span className="text-[9px] text-slate-400 font-mono tracking-tight print:text-black font-bold uppercase bg-slate-950 print:bg-transparent px-2 py-0.5 rounded-full border border-slate-800 print:border-none">
                  {card.badge}
                </span>
              </div>

              {/* QR Code Container em SVG Puro */}
              <div className="my-3 p-3.5 bg-white rounded-2xl border border-slate-800 print:border-none print:p-1 flex items-center justify-center">
                <QRCodeSVG
                  value={card.token}
                  size={140}
                  level="H" // Correção alta de erros para iluminação física instável
                  includeMargin={true}
                />
              </div>

              {/* Footer do Card com Token Interno */}
              <div className="w-full space-y-2">
                <div
                  className={`text-sm font-black tracking-widest font-mono py-1.5 px-3 rounded-xl border print:bg-transparent print:text-black print:border-2 print:border-black ${
                    isReport
                      ? 'bg-red-950 text-red-300 border-red-800'
                      : isEmergency
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : isSabotage
                      ? isCriticalSabotage
                        ? 'bg-red-950 text-red-300 border-red-700'
                        : 'bg-purple-950 text-purple-300 border-purple-800'
                      : isMultiStep
                      ? 'bg-amber-950 text-amber-300 border-amber-800 font-black'
                      : 'bg-slate-950 text-cyan-300 border-slate-800'
                  }`}
                >
                  {card.token}
                </div>
                <p className="text-[10px] text-slate-400 tracking-tight leading-tight print:text-black print:font-semibold">
                  {card.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Estilos Globais de Impressão CSS (@media print) */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}

export default function QrPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      }
    >
      <QrPrintContent />
    </Suspense>
  );
}
