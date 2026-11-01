-- CreateEnum
CREATE TYPE "inbox_source" AS ENUM ('quick', 'braindump');

-- CreateEnum
CREATE TYPE "inbox_status" AS ENUM ('pending', 'converted', 'archived', 'discarded');

-- CreateTable
CREATE TABLE "inbox_items" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "source" "inbox_source" NOT NULL DEFAULT 'quick',
    "status" "inbox_status" NOT NULL DEFAULT 'pending',
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbox_items_owner_id_status_captured_at_idx" ON "inbox_items"("owner_id", "status", "captured_at");

-- AddForeignKey
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

