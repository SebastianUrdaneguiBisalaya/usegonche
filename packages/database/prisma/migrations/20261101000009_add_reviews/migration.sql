-- CreateEnum
CREATE TYPE "review_kind" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "review_decision_action" AS ENUM ('carry_over', 'reschedule', 'drop', 'keep');

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "kind" "review_kind" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "review_status" NOT NULL DEFAULT 'open',
    "reflection" TEXT,
    "next_focus" TEXT,
    "planned_tasks" INTEGER,
    "completed_tasks" INTEGER,
    "planned_minutes" INTEGER,
    "actual_minutes" INTEGER,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_decisions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "action" "review_decision_action" NOT NULL,
    "target_date" DATE,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_owner_id_status_period_start_idx" ON "reviews"("owner_id", "status", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_owner_id_kind_period_start_key" ON "reviews"("owner_id", "kind", "period_start");

-- CreateIndex
CREATE INDEX "review_decisions_task_id_idx" ON "review_decisions"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_decisions_review_id_task_id_key" ON "review_decisions"("review_id", "task_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Period shape: daily = one date, weekly = seven dates (Monday..Sunday is enforced by the API).
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_period_check" CHECK (
    ("kind" = 'daily' AND "period_end" = "period_start")
    OR ("kind" = 'weekly' AND "period_end" = "period_start" + 6)
);

-- A closed review carries its snapshot and closing time; an open one carries neither.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_closed_snapshot_check" CHECK (
    (
        "status" = 'closed'
        AND "closed_at" IS NOT NULL
        AND "planned_tasks" IS NOT NULL AND "completed_tasks" IS NOT NULL AND "planned_minutes" IS NOT NULL AND "actual_minutes" IS NOT NULL
    ) OR (
        "status" = 'open'
        AND "closed_at" IS NULL
        AND "planned_tasks" IS NULL AND "completed_tasks" IS NULL AND "planned_minutes" IS NULL AND "actual_minutes" IS NULL
    )
);

-- Counters are never negative.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_counters_check" CHECK (
    COALESCE("planned_tasks", 0) >= 0 AND COALESCE("completed_tasks", 0) >= 0 AND COALESCE("planned_minutes", 0) >= 0 AND COALESCE("actual_minutes", 0) >= 0
);

-- Carry-over and reschedule need a target date; drop and keep must not have one.
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_target_date_check" CHECK (
    ("action" IN ('carry_over', 'reschedule')) = ("target_date" IS NOT NULL)
);
