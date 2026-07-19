-- 002: documents, document_chunks, playback_positions + RLS
-- Run in the Supabase SQL editor after 001.

create table if not exists public.documents (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid references auth.users on delete cascade,
    title        text not null,
    source_type  text not null check (source_type in ('paste','web','pdf','photo')),
    source_ref   text,
    language     text,
    char_count   int default 0,
    chunk_count  int default 0,
    status       text not null default 'processing'
                 check (status in ('processing','ready','error')),
    error_msg    text,
    created_at   timestamptz default now()
);

create table if not exists public.document_chunks (
    id           uuid primary key default gen_random_uuid(),
    document_id  uuid references public.documents on delete cascade,
    seq          int not null,
    content      text not null,
    unique (document_id, seq)
);

create index if not exists idx_document_chunks_doc_seq
    on public.document_chunks (document_id, seq);

create table if not exists public.playback_positions (
    document_id  uuid references public.documents on delete cascade,
    user_id      uuid references auth.users on delete cascade,
    chunk_seq    int default 0,
    updated_at   timestamptz default now(),
    primary key (document_id, user_id)
);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.playback_positions enable row level security;

-- documents: own rows only
create policy documents_select_own on public.documents
    for select using (auth.uid() = user_id);
create policy documents_insert_own on public.documents
    for insert with check (auth.uid() = user_id);
create policy documents_update_own on public.documents
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy documents_delete_own on public.documents
    for delete using (auth.uid() = user_id);

-- playback_positions: own rows only
create policy positions_select_own on public.playback_positions
    for select using (auth.uid() = user_id);
create policy positions_insert_own on public.playback_positions
    for insert with check (auth.uid() = user_id);
create policy positions_update_own on public.playback_positions
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy positions_delete_own on public.playback_positions
    for delete using (auth.uid() = user_id);

-- document_chunks: access through the owning document
create policy chunks_select_own on public.document_chunks
    for select using (
        exists (
            select 1 from public.documents d
            where d.id = document_id and d.user_id = auth.uid()
        )
    );
create policy chunks_insert_own on public.document_chunks
    for insert with check (
        exists (
            select 1 from public.documents d
            where d.id = document_id and d.user_id = auth.uid()
        )
    );
create policy chunks_delete_own on public.document_chunks
    for delete using (
        exists (
            select 1 from public.documents d
            where d.id = document_id and d.user_id = auth.uid()
        )
    );
