import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { creerCommercantTest, numeroClientTest } from './utils/seed.helper';

/**
 * Parcours critique : réception d'un message WhatsApp entrant → création de
 * conversation → réponse IA générée et enregistrée (MOCK_MODE, sans clé API réelle).
 */
describe('Webhook WhatsApp → Conversation → IA (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let commercantId: string | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (commercantId) {
      await prisma.commercant.delete({ where: { id: commercantId } }).catch(() => undefined);
    }
    await app.close();
  });

  it("crée la conversation et une réponse IA à partir d'un message client entrant", async () => {
    const commercant = await creerCommercantTest(prisma, { nom: 'Salon E2E WhatsApp' });
    commercantId = commercant.id;
    const clientTelephone = numeroClientTest();

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_TEST',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: commercant.numeroWhatsapp,
                  phone_number_id: 'PNID_TEST',
                },
                contacts: [{ profile: { name: 'Client E2E' }, wa_id: clientTelephone }],
                messages: [
                  {
                    from: clientTelephone,
                    id: 'wamid.E2E1',
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'text',
                    text: { body: 'Bonjour, quels sont vos services ?' },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/webhook/whatsapp')
      .send(payload)
      .expect(200)
      .expect({ status: 'ok' });

    const conversation = await prisma.conversation.findFirst({
      where: { commercantId: commercant.id, clientTelephone },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    expect(conversation).not.toBeNull();
    expect(conversation?.statut).toBe('en_cours');
    expect(conversation?.messages).toHaveLength(2);

    const [messageClient, messageIa] = conversation!.messages;
    expect(messageClient.expediteur).toBe('client');
    expect(messageClient.contenu).toContain('quels sont vos services');
    expect(messageIa.expediteur).toBe('ia');
    expect(messageIa.contenu.length).toBeGreaterThan(0);
  });

  it('ignore les notifications de statut (accusés de lecture) sans créer de conversation', async () => {
    const commercant = await creerCommercantTest(prisma, { nom: 'Salon E2E Statuts' });

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA_TEST',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: commercant.numeroWhatsapp,
                  phone_number_id: 'PNID_TEST',
                },
                statuses: [{ id: 'wamid.STATUS1', status: 'read' }],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/webhook/whatsapp')
      .send(payload)
      .expect(200)
      .expect({ status: 'ok' });

    const conversations = await prisma.conversation.findMany({
      where: { commercantId: commercant.id },
    });
    expect(conversations).toHaveLength(0);

    await prisma.commercant.delete({ where: { id: commercant.id } });
  });
});
