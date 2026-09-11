-- Migration: 018_fix_point_reason_freeze_shop
-- Descrição: O enum point_reason nunca recebeu o valor 'freeze_shop', apesar
--             de PointReason.FreezeShop (packages/shared) e buyStreakFreeze()
--             (gamification.service.ts) já usarem esse valor desde que a loja
--             de freeze foi implementada. Toda compra de freeze falhava ao
--             tentar registrar a transação no ledger (erro 22P02 - invalid
--             input value for enum point_reason).

ALTER TYPE public.point_reason ADD VALUE IF NOT EXISTS 'freeze_shop';
