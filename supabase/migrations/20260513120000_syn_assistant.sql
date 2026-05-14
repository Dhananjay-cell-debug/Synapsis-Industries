-- ─── SYN ASSISTANT — DEEPSEEK INTEGRATION ─────────────────────────────────
-- Self-healing AI concierge for Synapsis Industries.
-- Tables: syn_sessions (chat threads), syn_messages (messages within threads),
--         raised_items (escalated doubts/issues), raised_responses (admin replies).
-- Storage bucket: syn-recordings for screen + voice uploads.

CREATE SCHEMA IF NOT EXISTS synapsis;

-- ─── SESSIONS — one row per chat thread (per client per panel-open) ────────
CREATE TABLE IF NOT EXISTS synapsis.syn_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_token  TEXT NOT NULL,
    actor       TEXT NOT NULL CHECK (actor IN ('client','admin')),
    phase       INT,
    title       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syn_sessions_deal_idx
    ON synapsis.syn_sessions(deal_token, updated_at DESC);

-- ─── MESSAGES — every user / assistant turn ────────────────────────────────
CREATE TABLE IF NOT EXISTS synapsis.syn_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES synapsis.syn_sessions(id) ON DELETE CASCADE,
    deal_token  TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content     TEXT NOT NULL,
    attachments JSONB,
    model       TEXT,
    tokens_in   INT,
    tokens_out  INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS syn_messages_session_idx
    ON synapsis.syn_messages(session_id, created_at);

-- ─── RAISED ITEMS — escalated doubts + formal issues ───────────────────────
CREATE TABLE IF NOT EXISTS synapsis.raised_items (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_token                  TEXT NOT NULL,
    kind                        TEXT NOT NULL CHECK (kind IN ('doubt','issue')),
    status                      TEXT NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','acknowledged','in_progress','resolved','rejected')),
    title                       TEXT,
    description                 TEXT NOT NULL,
    chat_session_id             UUID REFERENCES synapsis.syn_sessions(id) ON DELETE SET NULL,
    chat_context                JSONB,
    screen_recording_url        TEXT,
    voice_recording_url         TEXT,
    client_name                 TEXT,
    client_email                TEXT,
    company                     TEXT,
    phase                       INT,
    ai_summary                  TEXT,
    has_unread_admin_response   BOOLEAN NOT NULL DEFAULT false,
    has_unread_client_response  BOOLEAN NOT NULL DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at             TIMESTAMPTZ,
    resolved_at                 TIMESTAMPTZ,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raised_items_deal_idx
    ON synapsis.raised_items(deal_token, created_at DESC);
CREATE INDEX IF NOT EXISTS raised_items_status_idx
    ON synapsis.raised_items(status, kind);
CREATE INDEX IF NOT EXISTS raised_items_unread_client_idx
    ON synapsis.raised_items(deal_token) WHERE has_unread_admin_response = true;

-- ─── RAISED RESPONSES — append-only conversation under a raised_item ──────
CREATE TABLE IF NOT EXISTS synapsis.raised_responses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id      UUID NOT NULL REFERENCES synapsis.raised_items(id) ON DELETE CASCADE,
    from_role    TEXT NOT NULL CHECK (from_role IN ('admin','client','system')),
    actor_email  TEXT,
    body         TEXT NOT NULL,
    kind         TEXT NOT NULL CHECK (kind IN ('ack','progress','resolution','reply')),
    metadata     JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raised_responses_item_idx
    ON synapsis.raised_responses(item_id, created_at);

-- ─── Updated-at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION synapsis.touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_syn_sessions_updated ON synapsis.syn_sessions;
CREATE TRIGGER trg_syn_sessions_updated
    BEFORE UPDATE ON synapsis.syn_sessions
    FOR EACH ROW EXECUTE FUNCTION synapsis.touch_updated_at();

DROP TRIGGER IF EXISTS trg_raised_items_updated ON synapsis.raised_items;
CREATE TRIGGER trg_raised_items_updated
    BEFORE UPDATE ON synapsis.raised_items
    FOR EACH ROW EXECUTE FUNCTION synapsis.touch_updated_at();

-- ─── Storage bucket for recordings (screen + voice) ────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('syn-recordings', 'syn-recordings', false)
ON CONFLICT (id) DO NOTHING;
