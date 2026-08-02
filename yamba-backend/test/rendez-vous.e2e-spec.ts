import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { creerCommercantTest, numeroClientTest } from './utils/seed.helper';
import { obtenirToken } from './utils/auth.helper';

/**
 * Parcours critique : création d'un rendez-vous (verrouille le créneau) puis
 * confirmation par le commerçant (réservation définitive), via le dashboard
 * authentifié.
 */
describe('Rendez-vous : création puis confirmation (e2e)', () => {
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

  it('crée un rendez-vous (verrouille le créneau) puis le confirme (réservation définitive)', async () => {
    const commercant = await creerCommercantTest(prisma, { nom: 'Salon RDV E2E' });
    commercantId = commercant.id;

    const conversation = await prisma.conversation.create({
      data: { commercantId: commercant.id, clientTelephone: numeroClientTest() },
    });

    const creneau = await prisma.creneauDisponible.create({
      data: {
        commercantId: commercant.id,
        dateHeure: new Date(Date.now() + 24 * 60 * 60 * 1000),
        dureeMinutes: 60,
        statut: 'disponible',
      },
    });

    const accessToken = await obtenirToken(app.getHttpServer(), commercant.telephone);

    const creationResponse = await request(app.getHttpServer())
      .post('/rendez-vous')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ conversationId: conversation.id, creneauId: creneau.id, service: 'Coupe test' })
      .expect(201);

    expect(creationResponse.body.statut).toBe('a_confirmer');
    const rendezVousId = creationResponse.body.id as string;

    const creneauVerrouille = await prisma.creneauDisponible.findUniqueOrThrow({
      where: { id: creneau.id },
    });
    expect(creneauVerrouille.statut).toBe('verrouille');
    expect(creneauVerrouille.verrouilleJusqua).not.toBeNull();

    const confirmationResponse = await request(app.getHttpServer())
      .patch(`/rendez-vous/${rendezVousId}/confirmer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(confirmationResponse.body.statut).toBe('confirme');

    const creneauReserve = await prisma.creneauDisponible.findUniqueOrThrow({
      where: { id: creneau.id },
    });
    expect(creneauReserve.statut).toBe('reserve');
    expect(creneauReserve.verrouilleJusqua).toBeNull();
  });

  it('refuse la création sur un créneau déjà verrouillé (anti double-booking)', async () => {
    const commercant = await prisma.commercant.findUniqueOrThrow({ where: { id: commercantId } });

    const conversation = await prisma.conversation.create({
      data: { commercantId: commercant.id, clientTelephone: numeroClientTest() },
    });

    const creneauDejaVerrouille = await prisma.creneauDisponible.create({
      data: {
        commercantId: commercant.id,
        dateHeure: new Date(Date.now() + 48 * 60 * 60 * 1000),
        dureeMinutes: 60,
        statut: 'verrouille',
        verrouilleJusqua: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const accessToken = await obtenirToken(app.getHttpServer(), commercant.telephone);

    await request(app.getHttpServer())
      .post('/rendez-vous')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        conversationId: conversation.id,
        creneauId: creneauDejaVerrouille.id,
        service: 'Coupe test',
      })
      .expect(409);
  });

  it("refuse la création d'un rendez-vous en utilisant le créneau d'un autre commerçant (anti-IDOR)", async () => {
    const commercant = await prisma.commercant.findUniqueOrThrow({ where: { id: commercantId } });
    const commercantAutre = await creerCommercantTest(prisma, { nom: 'Salon Concurrent E2E' });

    const conversation = await prisma.conversation.create({
      data: { commercantId: commercant.id, clientTelephone: numeroClientTest() },
    });
    const creneauAutre = await prisma.creneauDisponible.create({
      data: {
        commercantId: commercantAutre.id,
        dateHeure: new Date(Date.now() + 24 * 60 * 60 * 1000),
        dureeMinutes: 60,
        statut: 'disponible',
      },
    });

    const accessToken = await obtenirToken(app.getHttpServer(), commercant.telephone);

    await request(app.getHttpServer())
      .post('/rendez-vous')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        conversationId: conversation.id,
        creneauId: creneauAutre.id,
        service: 'Coupe test',
      })
      .expect(404);

    await prisma.commercant.delete({ where: { id: commercantAutre.id } });
  });
});
