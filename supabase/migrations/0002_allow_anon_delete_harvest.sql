-- Allow deletes on harvests from the anon role for the history browser's
-- delete action. Cascade FKs on harvest_strains + harvest_readings clean up
-- children automatically.

create policy "anon delete harvests" on public.harvests for delete to anon using (true);
