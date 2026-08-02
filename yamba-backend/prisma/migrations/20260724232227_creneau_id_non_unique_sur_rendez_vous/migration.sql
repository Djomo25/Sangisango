-- DropIndex
DROP INDEX "rendez_vous_creneauId_key";

-- CreateIndex
CREATE INDEX "rendez_vous_creneauId_idx" ON "rendez_vous"("creneauId");
