import request from 'supertest';

type ServeurHttp = Parameters<typeof request>[0];

/**
 * Rejoue le flux d'authentification complet (demander-code → verifier-code)
 * via de vraies requêtes HTTP, et retourne le JWT obtenu. Nécessite MOCK_MODE=true
 * pour que le code soit renvoyé dans la réponse de /auth/demander-code.
 */
export async function obtenirToken(serveur: ServeurHttp, telephone: string): Promise<string> {
  const demandeResponse = await request(serveur)
    .post('/auth/demander-code')
    .send({ telephone })
    .expect(200);

  const { code } = demandeResponse.body as { code?: string };
  if (!code) {
    throw new Error(
      "Le code de connexion n'a pas été renvoyé par /auth/demander-code — vérifie que MOCK_MODE=true est actif pour les tests e2e.",
    );
  }

  const verificationResponse = await request(serveur)
    .post('/auth/verifier-code')
    .send({ telephone, code })
    .expect(200);

  const { accessToken } = verificationResponse.body as { accessToken: string };
  return accessToken;
}
