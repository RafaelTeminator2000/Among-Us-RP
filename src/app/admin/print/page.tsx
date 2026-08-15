'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, ArrowLeft, Grid, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface QrCard {
  token: string;
  label: string;
}

export default function QrPrintPage() {
  const [quantity, setQuantity] = useState<number>(12); // Padrão de 12 pontos físicos permanentes
  const [origin, setOrigin] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Geramos tokens genéricos e permanentes (POINT_01, POINT_02, etc.)
  const qrCards: QrCard[] = Array.from({ length: Math.max(1, Math.min(60, quantity)) }, (_, i) => {
    const num = String(i + 1).padStart(2, '0');
    return {
      token: `POINT_${num}`,
      label: `PONTO DE TAREFA FÍSICA ${num}`,
    };
  });

  const handlePrint = () => {
    window.print();
  };

  const currentOrigin = origin || 'https://amongus-rp.app';

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
            <span>Kit de QR Codes Permanentes</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Imprima estes cartões táticos uma única vez e plastifique/cole nas paredes físicas do local (igreja, escola ou escritório).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-2xl border border-slate-800 text-xs">
            <label className="text-slate-400 font-semibold">Quantidade de Pontos:</label>
            <input
              type="number"
              min={4}
              max={40}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-14 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-center font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
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
          <strong>Dica do Arquiteto:</strong> Os QR Codes são gerados em SVG vetorial nativo com correção de erro nível <strong>H (High)</strong>, garantindo leitura instantânea na câmera mesmo se o papel for levemente dobrado ou plastificado.
        </span>
      </div>

      {/* Grid de Impressão de Cartões Táticos */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:p-0 print:max-w-none">
        {qrCards.map((card) => (
          <div
            key={card.token}
            className="flex flex-col items-center justify-between border-2 border-dashed border-slate-700 bg-slate-900/60 p-6 rounded-3xl text-center aspect-[4/3] break-inside-avoid shadow-xl print:border-2 print:border-black print:text-black print:bg-white print:rounded-none print:shadow-none print:aspect-auto"
          >
            {/* Header do Card */}
            <div className="w-full flex items-center justify-between border-b border-slate-800 pb-2.5 print:border-black">
              <span className="text-[11px] font-black tracking-widest text-cyan-400 uppercase print:text-black flex items-center gap-1.5">
                <Grid className="w-3.5 h-3.5 text-cyan-400 print:text-black" />
                AMONG US RP • PHYGITAL
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-tight print:text-black font-bold uppercase">
                KIT PERMANENTE
              </span>
            </div>

            {/* QR Code Container em SVG Puro */}
            <div className="my-3 p-3.5 bg-white rounded-2xl border border-slate-800 print:border-none print:p-1">
              <QRCodeSVG
                value={`${currentOrigin}/task/${card.token}`}
                size={140}
                level="H" // Correção alta de erros para iluminação física instável
                includeMargin={false}
              />
            </div>

            {/* Footer do Card com Token Genérico */}
            <div className="w-full space-y-2">
              <div className="text-xl font-black tracking-widest font-mono bg-slate-950 text-cyan-300 py-1.5 px-3 rounded-xl border border-slate-800 print:bg-transparent print:text-black print:border-2 print:border-black">
                {card.token}
              </div>
              <p className="text-[10px] text-slate-400 tracking-tight leading-tight print:text-black print:font-semibold">
                Aponte a câmera do seu celular para iniciar a tarefa tática deste local.
              </p>
            </div>
          </div>
        ))}
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
