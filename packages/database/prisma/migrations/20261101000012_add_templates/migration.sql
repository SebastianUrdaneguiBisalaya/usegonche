-- CreateEnum
CREATE TYPE "template_kind" AS ENUM ('task', 'project');

-- AlterEnum
ALTER TYPE "task_origin" ADD VALUE 'template';

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "kind" "template_kind" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200),
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_tags" (
    "template_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "template_tags_pkey" PRIMARY KEY ("template_id","tag_id")
);

-- CreateTable
CREATE TABLE "template_items" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "parent_id" UUID,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "priority" "task_priority" NOT NULL DEFAULT 'medium',
    "estimated_minutes" INTEGER,
    "due_offset_days" INTEGER,

    CONSTRAINT "template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_item_tags" (
    "item_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "template_item_tags_pkey" PRIMARY KEY ("item_id","tag_id")
);

-- CreateIndex
CREATE INDEX "templates_owner_id_kind_created_at_idx" ON "templates"("owner_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "template_tags_tag_id_idx" ON "template_tags"("tag_id");

-- CreateIndex
CREATE INDEX "template_items_template_id_position_idx" ON "template_items"("template_id", "position");

-- CreateIndex
CREATE INDEX "template_items_parent_id_idx" ON "template_items"("parent_id");

-- CreateIndex
CREATE INDEX "template_item_tags_tag_id_idx" ON "template_item_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_tags" ADD CONSTRAINT "template_tags_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_tags" ADD CONSTRAINT "template_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_items" ADD CONSTRAINT "template_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_items" ADD CONSTRAINT "template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_items" ADD CONSTRAINT "template_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "template_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_item_tags" ADD CONSTRAINT "template_item_tags_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "template_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_item_tags" ADD CONSTRAINT "template_item_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A project template has a title; a task template has no project fields
ALTER TABLE "templates" ADD CONSTRAINT "templates_kind_check" CHECK (("kind" = 'project' AND "title" IS NOT NULL) OR ("kind" = 'task' AND "title" IS NULL AND "description" IS NULL));

-- Offsets are days after the start date
ALTER TABLE "template_items" ADD CONSTRAINT "template_items_due_offset_check" CHECK ("due_offset_days" IS NULL OR "due_offset_days" BETWEEN 0 AND 3650);
