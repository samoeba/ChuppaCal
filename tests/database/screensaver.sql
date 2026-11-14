begin;
select public.cc_test_assert(
  (select not public from storage.buckets where id = 'screensaver-photos'),
  'screensaver bucket is private'
);

insert into storage.objects(bucket_id, name) values
  ('screensaver-photos', '20000000-0000-0000-0000-000000000002/other-photo');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

insert into storage.objects(bucket_id, name) values
  ('screensaver-photos', '20000000-0000-0000-0000-000000000001/own-photo');
select public.cc_test_assert(
  (select array_agg(name) = array['20000000-0000-0000-0000-000000000001/own-photo']
   from storage.objects where bucket_id = 'screensaver-photos'),
  'family can only read its own screensaver photos'
);
select public.cc_test_reject(
  $$insert into storage.objects(bucket_id, name) values
    ('screensaver-photos', '20000000-0000-0000-0000-000000000002/cross-family-upload')$$,
  'row-level security'
);

delete from storage.objects where bucket_id = 'screensaver-photos';
reset role;
select public.cc_test_assert(
  (select array_agg(name) = array['20000000-0000-0000-0000-000000000002/other-photo']
   from storage.objects where bucket_id = 'screensaver-photos'),
  'family can remove its own photos only'
);
set local role anon;
select public.cc_test_assert(
  (select count(*) = 0 from storage.objects where bucket_id = 'screensaver-photos'),
  'anonymous users cannot read photos'
);
rollback;
