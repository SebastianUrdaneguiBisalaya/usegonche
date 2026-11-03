-- CreateIndex
CREATE INDEX "task_events_owner_id_occurred_at_idx" ON "task_events"("owner_id", "occurred_at");
