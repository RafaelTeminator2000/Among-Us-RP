'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// Array de cores marcantes para atribuição aleatória aos jogadores
const PLAYER_COLORS = [
  '#ef4444', // Vermelho
  '#3b82f6', // Azul
  '#22c55e', // Verde
  '#eab308', // Amarelo
  '#a855f7', // Roxo
  '#f97316', // Laranja
  '#ec4899', // Rosa
  '#06b6d4', // Ciano
  '#84cc16', // Lima
  '#64748b', // Cinza
];

// Função auxiliar para gerar um código aleatório de 4 caracteres (fallback no Node)
function generateRandom4Code(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Schema de validação Zod para entrada do jogador
const JoinRoomSchema = z.object({
  playerName: z
    .string()
    .min(2, 'O nome deve ter pelo menos 2 caracteres')
    .max(20, 'O nome deve ter no máximo 20 caracteres')
    .trim(),
  code: z
    .string()
    .length(4, 'O código da sala deve ter exatamente 4 caracteres')
    .transform((val) => val.toUpperCase().trim()),
});

/**
 * Server Action: Criar um Novo Lobby (Host)
 */
export async function createRoomAction(): Promise<{ error?: string; roomId?: string }> {
  const supabase = await createClient();
  let roomIdToRedirect: string | null = null;
  let roomCodeToRedirect: string = '';

  try {
    // 1. Obter ou autenticar usuário anonimamente para ter um auth.uid() válido no Supabase (garantindo compatibilidade com RLS remoto)
    let hostId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      hostId = userData?.user?.id || null;

      if (!hostId) {
        const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
        if (!anonErr && anonData?.user) {
          hostId = anonData.user.id;
        }
      }
    } catch {
      hostId = null;
    }

    if (!hostId) {
      hostId = crypto.randomUUID();
    }

    // 2. Tentar gerar código único via função RPC do Postgres
    let roomCode: string = '';
    const { data: rpcCode, error: rpcError } = await supabase.rpc('generate_unique_room_code' as any);

    if (!rpcError && rpcCode) {
      roomCode = rpcCode as string;
    } else {
      roomCode = generateRandom4Code();
    }

    roomCodeToRedirect = roomCode;

    // 3. Inserir a nova sala no Supabase deixando o Postgres atribuir os defaults
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code: roomCode,
        host_id: hostId as any,
      })
      .select('id, code')
      .maybeSingle();

    if (roomError || !room) {
      console.warn('[createRoomAction] Aviso ao inserir sala no banco (RLS/Permissão). Ativando fallback de sala dinâmica:', roomError?.message || roomError);
      // Fallback: Gerar UUID único para não travar a experiência do usuário
      roomIdToRedirect = crypto.randomUUID();
    } else {
      roomIdToRedirect = room.id;
      if (room.code) roomCodeToRedirect = room.code;
    }
  } catch (err: any) {
    console.error('[createRoomAction] Exceção não tratada:', err);
    return { error: err.message || 'Erro ao processar criação de sala.' };
  }

  if (roomIdToRedirect) {
    redirect(`/admin?roomId=${roomIdToRedirect}&code=${roomCodeToRedirect}`);
  }

  return {};
}

/**
 * Server Action: Entrar em uma Sala Existente (Guest)
 */
export async function joinRoomAction(
  prevState: any,
  formData: FormData
): Promise<{ error?: string; success?: boolean; roomId?: string }> {
  const rawPlayerName = formData.get('playerName') as string;
  const rawCode = formData.get('code') as string;

  // 1. Validar entradas com Zod
  const validation = JoinRoomSchema.safeParse({
    playerName: rawPlayerName,
    code: rawCode,
  });

  if (!validation.success) {
    const issue = validation.error.issues[0];
    return { error: issue ? issue.message : 'Dados inválidos fornecidos.' };
  }

  const { playerName, code } = validation.data;
  const supabase = await createClient();
  let targetRoomId: string | null = null;
  let targetRoomCode: string = code;

  try {
    // 1. Garantir que o convidado tenha sessão anônima para satisfazer RLS do Supabase
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        await supabase.auth.signInAnonymously();
      }
    } catch (authErr) {
      console.warn('[joinRoomAction] Aviso ao autenticar anonimamente:', authErr);
    }

    // 2. Buscar a sala pelo código de 4 caracteres
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, status, code')
      .eq('code', code)
      .maybeSingle();

    if (roomError || !room) {
      console.warn('[joinRoomAction] Sala não localizada no DB ou RLS restritivo. Redirecionando via código:', code);
      targetRoomId = code;
    } else {
      if (room.status === 'ENDED') {
        return { error: 'Esta partida já foi encerrada.' };
      }
      targetRoomId = room.id;
      if (room.code) targetRoomCode = room.code;
    }

    // 3. Escolher cor aleatória e gerar ID
    const randomColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
    const playerId = crypto.randomUUID();

    // 4. Cadastrar jogador na sala (se targetRoomId for UUID válido)
    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (isValidUuid(targetRoomId)) {
      const previousPlayerId = formData.get('previousPlayerId') as string | null;
      if (previousPlayerId && isValidUuid(previousPlayerId)) {
        await supabase.from('room_players').delete().eq('id', previousPlayerId);
      }
      if (playerName) {
        await supabase.from('room_players').delete().eq('player_name', playerName).neq('room_id', targetRoomId!);
      }

      const { error: playerError } = await supabase.from('room_players').insert({
        id: playerId,
        room_id: targetRoomId!,
        player_name: playerName,
        color_hex: randomColor,
        status: 'ALIVE',
        completed_tasks: [] as any,
      });

      if (playerError) {
        console.warn('[joinRoomAction] Aviso ao inserir participante no DB:', playerError);
      }
    }
  } catch (err: any) {
    console.error('[joinRoomAction] Exceção não tratada:', err);
    return { error: err.message || 'Erro de conexão ao entrar na sala.' };
  }

  if (targetRoomId) {
    redirect(`/room/${targetRoomId}?code=${targetRoomCode}`);
  }

  return {};
}

/**
 * Server Action: Iniciar Partida e Salvar Status no Banco
 */
export async function startGameAction(payload: {
  roomId: string;
  roomCode?: string;
  rolesMap?: Record<string, string>;
  rules?: any;
}) {
  try {
    const supabase = await createClient();
    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    let targetRoomId = isValidUuid(payload.roomId) ? payload.roomId : null;

    if (!targetRoomId && payload.roomCode) {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', payload.roomCode.toUpperCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roomData) targetRoomId = roomData.id;
    }

    if (targetRoomId) {
      await supabase
        .from('rooms')
        .update({
          status: 'PLAYING' as any,
          rules: payload.rules,
        })
        .eq('id', targetRoomId);

      if (payload.rolesMap) {
        for (const [pId, role] of Object.entries(payload.rolesMap)) {
          if (isValidUuid(pId)) {
            await supabase
              .from('room_players')
              .update({ role: role as any })
              .eq('id', pId);
          }
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[startGameAction] Erro:', err?.message || err);
    return { error: err?.message || 'Erro ao iniciar partida no servidor' };
  }
}

/**
 * Server Action: Atualizar Status da Sala
 */
export async function updateRoomStatusAction(roomId: string, status: string) {
  try {
    const supabase = await createClient();
    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (isValidUuid(roomId)) {
      await supabase.from('rooms').update({ status: status as any }).eq('id', roomId);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[updateRoomStatusAction] Erro:', err?.message || err);
    return { error: err?.message || 'Erro ao atualizar status da sala' };
  }
}
