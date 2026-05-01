-- Make family-photos bucket public so <img src> works without signed URLs.
-- Object paths still use unguessable UUIDs, so this is privacy-acceptable
-- for the kiosk use case.
update storage.buckets set public = true where id = 'family-photos';
