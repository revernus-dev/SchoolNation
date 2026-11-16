-- SchoolNation initial schema. All student data here is fictional.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

create type public.member_role as enum ('teacher', 'student');
create type public.job_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  currency_name text not null default '별' check (char_length(currency_name) between 1 and 16),
  timezone text not null default 'Asia/Seoul',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  nickname text not null check (char_length(nickname) between 1 and 32),
  avatar text not null default '🌱',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (class_id, user_id),
  unique (id, class_id)
);

create table public.class_groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#dcefe6',
  created_at timestamptz not null default now(),
  unique (class_id, name),
  unique (id, class_id)
);

create table public.group_members (
  class_id uuid not null,
  group_id uuid not null,
  member_id uuid not null,
  primary key (group_id, member_id),
  foreign key (group_id, class_id) references public.class_groups(id, class_id) on delete cascade,
  foreign key (member_id, class_id) references public.class_members(id, class_id) on delete cascade
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  member_id uuid not null,
  balance bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  unique (member_id),
  foreign key (member_id, class_id) references public.class_members(id, class_id) on delete cascade,
  unique (id, class_id)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  account_id uuid not null,
  amount bigint not null check (amount <> 0),
  entry_type text not null check (entry_type in ('salary', 'reward', 'purchase', 'transfer_in', 'transfer_out', 'tax', 'adjustment')),
  reason text not null check (char_length(reason) between 1 and 240),
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (class_id, idempotency_key),
  foreign key (account_id, class_id) references public.accounts(id, class_id) on delete restrict
);

create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default '교실 혜택',
  price bigint not null check (price > 0),
  stock integer check (stock is null or stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, class_id)
);

create table public.owned_items (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  product_id uuid not null,
  member_id uuid not null,
  quantity integer not null default 1 check (quantity > 0),
  acquired_at timestamptz not null default now(),
  foreign key (product_id, class_id) references public.shop_products(id, class_id) on delete restrict,
  foreign key (member_id, class_id) references public.class_members(id, class_id) on delete cascade
);

create table public.class_features (
  class_id uuid primary key references public.classes(id) on delete cascade,
  economy_enabled boolean not null default true,
  jobs_enabled boolean not null default true,
  transfers_enabled boolean not null default false,
  shop_enabled boolean not null default true,
  tax_enabled boolean not null default false,
  investing_enabled boolean not null default false,
  writing_enabled boolean not null default false,
  boards_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.queued_jobs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  job_type text not null check (job_type in ('salary', 'interest', 'tax', 'statistics')),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status public.job_status not null default 'pending',
  run_after timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  result jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (class_id, idempotency_key)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  summary text not null check (char_length(summary) between 1 and 240),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index class_members_user_idx on public.class_members(user_id, class_id) where is_active;
create index ledger_class_created_idx on public.ledger_entries(class_id, created_at desc);
create index queued_due_idx on public.queued_jobs(status, run_after) where status in ('pending', 'failed');
create index audit_class_created_idx on public.audit_events(class_id, created_at desc);

-- Membership checks run inside Postgres, so browser-supplied class IDs cannot cross class boundaries.
create or replace function public.is_class_member(target_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members m
    where m.class_id = target_class and m.user_id = (select auth.uid()) and m.is_active
  );
$$;

create or replace function public.is_class_teacher(target_class uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members m
    where m.class_id = target_class and m.user_id = (select auth.uid())
      and m.role = 'teacher' and m.is_active
  );
$$;
revoke all on function public.is_class_member(uuid) from public, anon;
revoke all on function public.is_class_teacher(uuid) from public, anon;
grant execute on function public.is_class_member(uuid) to authenticated;
grant execute on function public.is_class_teacher(uuid) to authenticated;

-- The first authenticated teacher can create a class and their own membership atomically.
create or replace function public.create_class(class_name text, class_currency text default '별')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_class_id uuid;
  new_member_id uuid;
begin
  if (select auth.uid()) is null then raise exception '로그인해 주세요.' using errcode = '42501'; end if;
  if char_length(trim(class_name)) not between 1 and 80 or char_length(trim(class_currency)) not between 1 and 16 then
    raise exception '학급 이름과 화폐 이름을 확인해 주세요.';
  end if;
  insert into public.classes(name, currency_name, created_by)
  values (trim(class_name), trim(class_currency), (select auth.uid())) returning id into new_class_id;
  insert into public.class_members(class_id, user_id, role, nickname)
  values (new_class_id, (select auth.uid()), 'teacher', '담임 선생님') returning id into new_member_id;
  insert into public.accounts(class_id, member_id, balance) values (new_class_id, new_member_id, 0);
  insert into public.class_features(class_id) values (new_class_id);
  insert into public.audit_events(class_id, actor_id, event_type, summary)
  values (new_class_id, (select auth.uid()), 'class.created', '학급 공간을 만들었습니다.');
  return new_class_id;
end;
$$;
revoke all on function public.create_class(text, text) from public, anon;
grant execute on function public.create_class(text, text) to authenticated;

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.accounts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.shop_products enable row level security;
alter table public.owned_items enable row level security;
alter table public.class_features enable row level security;
alter table public.queued_jobs enable row level security;
alter table public.audit_events enable row level security;

create policy "members read their classes" on public.classes for select to authenticated using (public.is_class_member(id));
create policy "teachers update their classes" on public.classes for update to authenticated using (public.is_class_teacher(id)) with check (public.is_class_teacher(id));
create policy "members read class rosters" on public.class_members for select to authenticated using (public.is_class_member(class_id));
create policy "teachers manage class rosters" on public.class_members for all to authenticated using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy "members read groups" on public.class_groups for select to authenticated using (public.is_class_member(class_id));
create policy "teachers manage groups" on public.class_groups for all to authenticated using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy "members read group assignments" on public.group_members for select to authenticated using (public.is_class_member(class_id));
create policy "teachers manage group assignments" on public.group_members for all to authenticated using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy "teachers read class accounts and students read own" on public.accounts for select to authenticated using (
  public.is_class_teacher(class_id) or exists (
    select 1 from public.class_members m where m.id = accounts.member_id and m.user_id = (select auth.uid()) and m.is_active
  )
);
create policy "teachers read class ledger and students read own" on public.ledger_entries for select to authenticated using (
  public.is_class_teacher(class_id) or exists (
    select 1 from public.accounts a join public.class_members m on m.id = a.member_id
    where a.id = ledger_entries.account_id and m.user_id = (select auth.uid()) and m.is_active
  )
);
create policy "members read active products" on public.shop_products for select to authenticated using (public.is_class_member(class_id));
create policy "teachers manage products" on public.shop_products for all to authenticated using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy "teachers read class inventory and students read own" on public.owned_items for select to authenticated using (
  public.is_class_teacher(class_id) or exists (
    select 1 from public.class_members m where m.id = owned_items.member_id and m.user_id = (select auth.uid()) and m.is_active
  )
);
create policy "members read class features" on public.class_features for select to authenticated using (public.is_class_member(class_id));
create policy "teachers manage class features" on public.class_features for all to authenticated using (public.is_class_teacher(class_id)) with check (public.is_class_teacher(class_id));
create policy "teachers read queued work" on public.queued_jobs for select to authenticated using (public.is_class_teacher(class_id));
create policy "teachers queue work" on public.queued_jobs for insert to authenticated with check (public.is_class_teacher(class_id));
create policy "members read audit trail" on public.audit_events for select to authenticated using (public.is_class_member(class_id));

grant select on public.classes, public.class_members, public.class_groups, public.group_members,
  public.accounts, public.ledger_entries, public.shop_products, public.owned_items,
  public.class_features, public.queued_jobs, public.audit_events to authenticated;
grant update on public.classes to authenticated;
grant insert, update, delete on public.class_members, public.class_groups, public.group_members,
  public.shop_products, public.class_features to authenticated;
grant insert on public.queued_jobs to authenticated;

-- Purchase is an all-or-nothing database transaction. FOR UPDATE locks both account and stock row.
create or replace function public.purchase_product(target_product uuid, request_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  buyer public.class_members%rowtype;
  product public.shop_products%rowtype;
  account_row public.accounts%rowtype;
  ledger_id uuid;
begin
  select * into buyer from public.class_members
    where user_id = (select auth.uid()) and is_active and role = 'student'
    order by created_at limit 1;
  if buyer.id is null then raise exception '학생 계정으로 로그인해 주세요.'; end if;
  if not exists(select 1 from public.class_features f where f.class_id = buyer.class_id and f.shop_enabled) then
    raise exception '이 학급에서는 상점을 사용하지 않습니다.';
  end if;
  select * into product from public.shop_products where id = target_product and class_id = buyer.class_id and is_active for update;
  if product.id is null then raise exception '판매 중인 상품이 아닙니다.'; end if;
  select * into account_row from public.accounts where member_id = buyer.id and class_id = buyer.class_id for update;
  if account_row.id is null then raise exception '계좌를 찾을 수 없습니다.'; end if;
  if account_row.balance < product.price then raise exception '잔액이 부족합니다.'; end if;
  if product.stock is not null and product.stock < 1 then raise exception '재고가 없습니다.'; end if;
  if exists(select 1 from public.ledger_entries where class_id = buyer.class_id and idempotency_key = request_key) then
    raise exception '이미 처리된 요청입니다.' using errcode = '23505';
  end if;
  update public.accounts set balance = balance - product.price where id = account_row.id;
  if product.stock is not null then update public.shop_products set stock = stock - 1 where id = product.id; end if;
  insert into public.ledger_entries(class_id, account_id, amount, entry_type, reason, idempotency_key, created_by)
  values (buyer.class_id, account_row.id, -product.price, 'purchase', product.name || ' 구매', request_key, (select auth.uid())) returning id into ledger_id;
  insert into public.owned_items(class_id, product_id, member_id, quantity)
  values (buyer.class_id, product.id, buyer.id, 1);
  insert into public.audit_events(class_id, actor_id, event_type, summary, details)
  values (buyer.class_id, (select auth.uid()), 'shop.purchase', product.name || ' 구매', jsonb_build_object('ledger_id', ledger_id));
  return jsonb_build_object('ledger_id', ledger_id, 'balance', account_row.balance - product.price, 'remaining_stock', case when product.stock is null then null else product.stock - 1 end);
end;
$$;
revoke all on function public.purchase_product(uuid, text) from public, anon;
grant execute on function public.purchase_product(uuid, text) to authenticated;

-- A teacher reward updates one account and appends its immutable ledger record in one transaction.
create or replace function public.grant_reward(target_member uuid, reward_amount bigint, reward_reason text, request_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  member_row public.class_members%rowtype;
  account_row public.accounts%rowtype;
  next_balance bigint;
begin
  select * into member_row from public.class_members where id = target_member and is_active;
  if member_row.id is null or not public.is_class_teacher(member_row.class_id) then
    raise exception '교사 권한이 없습니다.' using errcode = '42501';
  end if;
  if reward_amount < 1 or char_length(trim(reward_reason)) not between 1 and 240 then
    raise exception '보상 금액이나 사유를 확인해 주세요.';
  end if;
  if exists(select 1 from public.ledger_entries where class_id = member_row.class_id and idempotency_key = request_key) then
    raise exception '이미 처리된 요청입니다.' using errcode = '23505';
  end if;
  select * into account_row from public.accounts where member_id = member_row.id and class_id = member_row.class_id for update;
  if account_row.id is null then raise exception '계좌를 찾을 수 없습니다.'; end if;
  next_balance := account_row.balance + reward_amount;
  update public.accounts set balance = next_balance where id = account_row.id;
  insert into public.ledger_entries(class_id, account_id, amount, entry_type, reason, idempotency_key, created_by)
  values (member_row.class_id, account_row.id, reward_amount, 'reward', trim(reward_reason), request_key, (select auth.uid()));
  insert into public.audit_events(class_id, actor_id, event_type, summary, details)
  values (member_row.class_id, (select auth.uid()), 'account.reward', trim(reward_reason), jsonb_build_object('member_id', target_member, 'amount', reward_amount));
  return jsonb_build_object('balance', next_balance);
end;
$$;
revoke all on function public.grant_reward(uuid, bigint, text, text) from public, anon;
grant execute on function public.grant_reward(uuid, bigint, text, text) to authenticated;

-- Student-to-student transfers are immediate and serialized by locking both accounts in stable order.
create or replace function public.transfer_stars(target_member uuid, transfer_amount bigint, request_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  sender public.class_members%rowtype;
  recipient public.class_members%rowtype;
  sender_account public.accounts%rowtype;
  recipient_account public.accounts%rowtype;
begin
  select * into sender from public.class_members
    where user_id = (select auth.uid()) and role = 'student' and is_active order by created_at limit 1;
  select * into recipient from public.class_members where id = target_member and is_active;
  if sender.id is null or recipient.id is null or sender.class_id <> recipient.class_id or sender.id = recipient.id then
    raise exception '같은 학급의 다른 학생만 선택할 수 있습니다.';
  end if;
  if not exists(select 1 from public.class_features f where f.class_id = sender.class_id and f.transfers_enabled) then
    raise exception '학생 간 송금이 꺼져 있습니다.';
  end if;
  if transfer_amount < 1 then raise exception '송금액은 1 이상이어야 합니다.'; end if;
  if exists(select 1 from public.ledger_entries where class_id = sender.class_id and idempotency_key in (request_key || ':out', request_key || ':in')) then
    raise exception '이미 처리된 요청입니다.' using errcode = '23505';
  end if;
  for sender_account in
    select * from public.accounts where class_id = sender.class_id and member_id in (sender.id, recipient.id) order by id for update
  loop
    if sender_account.member_id = sender.id then
      -- Reuse the typed row variable for the sender account; the recipient is read below after both locks are held.
      null;
    end if;
  end loop;
  select * into sender_account from public.accounts where class_id = sender.class_id and member_id = sender.id;
  select * into recipient_account from public.accounts where class_id = sender.class_id and member_id = recipient.id;
  if sender_account.id is null or recipient_account.id is null then raise exception '계좌를 찾을 수 없습니다.'; end if;
  if sender_account.balance < transfer_amount then raise exception '잔액이 부족합니다.'; end if;
  update public.accounts set balance = balance - transfer_amount where id = sender_account.id;
  update public.accounts set balance = balance + transfer_amount where id = recipient_account.id;
  insert into public.ledger_entries(class_id, account_id, amount, entry_type, reason, idempotency_key, created_by)
    values (sender.class_id, sender_account.id, -transfer_amount, 'transfer_out', '학생 간 송금', request_key || ':out', (select auth.uid()));
  insert into public.ledger_entries(class_id, account_id, amount, entry_type, reason, idempotency_key, created_by)
    values (sender.class_id, recipient_account.id, transfer_amount, 'transfer_in', '학생 간 송금 받음', request_key || ':in', (select auth.uid()));
  insert into public.audit_events(class_id, actor_id, event_type, summary, details)
    values (sender.class_id, (select auth.uid()), 'account.transfer', '학생 간 송금', jsonb_build_object('from', sender.id, 'to', recipient.id, 'amount', transfer_amount));
  return jsonb_build_object('sender_balance', sender_account.balance - transfer_amount, 'recipient_balance', recipient_account.balance + transfer_amount);
end;
$$;
revoke all on function public.transfer_stars(uuid, bigint, text) from public, anon;
grant execute on function public.transfer_stars(uuid, bigint, text) to authenticated;

-- A scheduled/manual worker claims due work once. Job IDs are also ledger idempotency keys.
create or replace function public.process_due_jobs(batch_limit integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  work public.queued_jobs%rowtype;
  account_id uuid;
  amount_value bigint;
  applied integer := 0;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception '작업 처리 권한이 없습니다.' using errcode = '42501';
  end if;
  for work in
    select * from public.queued_jobs
      where status in ('pending', 'failed') and run_after <= now()
      order by run_after, created_at
      for update skip locked limit greatest(1, least(batch_limit, 500))
  loop
    update public.queued_jobs set status = 'processing', attempts = attempts + 1, last_error = null where id = work.id;
    begin
      if work.job_type in ('salary', 'interest', 'tax') then
        account_id := (work.payload->>'account_id')::uuid;
        amount_value := (work.payload->>'amount')::bigint;
        if amount_value = 0 then raise exception '금액은 0이 될 수 없습니다.'; end if;
        update public.accounts set balance = balance + amount_value
          where id = account_id and class_id = work.class_id and balance + amount_value >= 0;
        if not found then raise exception '계좌가 없거나 잔액이 부족합니다.'; end if;
        insert into public.ledger_entries(class_id, account_id, amount, entry_type, reason, idempotency_key)
        values (work.class_id, account_id, amount_value,
          case work.job_type when 'salary' then 'salary' when 'interest' then 'reward' else 'tax' end,
          coalesce(work.payload->>'reason', work.job_type), 'job:' || work.id::text);
      end if;
      update public.queued_jobs set status = 'completed', processed_at = now(), result = jsonb_build_object('applied_at', now()) where id = work.id;
      insert into public.audit_events(class_id, event_type, summary, details)
      values (work.class_id, 'queue.completed', work.job_type || ' 예약 작업 완료', jsonb_build_object('job_id', work.id));
    exception when others then
      update public.queued_jobs set status = 'failed', last_error = left(sqlerrm, 500) where id = work.id;
      insert into public.audit_events(class_id, event_type, summary, details)
      values (work.class_id, 'queue.failed', work.job_type || ' 예약 작업 실패', jsonb_build_object('job_id', work.id, 'error', left(sqlerrm, 240)));
    end;
    applied := applied + 1;
  end loop;
  return applied;
end;
$$;
revoke all on function public.process_due_jobs(integer) from public, anon, authenticated;
grant execute on function public.process_due_jobs(integer) to service_role;

-- 20:00 Asia/Seoul is 11:00 UTC. This database-level schedule adds no always-on worker.
select cron.schedule(
  'schoolnation-daily-queue-processor',
  '0 11 * * *',
  $job$select public.process_due_jobs(100);$job$
);
