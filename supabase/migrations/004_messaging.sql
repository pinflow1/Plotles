-- =====================================================================
-- WhatsApp Business Clerk — Phase 8: messaging
-- Run after 001, 002 and 003.
--
-- What this adds
--   inbound_messages   every message we receive, once. (channel, message id) is unique, so
--                      Meta sending the same message again can never record a sale twice.
--   pending_questions  the one question we are waiting for a person to answer
--                      ("Did you mean White Paper?"). One per person, expires.
--   outbound_messages  every reply we tried to send and whether it really went. Append-only,
--                      so we never claim a message was sent when it was not.
--   Small functions the server calls (service role only). Same contract as 002:
--   they return jsonb, { "ok": true, ... } or { "ok": false, "error": { ... } }.
-- =====================================================================

begin;

-- ---------- tables ---------------------------------------------------
create table inbound_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'chat')),
  provider_message_id text not null check (length(provider_message_id) between 1 and 200),
  sender text not null check (length(sender) between 1 and 40),   -- WhatsApp: the number, digits only
  user_id uuid references users(id),                              -- null = we did not know the sender
  body text,                                                      -- null = not a text message
  status text not null default 'processing' check (status in ('processing', 'done', 'failed')),
  outcome text,                                                   -- recorded, asked, answered, ...
  interpretation jsonb,                                           -- what the model said, for debugging
  reply text,
  error text,
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (channel, provider_message_id)
);
create index inbound_received_idx on inbound_messages (received_at desc);
create index inbound_user_received_idx on inbound_messages (user_id, received_at desc);

create table pending_questions (
  user_id uuid primary key references users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table outbound_messages (
  id bigint generated always as identity primary key,
  channel text not null check (length(channel) between 1 and 40),
  recipient text not null,
  user_id uuid references users(id),
  inbound_id uuid references inbound_messages(id),
  body text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create index outbound_created_idx on outbound_messages (created_at desc);

create trigger trg_outbound_append_only
  before update or delete on outbound_messages
  for each row execute function prevent_mutation();

-- Same lock-down as every other table: only the server (service role key) can touch these.
alter table inbound_messages enable row level security;
alter table pending_questions enable row level security;
alter table outbound_messages enable row level security;
revoke all on table inbound_messages, pending_questions, outbound_messages from anon, authenticated;

-- ---------- who is this number? --------------------------------------
-- Any phone format works: only the digits are compared, against users.phone (+<digits>).
create function user_by_phone(p_phone text) returns jsonb
language plpgsql
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_user users%rowtype;
begin
  if length(v_digits) >= 8 then
    select * into v_user from users where phone = '+' || v_digits and is_active;
  end if;
  if v_user.id is null then
    return jsonb_build_object('ok', true, 'found', false);
  end if;
  return jsonb_build_object(
    'ok', true,
    'found', true,
    'user', jsonb_build_object('id', v_user.id, 'name', v_user.name, 'phone', v_user.phone, 'role', v_user.role)
  );
end $$;

-- ---------- what the clerk needs to read a message -------------------
-- Active products (with their short names and prices), active staff, and the one setting
-- that changes the rules. One call, so a message costs one round trip here.
create function clerk_context() returns jsonb
language sql
as $$
  select jsonb_build_object(
    'ok', true,
    'allow_negative_stock', coalesce((select allow_negative_stock from settings limit 1), false),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'current_stock', p.current_stock,
        'default_price', p.default_price,
        'aliases', coalesce((select jsonb_agg(a.alias order by a.alias) from product_aliases a where a.product_id = p.id), '[]'::jsonb)
      ) order by p.name)
      from products p where p.is_active
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role) order by u.name)
      from users u where u.is_active
    ), '[]'::jsonb)
  );
$$;

-- ---------- one message, handled once --------------------------------
create function claim_inbound(
  p_channel text,
  p_provider_message_id text,
  p_sender text,
  p_body text
) returns jsonb
language plpgsql
as $$
declare
  v_id uuid;
  v_status text;
begin
  if p_channel is null or p_channel not in ('whatsapp', 'chat') then
    return engine_error('INVALID_INPUT', 'Unknown channel');
  end if;
  if p_provider_message_id is null or length(trim(p_provider_message_id)) = 0 or length(p_provider_message_id) > 200 then
    return engine_error('INVALID_INPUT', 'A message id is required');
  end if;
  if p_sender is null or length(trim(p_sender)) = 0 or length(p_sender) > 40 then
    return engine_error('INVALID_INPUT', 'A sender is required');
  end if;

  insert into inbound_messages (channel, provider_message_id, sender, body)
  values (p_channel, p_provider_message_id, p_sender, left(p_body, 8000))
  on conflict (channel, provider_message_id) do nothing
  returning id into v_id;

  if v_id is not null then
    return jsonb_build_object('ok', true, 'claimed', true, 'inbound_id', v_id);
  end if;

  select id, status into v_id, v_status
  from inbound_messages
  where channel = p_channel and provider_message_id = p_provider_message_id;
  return jsonb_build_object('ok', true, 'claimed', false, 'inbound_id', v_id, 'status', v_status);
end $$;

create function finish_inbound(
  p_inbound_id uuid,
  p_user_id uuid,
  p_status text,
  p_outcome text,
  p_interpretation jsonb,
  p_reply text,
  p_error text
) returns jsonb
language plpgsql
as $$
begin
  if p_status is null or p_status not in ('done', 'failed') then
    return engine_error('INVALID_INPUT', 'Status must be done or failed');
  end if;
  update inbound_messages
  set user_id = p_user_id,
      status = p_status,
      outcome = left(p_outcome, 60),
      interpretation = p_interpretation,
      reply = left(p_reply, 8000),
      error = left(p_error, 2000),
      completed_at = now()
  where id = p_inbound_id;
  if not found then
    return engine_error('NOT_FOUND', 'Message not found');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- the question we are waiting on ---------------------------
create function save_pending(p_user_id uuid, p_state jsonb, p_ttl_minutes integer default 10) returns jsonb
language plpgsql
as $$
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    return engine_error('INVALID_INPUT', 'The pending state must be an object');
  end if;
  if p_ttl_minutes is null or p_ttl_minutes < 0 or p_ttl_minutes > 1440 then
    return engine_error('INVALID_INPUT', 'The time to live must be 0 to 1440 minutes');
  end if;
  if not exists (select 1 from users where id = p_user_id) then
    return engine_error('USER_NOT_FOUND', 'User not found');
  end if;

  insert into pending_questions (user_id, state, created_at, expires_at)
  values (p_user_id, p_state, now(), now() + make_interval(mins => p_ttl_minutes))
  on conflict (user_id) do update
    set state = excluded.state, created_at = excluded.created_at, expires_at = excluded.expires_at;
  return jsonb_build_object('ok', true);
end $$;

-- Hands over the waiting question and removes it, so it can only be answered once.
create function take_pending(p_user_id uuid) returns jsonb
language plpgsql
as $$
declare
  v_row pending_questions%rowtype;
begin
  delete from pending_questions where user_id = p_user_id returning * into v_row;
  if v_row.user_id is null then
    return jsonb_build_object('ok', true, 'pending', null::jsonb);
  end if;
  if v_row.expires_at <= now() then
    return jsonb_build_object('ok', true, 'pending', null::jsonb, 'expired', true);
  end if;
  return jsonb_build_object('ok', true, 'pending', v_row.state);
end $$;

-- ---------- recent sales, for "undo my last sale" and corrections ----
-- Live sales only (reversed ones are skipped), newest first. p_user_id null = everyone's.
create function recent_sales(p_user_id uuid default null, p_limit integer default 5) returns jsonb
language plpgsql
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 20);
begin
  return jsonb_build_object('ok', true, 'sales', coalesce((
    select jsonb_agg(x.j order by x.created_at desc)
    from (
      select
        s.created_at,
        jsonb_build_object(
          'id', s.id,
          'salesperson_id', s.salesperson_id,
          'salesperson_name', u.name,
          'total_amount', s.total_amount,
          'original_message', s.original_message,
          'created_at', to_char(s.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', i.id,
              'product_id', i.product_id,
              'product_name', i.product_name,
              'quantity', i.quantity,
              'amount', i.amount
            ) order by i.product_name, i.id)   -- items of one sale share a timestamp, so sort by name
            from sale_items i where i.sale_id = s.id
          ), '[]'::jsonb)
        ) as j
      from sales s
      join users u on u.id = s.salesperson_id
      where s.status = 'recorded' and (p_user_id is null or s.salesperson_id = p_user_id)
      order by s.created_at desc
      limit v_limit
    ) x
  ), '[]'::jsonb));
end $$;

-- ---------- every reply we tried to send -----------------------------
create function log_outbound(
  p_channel text,
  p_recipient text,
  p_user_id uuid,
  p_inbound_id uuid,
  p_body text,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
) returns jsonb
language plpgsql
as $$
declare
  v_id bigint;
begin
  if p_status is null or p_status not in ('sent', 'failed', 'skipped') then
    return engine_error('INVALID_INPUT', 'Status must be sent, failed or skipped');
  end if;
  if p_channel is null or length(trim(p_channel)) = 0 or p_recipient is null or length(trim(p_recipient)) = 0
     or p_body is null then
    return engine_error('INVALID_INPUT', 'Channel, recipient and body are required');
  end if;
  insert into outbound_messages (channel, recipient, user_id, inbound_id, body, status, provider_message_id, error)
  values (left(p_channel, 40), p_recipient, p_user_id, p_inbound_id, left(p_body, 8000), p_status,
          p_provider_message_id, left(p_error, 2000))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ---------- Lock the functions down ----------------------------------
revoke all on function user_by_phone(text) from public, anon, authenticated;
revoke all on function clerk_context() from public, anon, authenticated;
revoke all on function claim_inbound(text, text, text, text) from public, anon, authenticated;
revoke all on function finish_inbound(uuid, uuid, text, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function save_pending(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function take_pending(uuid) from public, anon, authenticated;
revoke all on function recent_sales(uuid, integer) from public, anon, authenticated;
revoke all on function log_outbound(text, text, uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- Tells Supabase's API to notice the new functions right away (harmless anywhere else).
notify pgrst, 'reload schema';

commit;
