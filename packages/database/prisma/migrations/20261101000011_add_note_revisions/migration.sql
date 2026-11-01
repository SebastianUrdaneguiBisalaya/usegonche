-- CreateTable
CREATE TABLE "note_revisions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_revisions_owner_id_note_id_created_at_idx" ON "note_revisions"("owner_id", "note_id", "created_at");

-- AddForeignKey
ALTER TABLE "note_revisions" ADD CONSTRAINT "note_revisions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_revisions" ADD CONSTRAINT "note_revisions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

