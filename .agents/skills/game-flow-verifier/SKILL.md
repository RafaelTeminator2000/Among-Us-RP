---
name: game-flow-verifier
description: Executa simulações no terminal para validar se as transições de estado do Jogo Cidade Dorme (Lobby -> Noite -> Discussão -> Votação) estão livres de concorrência ou deadlocks.
---

# Game Flow Verifier

Esta Skill utiliza scripts em Python locais para validar concorrência no fluxo do jogo.

## Instruções
1. **Executar o Validador de Concorrência**: Chame o script contido em `scripts/simulate_lobby.py` utilizando o terminal integrado do Antigravity.
2. **Garantir a FSM**: Garanta que as condições de vitória (Win Conditions) sejam computadas imediatamente após o abate ou ejetamento de um jogador.