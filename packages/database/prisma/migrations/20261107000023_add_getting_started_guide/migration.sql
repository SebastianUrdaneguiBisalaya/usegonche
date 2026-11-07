-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "tour_completed_at" TIMESTAMPTZ(6),
ADD COLUMN     "getting_started_completed_at" TIMESTAMPTZ(6);

-- The guide is for new sign-ups only: accounts that already finished the onboarding never see it.
UPDATE "user_settings"
SET "tour_completed_at" = now(), "getting_started_completed_at" = now()
WHERE "onboarding_completed_at" IS NOT NULL;
