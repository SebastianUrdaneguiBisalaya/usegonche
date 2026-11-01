-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "task_origin" AS ENUM ('manual', 'inbox');

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "parent_id" UUID,
    "project_id" UUID,
    "goal_id" UUID,
    "origin_inbox_item_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "task_status" NOT NULL DEFAULT 'todo',
    "priority" "task_priority" NOT NULL DEFAULT 'medium',
    "origin" "task_origin" NOT NULL DEFAULT 'manual',
    "start_date" DATE,
    "due_date" DATE,
    "estimated_minutes" INTEGER,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "task_id" UUID NOT NULL,
    "depends_on_id" UUID NOT NULL,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("task_id","depends_on_id")
);

-- CreateTable
CREATE TABLE "task_blockers" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "task_blockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_tags" (
    "task_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "task_tags_pkey" PRIMARY KEY ("task_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_origin_inbox_item_id_key" ON "tasks"("origin_inbox_item_id");

-- CreateIndex
CREATE INDEX "tasks_owner_id_status_created_at_idx" ON "tasks"("owner_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "tasks_owner_id_due_date_idx" ON "tasks"("owner_id", "due_date");

-- CreateIndex
CREATE INDEX "tasks_parent_id_idx" ON "tasks"("parent_id");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "tasks_goal_id_idx" ON "tasks"("goal_id");

-- CreateIndex
CREATE INDEX "task_dependencies_depends_on_id_idx" ON "task_dependencies"("depends_on_id");

-- CreateIndex
CREATE INDEX "task_blockers_task_id_resolved_at_idx" ON "task_blockers"("task_id", "resolved_at");

-- CreateIndex
CREATE INDEX "task_blockers_owner_id_started_at_idx" ON "task_blockers"("owner_id", "started_at");

-- CreateIndex
CREATE INDEX "task_tags_tag_id_idx" ON "task_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_origin_inbox_item_id_fkey" FOREIGN KEY ("origin_inbox_item_id") REFERENCES "inbox_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_blockers" ADD CONSTRAINT "task_blockers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_blockers" ADD CONSTRAINT "task_blockers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A task cannot depend on itself (cycles are checked by the API).
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_no_self_check" CHECK ("task_id" <> "depends_on_id");
