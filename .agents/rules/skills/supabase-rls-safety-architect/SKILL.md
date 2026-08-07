---
trigger: always_on
---

---
name: supabase-rls-safety-architect
description: Desenha schemas de banco de dados e aplica Row Level Security (RLS) de alta performance para evitar trapaças e vazamento de papéis secretos (Roles).
---

# Supabase RLS Safety Architect

Quando o usuário solicitar modificações no banco de dados ou novas tabelas de estados, execute as diretrizes abaixo:

## Princípios de Arquitetura de Segurança
1. **Isolamento de Estado (Anti-Cheat)**: O papel secreto (Role) de cada jogador NUNCA deve ser transmitido globalmente. O select de consulta do papel deve ser protegido via RLS.
2. **Performance de RLS**: Nunca faça junções complexas (joins) diretamente na cláusula `USING` das políticas se puder evitar. Use sub-selects simples com caching, ex:
   `auth.uid() = (SELECT user_id FROM players WHERE ...)` para forçar o PostgreSQL a avaliar a query de autenticação apenas uma vez.
3. **Escrita Restrita**: Apenas o host/admin (ou triggers de banco baseadas em eventos validados) pode alterar o estado geral do jogo (`game_state`). Os tripulantes/guests possuem privilégios exclusivos de leitura e progresso individual de suas tarefas.

## Estrutura Recomendada para tabelas de Lobby:
- `rooms` (id: uuid, code: text, status: text, config: jsonb)
- `players` (id: uuid, room_id: uuid, role_secret: text, status: text, user_id: uuid)