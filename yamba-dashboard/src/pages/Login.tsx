import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { demanderCode, verifierCode } from '../api/auth';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import './Login.css';

type Etape = 'telephone' | 'code';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [etape, setEtape] = useState<Etape>('telephone');
  const [telephone, setTelephone] = useState('');
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  // TODO: retirer cet affichage une fois les clés WhatsApp réelles configurées
  // (MOCK_MODE=false). Le backend ne renvoie ce code que tant que MOCK_MODE=true.
  const [codeMock, setCodeMock] = useState<string | null>(null);

  async function soumettreTelephone(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      const reponse = await demanderCode(telephone);
      setCodeMock(reponse.code ?? null);
      setEtape('code');
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function soumettreCode(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      const { accessToken } = await verifierCode(telephone, code);
      await login(accessToken);
      navigate('/conversations', { replace: true });
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function retourEtapeTelephone() {
    setEtape('telephone');
    setCode('');
    setErreur(null);
    setCodeMock(null);
  }

  return (
    <div className="login-ecran">
      <div className="login-carte">
        <h1 className="login-titre">Yamba</h1>
        <p className="login-soustitre">
          {etape === 'telephone'
            ? 'Connectez-vous avec votre numéro WhatsApp Business.'
            : `Code envoyé au ${telephone}.`}
        </p>

        {erreur && <div className="login-erreur">{erreur}</div>}

        {etape === 'telephone' && (
          <form onSubmit={soumettreTelephone}>
            <label className="login-champ">
              <span className="login-label">Numéro de téléphone</span>
              <input
                className="login-input"
                type="tel"
                inputMode="numeric"
                placeholder="243900000000"
                value={telephone}
                onChange={(event) => setTelephone(event.target.value)}
                required
                autoFocus
              />
            </label>
            <button className="login-bouton" type="submit" disabled={envoiEnCours}>
              {envoiEnCours ? 'Envoi...' : 'Recevoir le code'}
            </button>
          </form>
        )}

        {etape === 'code' && (
          <form onSubmit={soumettreCode}>
            {codeMock && <div className="login-mock">Code (MOCK_MODE) : {codeMock}</div>}
            <label className="login-champ">
              <span className="login-label">Code à 6 chiffres</span>
              <input
                className="login-input"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                autoFocus
              />
            </label>
            <button className="login-bouton" type="submit" disabled={envoiEnCours}>
              {envoiEnCours ? 'Vérification...' : 'Se connecter'}
            </button>
            <button
              type="button"
              className="login-retour"
              onClick={retourEtapeTelephone}
              disabled={envoiEnCours}
            >
              ← Changer de numéro
            </button>
          </form>
        )}

        <p className="login-lien-inscription">
          Pas encore de compte ? <Link to="/onboarding">Créer mon assistant</Link>
        </p>
      </div>
    </div>
  );
}
