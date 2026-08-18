'use client';

import React from 'react';
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
  LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

interface QrCardDefinition {
  token: string;
  title: string;
  category: 'REPORT' | 'EMERGENCY' | 'SABOTAGE' | 'TASK';
  description: string;
  icon: LucideIcon;
  badge: string;
}

const TACTICAL_CARDS: QrCardDefinition[] = [
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
    title: 'BOTÃO DE EMERGÊNCIA',
    category: 'EMERGENCY',
    description: 'Aponte o scanner para abrir o painel de Reunião de Emergência da nave.',
    icon: Megaphone,
    badge: 'MESA TÁTICA',
  },
  {
    token: 'TASK_BREAKER',
    title: 'DISJUNTOR E FIAÇÃO ELÉTRICA',
    category: 'SABOTAGE',
    description: 'Aponte o scanner para religar as luzes e reparar os disjuntores da nave.',
    icon: Radio,
    badge: 'DISJUNTOR / LUZES',
  },
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
    badge: 'TAREFA ADMINISTRATIVA',
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
    badge: 'TAREFA DE SEGURANÇA',
  },
  {
    token: 'TASK_REACTOR',
    title: 'INICIAR REATOR (SIMON SAYS)',
    category: 'TASK',
    description: 'Memorize e repita a sequência de luzes do reator principal.',
    icon: Flame,
    badge: 'TAREFA REATOR',
  },
  {
    token: 'TASK_ASTEROIDS',
    title: 'DESTRUIR ASTEROIDES',
    category: 'TASK',
    description: 'Utilize os canhões laser para destruir 20 asteroides no setor.',
    icon: Radio,
    badge: 'TAREFA DE ARMAS',
  },
  {
    token: 'TASK_GARBAGE',
    title: 'ESVAZIAR LIXO DA NAVE',
    category: 'TASK',
    description: 'Puxe e segure a alavanca do triturador para esvaziar os resíduos.',
    icon: Trash2,
    badge: 'TAREFA NAVEGAÇÃO',
  },
  {
    token: 'TASK_CLEAN_O2',
    title: 'LIMPAR FILTRO DE OXIGÊNIO',
    category: 'TASK',
    description: 'Remova as folhas e detritos acumulados no duto de ventilação.',
    icon: Wind,
    badge: 'TAREFA SUPORTE',
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
    title: 'ABASTECER MOTOR COM COMBUSTÍVEL',
    category: 'TASK',
    description: 'Mantenha pressionado o botão de vazão até encher o galão do motor.',
    icon: Fuel,
    badge: 'TAREFA MOTOR',
  },
];

export default function QrPrintPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 antialiased font-sans">
      {/* Controles do Host - Escondidos ao Imprimir */}
      <div className="max-w-5xl mx-auto mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl print:hidden">
        <div>
          <Link
            href="/admin"
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Painel do Host
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            <span>Kit de QR Codes Táticos Permanentes (14 Cartões)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Imprima este kit completo contendo QR Codes específicos para cada minigame da nave e 1 cartão especial para Report de Corpo.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <div className="bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800 text-xs font-mono font-bold text-cyan-300">
            TOTAL: {TACTICAL_CARDS.length} CARTÕES
          </div>

          <button
            onClick={handlePrint}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Kit (Folha A4)</span>
          </button>
        </div>
      </div>

      {/* Dica do Host (Tela) */}
      <div className="max-w-5xl mx-auto mb-6 p-4 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl text-xs text-cyan-300 flex items-center gap-3 print:hidden">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
        <span>
          <strong>Dica do Arquiteto:</strong> Os QR Codes são gerados em texto puro em SVG vetorial nativo com correção de erro nível <strong>H (High)</strong>. Eles abrem os minigames interativos ou disparam o alerta de report imediatamente no leitor in-app do jogo.
        </span>
      </div>

      {/* Grid de Impressão de Cartões Táticos */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:p-0 print:max-w-none">
        {TACTICAL_CARDS.map((card) => {
          const IconComp = card.icon;
          const isReport = card.category === 'REPORT';
          const isEmergency = card.category === 'EMERGENCY';
          const isSabotage = card.category === 'SABOTAGE';

          return (
            <div
              key={card.token}
              className={`flex flex-col items-center justify-between border-2 p-6 rounded-3xl text-center aspect-[4/3] break-inside-avoid shadow-xl print:border-2 print:border-black print:text-black print:bg-white print:rounded-none print:shadow-none print:aspect-auto ${
                isReport
                  ? 'border-red-500/60 bg-red-950/40'
                  : isEmergency
                  ? 'border-amber-500/60 bg-amber-950/40'
                  : isSabotage
                  ? 'border-purple-500/60 bg-purple-950/40'
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
                      ? 'text-purple-400'
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
                      ? 'bg-purple-950 text-purple-300 border-purple-800'
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

