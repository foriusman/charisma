create table if not exists public.wedding_payments (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  payer_name text,
  payer_email text,
  amount numeric,
  currency text default 'NGN',
  purpose text,
  note text,
  status text default 'pending',
  gateway text default 'Zainpay',
  gateway_reference text,
  receipt_path text,
  paid_at timestamptz,
  created_at timestamptz default now()
);

alter table public.wedding_payments add column if not exists receipt_path text;
alter table public.wedding_payments enable row level security;

grant select, insert, update on public.wedding_payments to anon;

drop policy if exists "anon can insert payments" on public.wedding_payments;
drop policy if exists "anon can read payments" on public.wedding_payments;
drop policy if exists "anon can update payments" on public.wedding_payments;
drop policy if exists "anon can submit demo gifts and transfer receipts" on public.wedding_payments;
drop policy if exists "anon can read payments for dashboard" on public.wedding_payments;
drop policy if exists "anon can update payment status" on public.wedding_payments;

create policy "anon can submit demo gifts and transfer receipts"
  on public.wedding_payments for insert to anon
  with check (
    (gateway = 'Zainpay' and status = 'demo')
    or (gateway = 'Bank Transfer' and status = 'pending' and receipt_path is not null)
  );

create policy "anon can read payments for dashboard"
  on public.wedding_payments for select to anon using (true);

create policy "anon can update payment status"
  on public.wedding_payments for update to anon
  using (true) with check (status in ('pending', 'confirmed', 'demo'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "visitors can upload receipt files" on storage.objects;
create policy "visitors can upload receipt files"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] ~ '^CH26-[A-Z0-9-]{8,40}$'
  );