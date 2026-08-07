-- CreateEnum
CREATE TYPE "HireInitiator" AS ENUM ('FAMILY', 'CAREGIVER');

-- AlterTable
ALTER TABLE "Hire" ADD COLUMN     "initiatedBy" "HireInitiator" NOT NULL DEFAULT 'FAMILY';
