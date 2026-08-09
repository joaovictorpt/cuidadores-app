-- CreateEnum
CREATE TYPE "CaregiverAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "CaregiverProfile" ADD COLUMN     "availabilityStatus" "CaregiverAvailability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "visibleToFamilies" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "FamilyProfile" ADD COLUMN     "visibleToCaregivers" BOOLEAN NOT NULL DEFAULT true;
