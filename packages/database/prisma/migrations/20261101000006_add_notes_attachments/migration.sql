-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "project_id" UUID,
    "origin_inbox_item_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_tags" (
    "note_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "note_tags_pkey" PRIMARY KEY ("note_id","tag_id")
);

-- CreateTable
CREATE TABLE "task_notes" (
    "task_id" UUID NOT NULL,
    "note_id" UUID NOT NULL,

    CONSTRAINT "task_notes_pkey" PRIMARY KEY ("task_id","note_id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "task_id" UUID,
    "project_id" UUID,
    "note_id" UUID,
    "storage_path" VARCHAR(300) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notes_origin_inbox_item_id_key" ON "notes"("origin_inbox_item_id");

-- CreateIndex
CREATE INDEX "notes_owner_id_created_at_idx" ON "notes"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "notes_project_id_idx" ON "notes"("project_id");

-- CreateIndex
CREATE INDEX "note_tags_tag_id_idx" ON "note_tags"("tag_id");

-- CreateIndex
CREATE INDEX "task_notes_note_id_idx" ON "task_notes"("note_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_path_key" ON "attachments"("storage_path");

-- CreateIndex
CREATE INDEX "attachments_task_id_created_at_idx" ON "attachments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_project_id_created_at_idx" ON "attachments"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_note_id_created_at_idx" ON "attachments"("note_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_owner_id_created_at_idx" ON "attachments"("owner_id", "created_at");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_origin_inbox_item_id_fkey" FOREIGN KEY ("origin_inbox_item_id") REFERENCES "inbox_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- An attachment belongs to exactly one of task, project or note.
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_exactly_one_parent_check" CHECK (num_nonnulls("task_id", "project_id", "note_id") = 1);
