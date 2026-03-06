-- ══════════════════════════════════════════
--  BINGÃO DO TK — Supabase Schema
--  Execute no SQL Editor do Supabase
-- ══════════════════════════════════════════

-- Salas de bingo
CREATE TABLE IF NOT EXISTS rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  phase       TEXT NOT NULL DEFAULT 'waiting',   -- waiting | running | paused | ended
  called_numbers  INT[] NOT NULL DEFAULT '{}',
  current_number  INT,
  current_letter  TEXT,
  win_pattern TEXT NOT NULL DEFAULT 'line',       -- line | full | diagonal
  auto_speed  INT NOT NULL DEFAULT 5,
  voice_lang  TEXT NOT NULL DEFAULT 'pt-BR',
  voice_rate  NUMERIC NOT NULL DEFAULT 0.9,
  call_style  TEXT NOT NULL DEFAULT 'tradicional',
  winner_player_id UUID,
  winner_card_idx  INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jogadores
CREATE TABLE IF NOT EXISTS players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Jogador',
  cards       JSONB NOT NULL DEFAULT '[]',  -- array de cartelas
  is_host     BOOLEAN NOT NULL DEFAULT false,
  has_bingo   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eventos em tempo real (bingo claims, etc.)
CREATE TABLE IF NOT EXISTS room_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- 'bingo_claim' | 'bingo_confirmed' | 'bingo_rejected' | 'game_started' | 'game_ended'
  player_id   UUID REFERENCES players(id),
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_events_room ON room_events(room_id);

-- ── Enable Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE room_events;

-- ── Row Level Security ──
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_events ENABLE ROW LEVEL SECURITY;

-- Policies: acesso público (app sem auth obrigatória)
CREATE POLICY "rooms_all" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "players_all" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "events_all" ON room_events FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
