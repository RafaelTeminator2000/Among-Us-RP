'use client';

import { useRef, useCallback } from 'react';

export function useGameAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<{ osc: OscillatorNode; gainNode: GainNode }[]>([]);

  // Inicializa ou retoma o AudioContext respeitando restrições de autoplay do navegador
  const initAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;

    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch((err) => {
        console.warn('[useGameAudio] Erro ao retomar AudioContext:', err);
      });
    }

    return audioCtxRef.current;
  }, []);

  // Parar todos os osciladores ativos
  const stopAll = useCallback(() => {
    activeNodesRef.current.forEach(({ osc, gainNode }) => {
      try {
        osc.stop();
        osc.disconnect();
        gainNode.disconnect();
      } catch (e) {
        // Ignora erros de nós já finalizados
      }
    });
    activeNodesRef.current = [];
  }, []);

  // Sirene contínua de sabotagem (pitch modulado 440Hz -> 880Hz -> 440Hz)
  const playSiren = useCallback(() => {
    stopAll();
    const ctx = initAudio();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';

    const now = ctx.currentTime;
    // Modulação de frequência contínua em loop
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(880, now + 1);
    osc.frequency.linearRampToValueAtTime(440, now + 2);

    // Ajustar ganho suave para volume confortável
    gainNode.gain.setValueAtTime(0.08, now);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    activeNodesRef.current.push({ osc, gainNode });
  }, [initAudio, stopAll]);

  // Alarme grave e agressivo para convocação de Reunião de Emergência (150Hz)
  const playEmergencyBuzzer = useCallback(() => {
    stopAll();
    const ctx = initAudio();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(150, now);

    // Envelope de volume pulsante de emergência
    gainNode.gain.setValueAtTime(0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(now + 1.6);
    activeNodesRef.current.push({ osc, gainNode });
  }, [initAudio, stopAll]);

  // Som sutil de confirmação de tarefa concluída (bip sintetizado)
  const playTaskBeep = useCallback(() => {
    const ctx = initAudio();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.08); // A5

    gainNode.gain.setValueAtTime(0.05, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(now + 0.26);
  }, [initAudio]);

  return { initAudio, playSiren, playEmergencyBuzzer, playTaskBeep, stopAll };
}
