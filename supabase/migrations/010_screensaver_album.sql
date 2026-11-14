begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screensaver-photos', 'screensaver-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);

create policy "Family can read screensaver photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'screensaver-photos'
    and (storage.foldername(name))[1] = (select public.get_family_id())::text);

create policy "Family can add screensaver photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'screensaver-photos'
    and (storage.foldername(name))[1] = (select public.get_family_id())::text);

create policy "Family can remove screensaver photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'screensaver-photos'
    and (storage.foldername(name))[1] = (select public.get_family_id())::text);

commit;
