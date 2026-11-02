-- Full-text search: generated `tsvector` columns (config `simple`, Markdown text indexed as is) + GIN indexes.
-- Hand-written because Prisma cannot express generated columns; the schema declares them as `Unsupported("tsvector")`.

-- inbox_items
ALTER TABLE "inbox_items" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, "content")) STORED;
CREATE INDEX "inbox_items_search_vector_idx" ON "inbox_items" USING GIN ("search_vector");

-- goals
ALTER TABLE "goals" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, "title" || ' ' || coalesce("description", ''))) STORED;
CREATE INDEX "goals_search_vector_idx" ON "goals" USING GIN ("search_vector");

-- projects
ALTER TABLE "projects" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, "title" || ' ' || coalesce("description", ''))) STORED;
CREATE INDEX "projects_search_vector_idx" ON "projects" USING GIN ("search_vector");

-- tasks
ALTER TABLE "tasks" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, "title" || ' ' || coalesce("description", ''))) STORED;
CREATE INDEX "tasks_search_vector_idx" ON "tasks" USING GIN ("search_vector");

-- notes
ALTER TABLE "notes" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, "title" || ' ' || coalesce("body", ''))) STORED;
CREATE INDEX "notes_search_vector_idx" ON "notes" USING GIN ("search_vector");
