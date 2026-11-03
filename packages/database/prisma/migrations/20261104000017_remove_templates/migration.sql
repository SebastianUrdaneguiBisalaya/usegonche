-- DropForeignKey
ALTER TABLE "templates" DROP CONSTRAINT "templates_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "template_tags" DROP CONSTRAINT "template_tags_template_id_fkey";

-- DropForeignKey
ALTER TABLE "template_tags" DROP CONSTRAINT "template_tags_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "template_items" DROP CONSTRAINT "template_items_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "template_items" DROP CONSTRAINT "template_items_template_id_fkey";

-- DropForeignKey
ALTER TABLE "template_items" DROP CONSTRAINT "template_items_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "template_item_tags" DROP CONSTRAINT "template_item_tags_item_id_fkey";

-- DropForeignKey
ALTER TABLE "template_item_tags" DROP CONSTRAINT "template_item_tags_tag_id_fkey";

-- DropTable
DROP TABLE "templates";

-- DropTable
DROP TABLE "template_tags";

-- DropTable
DROP TABLE "template_items";

-- DropTable
DROP TABLE "template_item_tags";

-- DropEnum
DROP TYPE "template_kind";

