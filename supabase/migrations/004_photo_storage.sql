-- 004: private photo-uploads storage bucket + RLS
-- Mirrors migration 003 (pdf-uploads). Files are transient: extract-photo
-- deletes them right after extraction.

insert into storage.buckets (id, name, public)
values ('photo-uploads', 'photo-uploads', false)
on conflict (id) do nothing;

create policy photo_uploads_insert_own on storage.objects
    for insert with check (
        bucket_id = 'photo-uploads'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy photo_uploads_select_own on storage.objects
    for select using (
        bucket_id = 'photo-uploads'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy photo_uploads_delete_own on storage.objects
    for delete using (
        bucket_id = 'photo-uploads'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
