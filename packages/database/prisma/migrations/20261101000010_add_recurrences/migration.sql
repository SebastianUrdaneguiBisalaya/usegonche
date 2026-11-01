-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "occurrence_date" DATE,
ADD COLUMN     "recurrence_id" UUID;

-- CreateTable
CREATE TABLE "recurrence_rules" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "rule" VARCHAR(500) NOT NULL,
    "start_date" DATE NOT NULL,
    "generated_until" DATE,
    "start_minute" INTEGER,
    "duration_minutes" INTEGER,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "priority" "task_priority" NOT NULL DEFAULT 'medium',
    "estimated_minutes" INTEGER,
    "project_id" UUID,
    "goal_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrence_rule_tags" (
    "recurrence_rule_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "recurrence_rule_tags_pkey" PRIMARY KEY ("recurrence_rule_id","tag_id")
);

-- CreateIndex
CREATE INDEX "recurrence_rules_owner_id_created_at_idx" ON "recurrence_rules"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "recurrence_rules_project_id_idx" ON "recurrence_rules"("project_id");

-- CreateIndex
CREATE INDEX "recurrence_rules_goal_id_idx" ON "recurrence_rules"("goal_id");

-- CreateIndex
CREATE INDEX "recurrence_rule_tags_tag_id_idx" ON "recurrence_rule_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_recurrence_id_occurrence_date_key" ON "tasks"("recurrence_id", "occurrence_date");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rule_tags" ADD CONSTRAINT "recurrence_rule_tags_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rule_tags" ADD CONSTRAINT "recurrence_rule_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Time of day: both or none, within a day
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_time_check" CHECK (("start_minute" IS NULL AND "duration_minutes" IS NULL) OR ("start_minute" BETWEEN 0 AND 1439 AND "duration_minutes" BETWEEN 1 AND 1440));
