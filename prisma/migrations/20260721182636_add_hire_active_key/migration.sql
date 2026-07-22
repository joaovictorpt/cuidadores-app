-- AlterTable
ALTER TABLE "Hire" ADD COLUMN     "activeHireKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Hire_activeHireKey_key" ON "Hire"("activeHireKey");
