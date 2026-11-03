-- The notes list is ordered by last update.
-- DropIndex
DROP INDEX "notes_owner_id_created_at_idx";

-- CreateIndex
CREATE INDEX "notes_owner_id_updated_at_idx" ON "notes"("owner_id", "updated_at");
