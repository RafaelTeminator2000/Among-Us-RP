---
name: supabase-realtime-orchestrator
description: Configura canais, broadcasts e presences em tempo real no Supabase. Otimiza o envio de eventos síncronos para reuniões de emergência, sabotagens e abates.
---

# Supabase Realtime Orchestrator

Sempre que implementar conexões em tempo real ou triggers para o jogo, siga estas regras rígidas de implementação do Supabase Realtime:

## Regras de Implementação
1. **Broadcast para Eventos Rápidos**: Utilize `broadcast` para disparos síncronos de transição de fase (ex: sabotagem ativa, reunião de emergência convocada, corpo reportado).
2. **Presence para Lobbies**: Use `presence` estritamente para rastrear quem está online na sala física e renderizar os indicadores visuais de "conectado".
3. **Padrão de Nome de Tópicos**: Utilize sempre a convenção `scope:entity` (ex: `room:123:game_flow` ou `room:123:roles`).
4. **Segurança de Canal**: Defina `private: true` para canais que transmitem dados sensíveis dos jogadores utilizando RLS.
5. **Clean-Up**: Sempre implemente lógica de `unsubscribe` e remoção de listeners em hooks de desmontagem do React (useEffect) para evitar vazamento de memória e conexões WebSocket fantasmas no dispositivo do jogador.