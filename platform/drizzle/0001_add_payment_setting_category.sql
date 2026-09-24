-- Adds the PAYMENT category to the existing setting_category enum.
--
-- Kept alone in its own migration on purpose: PostgreSQL cannot roll back
-- "ALTER TYPE ... ADD VALUE", and the new value cannot be referenced inside
-- the same transaction that created it. Isolating it keeps every other
-- migration transactional and idempotent.
ALTER TYPE "setting_category" ADD VALUE IF NOT EXISTS 'PAYMENT';
