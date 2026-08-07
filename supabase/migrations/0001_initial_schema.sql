-- Migration: Initial Schema for Among Us RP Presencial
-- Architecture: Host & Guest model with Supabase Realtime & RLS

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE room_status_type AS ENUM ('lobby', 'in_game', 'discussion', 'ended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE player_role_type AS ENUM ('crewmate', 'impostor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabela de Salas (rooms)
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(6) NOT NULL UNIQUE,
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status room_status_type NOT NULL DEFAULT 'lobby',
    settings JSONB NOT NULL DEFAULT '{
        "emergency_cooldown": 15,
        "task_count": 3,
        "impostor_count": 1,
        "discussion_time": 30,
        "voting_time": 60,
        "confirm_ejects": true
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de Jogadores (players)
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname VARCHAR(32) NOT NULL,
    role player_role_type DEFAULT NULL,
    is_alive BOOLEAN NOT NULL DEFAULT true,
    is_host BOOLEAN NOT NULL DEFAULT false,
    color VARCHAR(16) NOT NULL DEFAULT '#E53E3E',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_per_room UNIQUE (room_id, user_id)
);

-- Index para otimização de consultas e Realtime
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(code);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON public.players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

-- 4. Função e Trigger de Atualização Automática do Timestamp updated_at
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

-- 5. Row Level Security (RLS) - Arquitetura Host & Guest

-- Habilitar RLS em ambas as tabelas
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DA TABELA ROOMS --
DROP POLICY IF EXISTS "Qualquer jogador autenticado pode visualizar salas" ON public.rooms;
CREATE POLICY "Qualquer jogador autenticado pode visualizar salas"
    ON public.rooms
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Usuário pode criar sala como Host" ON public.rooms;
CREATE POLICY "Usuário pode criar sala como Host"
    ON public.rooms
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = host_id);

DROP POLICY IF EXISTS "Apenas o Host pode atualizar a sala" ON public.rooms;
CREATE POLICY "Apenas o Host pode atualizar a sala"
    ON public.rooms
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = host_id)
    WITH CHECK ((select auth.uid()) = host_id);

DROP POLICY IF EXISTS "Apenas o Host pode excluir a sala" ON public.rooms;
CREATE POLICY "Apenas o Host pode excluir a sala"
    ON public.rooms
    FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = host_id);


-- POLÍTICAS DA TABELA PLAYERS --
DROP POLICY IF EXISTS "Jogadores podem visualizar participantes de suas salas" ON public.players;
CREATE POLICY "Jogadores podem visualizar participantes de suas salas"
    ON public.players
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Jogador pode entrar em uma sala" ON public.players;
CREATE POLICY "Jogador pode entrar em uma sala"
    ON public.players
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Jogador ou Host pode atualizar dados do participante" ON public.players;
CREATE POLICY "Jogador ou Host pode atualizar dados do participante"
    ON public.players
    FOR UPDATE
    TO authenticated
    USING (
        (select auth.uid()) = user_id 
        OR 
        EXISTS (
            SELECT 1 FROM public.rooms 
            WHERE rooms.id = players.room_id 
            AND rooms.host_id = (select auth.uid())
        )
    )
    WITH CHECK (
        (select auth.uid()) = user_id 
        OR 
        EXISTS (
            SELECT 1 FROM public.rooms 
            WHERE rooms.id = players.room_id 
            AND rooms.host_id = (select auth.uid())
        )
    );

DROP POLICY IF EXISTS "Jogador pode sair ou Host pode remover jogador" ON public.players;
CREATE POLICY "Jogador pode sair ou Host pode remover jogador"
    ON public.players
    FOR DELETE
    TO authenticated
    USING (
        (select auth.uid()) = user_id 
        OR 
        EXISTS (
            SELECT 1 FROM public.rooms 
            WHERE rooms.id = players.room_id 
            AND rooms.host_id = (select auth.uid())
        )
    );

-- 6. Segurança e Privacidade do Papel Secreto (Role)
CREATE OR REPLACE FUNCTION public.get_my_role(p_room_id UUID)
RETURNS player_role_type
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role player_role_type;
BEGIN
    SELECT role INTO v_role
    FROM public.players
    WHERE room_id = p_room_id AND user_id = (select auth.uid());
    
    RETURN v_role;
END;
$$;

-- 7. Supabase Realtime Publication
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
