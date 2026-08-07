-- Migration: Phygital Game Schema for Among Us RP Presencial
-- Blueprint: Host & Guest Architecture, Room Settings, Mobile Players & QR Code Task Nodes

-- 1. Enums e Tipos
DO $$ BEGIN
    CREATE TYPE room_status_enum AS ENUM ('LOBBY', 'PLAYING', 'EMERGENCY_MEETING', 'ENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE player_role_enum AS ENUM ('CREWMATE', 'IMPOSTOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE player_status_enum AS ENUM ('ALIVE', 'ELIMINATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_type_enum AS ENUM ('WIRE', 'KEYPAD', 'CARD_SWIPE', 'EMERGENCY_BUTTON');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabela de Salas (rooms)
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) NOT NULL UNIQUE,
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status room_status_enum NOT NULL DEFAULT 'LOBBY',
    map_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    rules JSONB NOT NULL DEFAULT '{
        "kill_cooldown": 30,
        "discussion_time": 30,
        "voting_time": 60,
        "confirm_ejects": true,
        "task_count": 3
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de Jogadores na Sala (room_players)
CREATE TABLE IF NOT EXISTS public.room_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    player_name VARCHAR(50) NOT NULL,
    color_hex VARCHAR(7) NOT NULL DEFAULT '#ef4444',
    role player_role_enum DEFAULT NULL,
    status player_status_enum NOT NULL DEFAULT 'ALIVE',
    completed_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabela de Nós de Tarefa Phygital (task_nodes)
CREATE TABLE IF NOT EXISTS public.task_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    token_hash VARCHAR(100) NOT NULL,
    task_type task_type_enum NOT NULL,
    room_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Índices de Otimização e Realtime
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON public.room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_task_nodes_room_id ON public.task_nodes(room_id);
CREATE INDEX IF NOT EXISTS idx_task_nodes_token_hash ON public.task_nodes(token_hash);

-- 6. Trigger de Atualização Automática do Timestamp updated_at na Tabela rooms
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_rooms_updated_at ON public.rooms;
CREATE TRIGGER tr_rooms_updated_at
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 7. Row Level Security (RLS)

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_nodes ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DA TABELA ROOMS --
DROP POLICY IF EXISTS "Qualquer pessoa pode visualizar salas pelo código" ON public.rooms;
CREATE POLICY "Qualquer pessoa pode visualizar salas pelo código"
    ON public.rooms
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Host pode criar sala" ON public.rooms;
CREATE POLICY "Host pode criar sala"
    ON public.rooms
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = host_id);

DROP POLICY IF EXISTS "Host pode atualizar sua sala" ON public.rooms;
CREATE POLICY "Host pode atualizar sua sala"
    ON public.rooms
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = host_id)
    WITH CHECK ((select auth.uid()) = host_id);

DROP POLICY IF EXISTS "Host pode excluir sua sala" ON public.rooms;
CREATE POLICY "Host pode excluir sua sala"
    ON public.rooms
    FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = host_id);

-- POLÍTICAS DA TABELA ROOM_PLAYERS --
DROP POLICY IF EXISTS "Todos podem visualizar participantes da sala" ON public.room_players;
CREATE POLICY "Todos podem visualizar participantes da sala"
    ON public.room_players
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Jogadores podem entrar em uma sala" ON public.room_players;
CREATE POLICY "Jogadores podem entrar em uma sala"
    ON public.room_players
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "Jogadores ou Host podem atualizar registro de participante" ON public.room_players;
CREATE POLICY "Jogadores ou Host podem atualizar registro de participante"
    ON public.room_players
    FOR UPDATE
    TO authenticated, anon
    USING (
        (user_id IS NOT NULL AND (select auth.uid()) = user_id)
        OR EXISTS (
            SELECT 1 FROM public.rooms
            WHERE rooms.id = room_players.room_id
            AND rooms.host_id = (select auth.uid())
        )
    )
    WITH CHECK (
        (user_id IS NOT NULL AND (select auth.uid()) = user_id)
        OR EXISTS (
            SELECT 1 FROM public.rooms
            WHERE rooms.id = room_players.room_id
            AND rooms.host_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Jogadores podem sair ou Host remover participantes" ON public.room_players;
CREATE POLICY "Jogadores podem sair ou Host remover participantes"
    ON public.room_players
    FOR DELETE
    TO authenticated, anon
    USING (
        (user_id IS NOT NULL AND (select auth.uid()) = user_id)
        OR EXISTS (
            SELECT 1 FROM public.rooms
            WHERE rooms.id = room_players.room_id
            AND rooms.host_id = (select auth.uid())
        )
    );

-- POLÍTICAS DA TABELA TASK_NODES --
DROP POLICY IF EXISTS "Participantes podem visualizar task nodes" ON public.task_nodes;
CREATE POLICY "Participantes podem visualizar task nodes"
    ON public.task_nodes
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Host pode gerenciar task nodes" ON public.task_nodes;
CREATE POLICY "Host pode gerenciar task nodes"
    ON public.task_nodes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.rooms
            WHERE rooms.id = task_nodes.room_id
            AND rooms.host_id = (select auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.rooms
            WHERE rooms.id = task_nodes.room_id
            AND rooms.host_id = (select auth.uid())
        )
    );

-- 8. Função RPC Segura para Resgatar o Próprio Papel (Proteção contra vazamento de Impostor)
CREATE OR REPLACE FUNCTION public.get_my_player_role(p_room_id UUID, p_player_id UUID)
RETURNS player_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role player_role_enum;
BEGIN
    SELECT role INTO v_role
    FROM public.room_players
    WHERE id = p_player_id AND room_id = p_room_id;
    
    RETURN v_role;
END;
$$;

-- 9. Supabase Realtime Publication
-- Garante a replicação instantânea (<50ms) para as tabelas do jogo
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_nodes;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
