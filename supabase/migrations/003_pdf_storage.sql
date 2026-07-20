-- 003: private pdf-uploads storage bucket + RLS
-- Users may only insert/select/delete objects under their own {user_id}/ prefix.
-- Files are transient: extract-pdf deletes them right after extraction.

insert into storage.buckets (id, name, public)
values ('pdf-uploads', 'pdf-uploads', false)
on conflict (id) do nothing;

create policy pdf_uploads_insert_own on storage.objects
    for insert with check (
        bucket_id = 'pdf-uploads'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy pdf_uploads_select_own on storage.objects
    for select using (
        bucket_id = 'pdf-uploads'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy pdf_uploads_delete_own on storage.objects
    for delete using (
        bucket_id = 'pdf-uploads'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
