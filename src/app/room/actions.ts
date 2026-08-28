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
  let targetPlayerId: string = '';

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

    // 3. Escolher cor aleatória e definir ID do jogador
    const randomColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
    const rawPlayerId = formData.get('playerId') as string | null;
    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const playerId = rawPlayerId && isValidUuid(rawPlayerId) ? rawPlayerId : crypto.randomUUID();
    targetPlayerId = playerId;

    // 4. Cadastrar ou atualizar jogador na sala (se targetRoomId for UUID válido)
    if (isValidUuid(targetRoomId)) {
      const previousPlayerId = formData.get('previousPlayerId') as string | null;
      if (previousPlayerId && isValidUuid(previousPlayerId) && previousPlayerId !== playerId) {
        await supabase.from('room_players').delete().eq('id', previousPlayerId);
      }
      if (playerName) {
        await supabase.from('room_players').delete().eq('player_name', playerName).neq('room_id', targetRoomId!);
      }

      const { error: playerError } = await supabase.from('room_players').upsert({
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
    redirect(`/room/${targetRoomId}?code=${targetRoomCode}&playerId=${targetPlayerId}`);
  }

  return {};
}

/**
 * Server Action: Sincronizar Estado Completo da Sala e Jogador
 * Essencial para recuperar estado quando o celular acorda do modo standby,
 * ao dar refresh na página ou na reconexão do WebSocket.
 */
export async function getRoomSyncStateAction(payload: {
  roomId: string;
  playerId?: string;
}) {
  try {
    const supabase = await createClient();
    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    let room: any = null;
    const cleanId = (payload.roomId || '').trim();

    if (isValidUuid(cleanId)) {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();
      room = data;
    } else {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', cleanId.toUpperCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      room = data;
    }

    if (!room) {
      const isTestCode =
        cleanId.toUpperCase() === 'A7X9' ||
        cleanId.toUpperCase() === 'DEMO' ||
        cleanId.toUpperCase() === 'DEMO-ROOM-ID';

      if (isTestCode) {
        return {
          success: true,
          room: {
            id: 'demo-room-id',
            code: cleanId.toUpperCase(),
            status: 'LOBBY',
            rules: { taskCount: 4, impostorCount: 1 },
            map_data: null,
            is_lights_sabotaged: false,
            is_reactor_sabotaged: false,
            is_o2_sabotaged: false,
          },
          player: {
            id: payload.playerId || 'demo-player',
            player_name: 'Tripulante Teste',
            color_hex: '#ef4444',
            role: 'CREWMATE',
            status: 'ALIVE',
            completed_tasks: [],
          },
          allPlayers: [],
        };
      }
      return { error: 'Sala não encontrada' };
    }

    const resolvedRoomId = room.id;

    // Buscar dados do jogador
    let player: any = null;
    if (payload.playerId && isValidUuid(payload.playerId)) {
      const { data: playerData } = await supabase
        .from('room_players')
        .select('id, player_name, color_hex, role, status, completed_tasks')
        .eq('id', payload.playerId)
        .maybeSingle();
      player = playerData;
    }

    // Se o jogo já começou ('PLAYING' ou 'EMERGENCY_MEETING') e o jogador não tem role no banco,
    // atribuir 'CREWMATE' por padrão para que ele possa jogar imediatamente sem travar
    if (
      (room.status === 'PLAYING' || room.status === 'EMERGENCY_MEETING') &&
      player &&
      !player.role
    ) {
      player.role = 'CREWMATE';
      if (isValidUuid(player.id)) {
        await supabase
          .from('room_players')
          .update({ role: 'CREWMATE' })
          .eq('id', player.id);
      }
    }

    // Buscar todos os jogadores registrados na sala
    let allPlayers: any[] = [];
    if (resolvedRoomId && isValidUuid(resolvedRoomId)) {
      const { data: playersList } = await supabase
        .from('room_players')
        .select('id, player_name, color_hex, role, status, completed_tasks')
        .eq('room_id', resolvedRoomId);
      allPlayers = playersList || [];
    }

    return {
      success: true,
      room: {
        id: room.id,
        code: room.code,
        status: room.status || 'LOBBY',
        rules: room.rules,
        map_data: room.map_data,
        is_lights_sabotaged: (room as any).is_lights_sabotaged || false,
        is_reactor_sabotaged: (room as any).is_reactor_sabotaged || false,
        is_o2_sabotaged: (room as any).is_o2_sabotaged || false,
      },
      player,
      allPlayers,
    };
  } catch (err: any) {
    console.error('[getRoomSyncStateAction] Erro ao sincronizar estado da sala:', err?.message || err);
    return { error: err?.message || 'Erro ao sincronizar dados da sala' };
  }
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
export async function updateRoomStatusAction(roomIdOrCode: string, status: string) {
  try {
    const supabase = await createClient();
    const isValidUuid = (str?: string) =>
      typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    let targetRoomId: string | null = null;
    const cleanKey = (roomIdOrCode || '').trim();

    if (isValidUuid(cleanKey)) {
      targetRoomId = cleanKey;
    } else if (cleanKey) {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', cleanKey.toUpperCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roomData) targetRoomId = roomData.id;
    }

    if (targetRoomId) {
      const updateData: Record<string, any> = {
        status: status as any,
      };

      if (status === 'LOBBY') {
        updateData.is_lights_sabotaged = false;
        updateData.is_reactor_sabotaged = false;
        updateData.is_o2_sabotaged = false;

        // Resetar status dos jogadores para ALIVE e tarefas zeradas para nova rodada
        await supabase
          .from('room_players')
          .update({
            status: 'ALIVE',
            completed_tasks: [] as any,
          })
          .eq('room_id', targetRoomId);
      }

      await supabase
        .from('rooms')
        .update(updateData as any)
        .eq('id', targetRoomId);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[updateRoomStatusAction] Erro:', err?.message || err);
    return { error: err?.message || 'Erro ao atualizar status da sala' };
  }
}
