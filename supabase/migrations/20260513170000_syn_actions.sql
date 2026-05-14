-- ─── SYN_ACTIONS ───────────────────────────────────────────────────────────
-- Audit log for every action the Syn pilot takes (or refuses to take).
-- Drives the admin activity feed (top-bar button) and the rollback feature.

create table if not exists synapsis.syn_actions (
    id                       uuid primary key default gen_random_uuid(),
    created_at               timestamptz not null default now(),
    deal_token               text references synapsis.deals(token) on delete cascade,
    action_type              text not null,    -- see SynActionType in lib/syn/audit.ts
    target_action            text,             -- e.g. 'confirmAssets'
    outcome                  text not null,    -- 'success'|'blocked'|'error'|'info'
    checklist_id             text,
    evidence                 jsonb not null default '{}'::jsonb,
    note                     text,
    initiated_by             text not null default 'syn_auto', -- 'syn_auto'|'admin_manual'|'system_event'
    acknowledged_by_admin    boolean not null default false,
    acknowledged_at          timestamptz,
    acknowledged_by_email    text
);

create index if not exists syn_actions_deal_token_idx
    on synapsis.syn_actions (deal_token, created_at desc);
create index if not exists syn_actions_unack_idx
    on synapsis.syn_actions (acknowledged_by_admin, created_at desc)
    where acknowledged_by_admin = false;
create index if not exists syn_actions_action_type_idx
    on synapsis.syn_actions (action_type, created_at desc);

comment on table synapsis.syn_actions is
  'Audit log of every Syn action — verifies, transition attempts, notifications, kill-switch toggles, rollbacks.';

-- Per-deal Syn kill-switch column on deals table.
-- Stored as JSONB so we can carry reason + timestamps + admin email.
alter table synapsis.deals
    add column if not exists syn_kill_switch jsonb;

comment on column synapsis.deals.syn_kill_switch is
  'When non-null with active=true, blocks Syn from firing any auto-action for this deal.';
