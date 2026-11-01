-- CreateEnum
CREATE TYPE "goal_status" AS ENUM ('active', 'achieved');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('active', 'on_hold', 'completed');

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "goal_status" NOT NULL DEFAULT 'active',
    "target_date" DATE,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "goal_id" UUID,
    "origin_inbox_item_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "project_status" NOT NULL DEFAULT 'active',
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tags" (
    "project_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "project_tags_pkey" PRIMARY KEY ("project_id","tag_id")
);

-- CreateIndex
CREATE INDEX "goals_owner_id_archived_at_created_at_idx" ON "goals"("owner_id", "archived_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "projects_origin_inbox_item_id_key" ON "projects"("origin_inbox_item_id");

-- CreateIndex
CREATE INDEX "projects_owner_id_archived_at_created_at_idx" ON "projects"("owner_id", "archived_at", "created_at");

-- CreateIndex
CREATE INDEX "projects_goal_id_idx" ON "projects"("goal_id");

-- CreateIndex
CREATE INDEX "project_tags_tag_id_idx" ON "project_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_origin_inbox_item_id_fkey" FOREIGN KEY ("origin_inbox_item_id") REFERENCES "inbox_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

