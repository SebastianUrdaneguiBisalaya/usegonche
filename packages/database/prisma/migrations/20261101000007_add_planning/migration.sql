-- CreateEnum
CREATE TYPE "calendar_event_kind" AS ENUM ('event', 'out_of_office');

-- CreateEnum
CREATE TYPE "time_block_status" AS ENUM ('planned', 'done', 'missed', 'interrupted', 'rescheduled');

-- CreateTable
CREATE TABLE "availability_windows" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "availability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "kind" "calendar_event_kind" NOT NULL DEFAULT 'event',
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_plans" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_plan_items" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_blocks" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "task_id" UUID,
    "title" VARCHAR(200),
    "planned_start" TIMESTAMPTZ(6) NOT NULL,
    "planned_end" TIMESTAMPTZ(6) NOT NULL,
    "actual_start" TIMESTAMPTZ(6),
    "actual_end" TIMESTAMPTZ(6),
    "status" "time_block_status" NOT NULL DEFAULT 'planned',
    "rescheduled_from_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "time_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_windows_owner_id_weekday_idx" ON "availability_windows"("owner_id", "weekday");

-- CreateIndex
CREATE INDEX "calendar_events_owner_id_starts_at_idx" ON "calendar_events"("owner_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_plans_owner_id_date_key" ON "daily_plans"("owner_id", "date");

-- CreateIndex
CREATE INDEX "daily_plan_items_task_id_idx" ON "daily_plan_items"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_plan_items_plan_id_task_id_key" ON "daily_plan_items"("plan_id", "task_id");

-- CreateIndex
CREATE INDEX "time_blocks_owner_id_planned_start_idx" ON "time_blocks"("owner_id", "planned_start");

-- CreateIndex
CREATE INDEX "time_blocks_task_id_idx" ON "time_blocks"("task_id");

-- CreateIndex
CREATE INDEX "time_blocks_rescheduled_from_id_idx" ON "time_blocks"("rescheduled_from_id");

-- AddForeignKey
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_rescheduled_from_id_fkey" FOREIGN KEY ("rescheduled_from_id") REFERENCES "time_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Availability: ISO weekday and a valid minute range within one day.
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_range_check" CHECK ("weekday" BETWEEN 1 AND 7 AND "start_minute" >= 0 AND "end_minute" <= 1440 AND "end_minute" > "start_minute");

-- Calendar events end after they start.
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_range_check" CHECK ("ends_at" > "starts_at");

-- Time blocks: end after start (planned and actual) and either a task or a title.
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_planned_range_check" CHECK ("planned_end" > "planned_start");
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_actual_range_check" CHECK ("actual_start" IS NULL OR "actual_end" IS NULL OR "actual_end" > "actual_start");
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_task_or_title_check" CHECK ("task_id" IS NOT NULL OR "title" IS NOT NULL);
