ALTER TABLE public.evidences
  ADD COLUMN IF NOT EXISTS indicator_index integer,
  ADD COLUMN IF NOT EXISTS indicator_text text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evidences_indicator_index_nonnegative'
      AND conrelid = 'public.evidences'::regclass
  ) THEN
    ALTER TABLE public.evidences
      ADD CONSTRAINT evidences_indicator_index_nonnegative
      CHECK (indicator_index IS NULL OR indicator_index >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS evidences_user_standard_indicator_idx
  ON public.evidences (user_id, standard_id, indicator_index);
