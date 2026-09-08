create table if not exists public.loja_roupas_db (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.loja_roupas_db enable row level security;

drop policy if exists "loja le" on public.loja_roupas_db;
create policy "loja le" on public.loja_roupas_db
  for select to anon using (true);

drop policy if exists "loja grava" on public.loja_roupas_db;
create policy "loja grava" on public.loja_roupas_db
  for insert to anon with check (true);

drop policy if exists "loja atualiza" on public.loja_roupas_db;
create policy "loja atualiza" on public.loja_roupas_db
  for update to anon using (true) with check (true);

drop policy if exists "loja apaga" on public.loja_roupas_db;
create policy "loja apaga" on public.loja_roupas_db
  for delete to anon using (true);

create table if not exists public.loja_roupas_historico (
  id bigserial primary key,
  linha text not null,
  data jsonb not null,
  gravado_em timestamptz not null,
  guardado_em timestamptz not null default now(),
  produtos integer not null default 0,
  vendas integer not null default 0
);

create index if not exists loja_roupas_historico_idx
  on public.loja_roupas_historico (linha, guardado_em desc);

alter table public.loja_roupas_historico enable row level security;

drop policy if exists "historico le" on public.loja_roupas_historico;
create policy "historico le" on public.loja_roupas_historico
  for select to anon using (true);

create or replace function public.loja_roupas_conta(d jsonb, chave text)
returns integer language sql immutable as $$
  select case when jsonb_typeof(d -> chave) = 'array' then jsonb_array_length(d -> chave) else 0 end;
$$;

create or replace function public.loja_roupas_guardar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ultimo timestamptz;
  encolheu boolean;
begin
  if old.data is not distinct from new.data then
    return new;
  end if;
  encolheu := loja_roupas_conta(new.data, 'products') < loja_roupas_conta(old.data, 'products')
           or loja_roupas_conta(new.data, 'sales') < loja_roupas_conta(old.data, 'sales');
  select guardado_em into ultimo
    from public.loja_roupas_historico
   where linha = old.id
   order by guardado_em desc
   limit 1;
  if not encolheu and ultimo is not null and ultimo > now() - interval '10 minutes' then
    return new;
  end if;
  insert into public.loja_roupas_historico (linha, data, gravado_em, produtos, vendas)
  values (old.id, old.data, old.updated_at,
          loja_roupas_conta(old.data, 'products'),
          loja_roupas_conta(old.data, 'sales'));
  delete from public.loja_roupas_historico
   where linha = old.id
     and id not in (
       select id from public.loja_roupas_historico
        where linha = old.id
        order by guardado_em desc
        limit 300
     );
  return new;
end;
$$;

drop trigger if exists loja_roupas_historico_trg on public.loja_roupas_db;
create trigger loja_roupas_historico_trg
  before update on public.loja_roupas_db
  for each row execute function public.loja_roupas_guardar_historico();

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos leitura" on storage.objects;
create policy "fotos leitura" on storage.objects
  for select to anon using (bucket_id = 'fotos');

drop policy if exists "fotos envio" on storage.objects;
create policy "fotos envio" on storage.objects
  for insert to anon with check (bucket_id = 'fotos');

drop policy if exists "fotos troca" on storage.objects;
create policy "fotos troca" on storage.objects
  for update to anon using (bucket_id = 'fotos') with check (bucket_id = 'fotos');

drop policy if exists "fotos remocao" on storage.objects;
create policy "fotos remocao" on storage.objects
  for delete to anon using (bucket_id = 'fotos');
