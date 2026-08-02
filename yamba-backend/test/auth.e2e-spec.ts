import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { creerCommercantTest } from './utils/seed.helper';

/**
 * Parcours critique : authentification du commerçant par code WhatsApp
 * (demande de code → vérification → JWT), et protection des routes du
 * dashboard par ce JWT.
 */
describe('Authentification par code WhatsApp (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let commercantId: string;
  let telephone: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const commercant = await creerCommercantTest(prisma, { nom: 'Salon Auth E2E' });
    commercantId = commercant.id;
    telephone = commercant.telephone;
  });

  afterAll(async () => {
    if (commercantId) {
      await prisma.commercant.delete({ where: { id: commercantId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('MOCK_MODE renvoie le code de connexion généré dans la réponse HTTP', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/demander-code')
      .send({ telephone })
      .expect(200);

    expect(response.body.code).toMatch(/^\d{6}$/);
  });

  it('refuse un code incorrect', async () => {
    await request(app.getHttpServer())
      .post('/auth/demander-code')
      .send({ telephone })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/verifier-code')
      .send({ telephone, code: '000000' })
      .expect(401);
  });

  it('refuse un numéro de téléphone inconnu', async () => {
    await request(app.getHttpServer())
      .post('/auth/demander-code')
      .send({ telephone: '243000000000' })
      .expect(404);
  });

  it('accepte le bon code, retourne un JWT, et refuse sa réutilisation (usage unique)', async () => {
    const demandeResponse = await request(app.getHttpServer())
      .post('/auth/demander-code')
      .send({ telephone })
      .expect(200);
    const { code } = demandeResponse.body as { code: string };

    const verificationResponse = await request(app.getHttpServer())
      .post('/auth/verifier-code')
      .send({ telephone, code })
      .expect(200);

    const { accessToken } = verificationResponse.body as { accessToken: string };
    expect(typeof accessToken).toBe('string');
    expect(accessToken.split('.')).toHaveLength(3); // header.payload.signature

    await request(app.getHttpServer())
      .post('/auth/verifier-code')
      .send({ telephone, code })
      .expect(401);
  });

  it('protège les routes du dashboard : 401 sans token, 200 avec le bon token', async () => {
    await request(app.getHttpServer()).get('/commercant/moi').expect(401);

    const demandeResponse = await request(app.getHttpServer())
      .post('/auth/demander-code')
      .send({ telephone })
      .expect(200);
    const { code } = demandeResponse.body as { code: string };

    const verificationResponse = await request(app.getHttpServer())
      .post('/auth/verifier-code')
      .send({ telephone, code })
      .expect(200);
    const { accessToken } = verificationResponse.body as { accessToken: string };

    const profilResponse = await request(app.getHttpServer())
      .get('/commercant/moi')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profilResponse.body.id).toBe(commercantId);
  });
});
