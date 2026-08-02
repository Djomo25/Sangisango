-- CreateEnum
CREATE TYPE "TonAssistant" AS ENUM ('chaleureux', 'professionnel', 'direct');

-- CreateEnum
CREATE TYPE "StatutConversation" AS ENUM ('en_cours', 'terminee', 'attention', 'abandon');

-- CreateEnum
CREATE TYPE "ExpediteurMessage" AS ENUM ('client', 'ia', 'commercant');

-- CreateEnum
CREATE TYPE "StatutCreneau" AS ENUM ('disponible', 'verrouille', 'reserve');

-- CreateEnum
CREATE TYPE "StatutRendezVous" AS ENUM ('a_confirmer', 'confirme', 'annule');

-- CreateTable
CREATE TABLE "commercants" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "secteur" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "numeroWhatsapp" TEXT NOT NULL,
    "tonAssistant" "TonAssistant" NOT NULL DEFAULT 'chaleureux',
    "horaires" JSONB NOT NULL,
    "servicesJson" JSONB NOT NULL,
    "faqJson" JSONB NOT NULL,
    "statutVerificationMeta" TEXT NOT NULL DEFAULT 'non_verifie',
    "lienConversion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "commercantId" TEXT NOT NULL,
    "clientTelephone" TEXT NOT NULL,
    "clientNom" TEXT,
    "statut" "StatutConversation" NOT NULL DEFAULT 'en_cours',
    "canal" TEXT NOT NULL DEFAULT 'whatsapp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "expediteur" "ExpediteurMessage" NOT NULL,
    "contenu" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creneaux_disponibles" (
    "id" TEXT NOT NULL,
    "commercantId" TEXT NOT NULL,
    "dateHeure" TIMESTAMP(3) NOT NULL,
    "dureeMinutes" INTEGER NOT NULL,
    "statut" "StatutCreneau" NOT NULL DEFAULT 'disponible',
    "verrouilleJusqua" TIMESTAMP(3),

    CONSTRAINT "creneaux_disponibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rendez_vous" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "creneauId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "prix" DOUBLE PRECISION,
    "statut" "StatutRendezVous" NOT NULL DEFAULT 'a_confirmer',
    "rappelEnvoye" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rendez_vous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrections" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageOriginalId" TEXT NOT NULL,
    "suggestionCommercant" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commercants_telephone_key" ON "commercants"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "commercants_numeroWhatsapp_key" ON "commercants"("numeroWhatsapp");

-- CreateIndex
CREATE INDEX "conversations_commercantId_idx" ON "conversations"("commercantId");

-- CreateIndex
CREATE INDEX "conversations_statut_idx" ON "conversations"("statut");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- CreateIndex
CREATE INDEX "creneaux_disponibles_commercantId_idx" ON "creneaux_disponibles"("commercantId");

-- CreateIndex
CREATE INDEX "creneaux_disponibles_statut_idx" ON "creneaux_disponibles"("statut");

-- CreateIndex
CREATE INDEX "creneaux_disponibles_dateHeure_idx" ON "creneaux_disponibles"("dateHeure");

-- CreateIndex
CREATE UNIQUE INDEX "rendez_vous_creneauId_key" ON "rendez_vous"("creneauId");

-- CreateIndex
CREATE INDEX "rendez_vous_conversationId_idx" ON "rendez_vous"("conversationId");

-- CreateIndex
CREATE INDEX "rendez_vous_statut_idx" ON "rendez_vous"("statut");

-- CreateIndex
CREATE INDEX "corrections_conversationId_idx" ON "corrections"("conversationId");

-- CreateIndex
CREATE INDEX "corrections_messageOriginalId_idx" ON "corrections"("messageOriginalId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_commercantId_fkey" FOREIGN KEY ("commercantId") REFERENCES "commercants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creneaux_disponibles" ADD CONSTRAINT "creneaux_disponibles_commercantId_fkey" FOREIGN KEY ("commercantId") REFERENCES "commercants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_creneauId_fkey" FOREIGN KEY ("creneauId") REFERENCES "creneaux_disponibles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_messageOriginalId_fkey" FOREIGN KEY ("messageOriginalId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
