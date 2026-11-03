-- DropIndex
DROP INDEX "inbox_items_search_vector_idx";

-- DropIndex
DROP INDEX "goals_search_vector_idx";

-- DropIndex
DROP INDEX "projects_search_vector_idx";

-- DropIndex
DROP INDEX "tasks_search_vector_idx";

-- DropIndex
DROP INDEX "notes_search_vector_idx";

-- AlterTable
ALTER TABLE "inbox_items" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "goals" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "search_vector";

-- AlterTable
ALTER TABLE "notes" DROP COLUMN "search_vector";

