---
trigger: always_on
---

# Padrões de Projeto: Among Us RP Presencial

## Stack Tecnológica
- Framework: Next.js 15 (App Router) + TypeScript
- Estilização: Tailwind CSS (Mobile-first, focado em PWA)
- Sincronização em Tempo Real: Supabase Realtime (Canais Broadcast para latência < 50ms)
- Banco de Dados: PostgreSQL com Row Level Security (RLS)

## Diretrizes de Código
- Escreva componentes limpos, modulares e reutilizáveis.
- Nunca exponha papéis secretos (Impostor) nas respostas públicas do WebSocket.
- Garanta que o layout mobile respeite a zona de toque dos polegares.