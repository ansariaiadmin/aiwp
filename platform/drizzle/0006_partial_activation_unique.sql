-- 0006: make the license_activations uniqueness partial.
--
-- The original index (license_activations_unique_idx on (license_id,
-- site_url)) counted DEACTIVATED rows too, so re-activating a previously
-- deactivated site violated the constraint and the activation endpoint
-- returned a 500 instead of re-activating. The business rule is "at most
-- one ACTIVE activation per (license, site)", which is a partial unique
-- index over rows where deactivated_at IS NULL.
DROP INDEX IF EXISTS license_activations_unique_idx;
CREATE UNIQUE INDEX license_activations_active_unique_idx
  ON license_activations (license_id, site_url)
  WHERE deactivated_at IS NULL;
