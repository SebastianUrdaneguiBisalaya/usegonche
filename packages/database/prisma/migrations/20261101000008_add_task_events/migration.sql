-- CreateEnum
CREATE TYPE "task_event_type" AS ENUM ('status_changed', 'priority_changed', 'due_changed', 'project_changed', 'rescheduled');

-- CreateEnum
CREATE TYPE "task_event_actor" AS ENUM ('user', 'system', 'ai', 'integration');

-- CreateTable
CREATE TABLE "task_events" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "type" "task_event_type" NOT NULL,
    "actor" "task_event_actor" NOT NULL DEFAULT 'user',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from_status" "task_status",
    "to_status" "task_status",
    "from_priority" "task_priority",
    "to_priority" "task_priority",
    "from_due_date" DATE,
    "to_due_date" DATE,
    "from_project_id" UUID,
    "to_project_id" UUID,
    "from_start" TIMESTAMPTZ(6),
    "from_end" TIMESTAMPTZ(6),
    "to_start" TIMESTAMPTZ(6),
    "to_end" TIMESTAMPTZ(6),
    "time_block_id" UUID,

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_events_task_id_occurred_at_idx" ON "task_events"("task_id", "occurred_at");

-- CreateIndex
CREATE INDEX "task_events_owner_id_type_occurred_at_idx" ON "task_events"("owner_id", "type", "occurred_at");

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_from_project_id_fkey" FOREIGN KEY ("from_project_id") REFERENCES "projects"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_to_project_id_fkey" FOREIGN KEY ("to_project_id") REFERENCES "projects"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_time_block_id_fkey" FOREIGN KEY ("time_block_id") REFERENCES "time_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Each event type fills exactly its own typed columns (and `to` differs from `from` where it is a change).
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_type_columns_check" CHECK (
    (
        "type" = 'status_changed'
        AND "from_status" IS NOT NULL AND "to_status" IS NOT NULL AND "from_status" <> "to_status"
        AND "from_priority" IS NULL AND "to_priority" IS NULL
        AND "from_due_date" IS NULL AND "to_due_date" IS NULL
        AND "from_project_id" IS NULL AND "to_project_id" IS NULL
        AND "from_start" IS NULL AND "from_end" IS NULL AND "to_start" IS NULL AND "to_end" IS NULL
    ) OR (
        "type" = 'priority_changed'
        AND "from_priority" IS NOT NULL AND "to_priority" IS NOT NULL AND "from_priority" <> "to_priority"
        AND "from_status" IS NULL AND "to_status" IS NULL
        AND "from_due_date" IS NULL AND "to_due_date" IS NULL
        AND "from_project_id" IS NULL AND "to_project_id" IS NULL
        AND "from_start" IS NULL AND "from_end" IS NULL AND "to_start" IS NULL AND "to_end" IS NULL
    ) OR (
        "type" = 'due_changed'
        AND ("from_due_date" IS NOT NULL OR "to_due_date" IS NOT NULL) AND "from_due_date" IS DISTINCT FROM "to_due_date"
        AND "from_status" IS NULL AND "to_status" IS NULL
        AND "from_priority" IS NULL AND "to_priority" IS NULL
        AND "from_project_id" IS NULL AND "to_project_id" IS NULL
        AND "from_start" IS NULL AND "from_end" IS NULL AND "to_start" IS NULL AND "to_end" IS NULL
    ) OR (
        "type" = 'project_changed'
        AND ("from_project_id" IS NOT NULL OR "to_project_id" IS NOT NULL) AND "from_project_id" IS DISTINCT FROM "to_project_id"
        AND "from_status" IS NULL AND "to_status" IS NULL
        AND "from_priority" IS NULL AND "to_priority" IS NULL
        AND "from_due_date" IS NULL AND "to_due_date" IS NULL
        AND "from_start" IS NULL AND "from_end" IS NULL AND "to_start" IS NULL AND "to_end" IS NULL
    ) OR (
        "type" = 'rescheduled'
        AND "from_start" IS NOT NULL AND "from_end" IS NOT NULL AND "to_start" IS NOT NULL AND "to_end" IS NOT NULL
        AND "from_status" IS NULL AND "to_status" IS NULL
        AND "from_priority" IS NULL AND "to_priority" IS NULL
        AND "from_due_date" IS NULL AND "to_due_date" IS NULL
        AND "from_project_id" IS NULL AND "to_project_id" IS NULL
    )
);
