import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { ToneSelector } from '../components/ToneSelector';
import { HorairesEditor } from '../components/HorairesEditor';
import { ServicesEditor } from '../components/ServicesEditor';
import { FaqEditor } from '../components/FaqEditor';
import { LienConversionCard } from '../components/LienConversionCard';
import {
  monProfil,
  mettreAJourProfil,
  type Commercant,
  type FaqItem,
  type Horaires,
  type Service,
  type TonAssistant,
} from '../api/commercants';
import { ApiError } from '../api/client';
import './MonCommerce.css';

interface FormulaireProfil {
  nom: string;
  commune: string;
  horaires: Horaires;
  tonAssistant: TonAssistant;
  servicesJson: Service[];
  faqJson: FaqItem[];
}

function versFormulaire(commercant: Commercant): FormulaireProfil {
  return {
    nom: commercant.nom,
    commune: commercant.commune,
    horaires: commercant.horaires ?? {},
    tonAssistant: commercant.tonAssistant,
    servicesJson: commercant.servicesJson ?? [],
    faqJson: commercant.faqJson ?? [],
  };
}

export function MonCommerce() {
  const [formulaire, setFormulaire] = useState<FormulaireProfil | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    monProfil()
      .then((commercant) => setFormulaire(versFormulaire(commercant)))
      .catch((error) => setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.'))
      .finally(() => setChargement(false));
  }, []);

  function modifier<K extends keyof FormulaireProfil>(champ: K, valeur: FormulaireProfil[K]) {
    setFormulaire((precedent) => (precedent ? { ...precedent, [champ]: valeur } : precedent));
    setEnregistre(false);
  }

  async function enregistrer() {
    if (!formulaire) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      const commercant = await mettreAJourProfil(formulaire);
      setFormulaire(versFormulaire(commercant));
      setEnregistre(true);
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) {
    return (
      <div>
        <PageHeader titre="Mon commerce" />
        <p className="etat-vide">Chargement…</p>
      </div>
    );
  }

  if (!formulaire) {
    return (
      <div>
        <PageHeader titre="Mon commerce" />
        <p className="save-erreur">{erreur ?? 'Impossible de charger le profil.'}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader titre="Mon commerce" />

      <div className="commerce-grid">
        <div>
          <div className="settings-card" style={{ marginBottom: 20 }}>
            <h4>Informations du commerce</h4>
            <div className="form-field">
              <label>Nom</label>
              <input
                className="form-input"
                type="text"
                value={formulaire.nom}
                onChange={(event) => modifier('nom', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Commune</label>
              <input
                className="form-input"
                type="text"
                value={formulaire.commune}
                onChange={(event) => modifier('commune', event.target.value)}
              />
            </div>
          </div>

          <div className="settings-card" style={{ marginBottom: 20 }}>
            <h4>Horaires</h4>
            <HorairesEditor
              valeur={formulaire.horaires}
              onChange={(valeur) => modifier('horaires', valeur)}
            />
          </div>

          <div className="settings-card" style={{ marginBottom: 20 }}>
            <h4>Ton de l'assistant</h4>
            <ToneSelector
              valeur={formulaire.tonAssistant}
              onChange={(valeur) => modifier('tonAssistant', valeur)}
            />
          </div>

          <div className="settings-card">
            <h4>Lien de conversion</h4>
            <LienConversionCard />
          </div>
        </div>

        <div>
          <div className="settings-card" style={{ marginBottom: 20 }}>
            <h4>Services</h4>
            <ServicesEditor
              valeur={formulaire.servicesJson}
              onChange={(valeur) => modifier('servicesJson', valeur)}
            />
          </div>

          <div className="settings-card">
            <h4>FAQ</h4>
            <FaqEditor
              valeur={formulaire.faqJson}
              onChange={(valeur) => modifier('faqJson', valeur)}
            />
          </div>
        </div>
      </div>

      <div className="save-bar">
        <button type="button" className="btn-primary" onClick={enregistrer} disabled={enregistrement}>
          {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {enregistre && <span className="save-confirmation">Enregistré ✓</span>}
        {erreur && <span className="save-erreur">{erreur}</span>}
      </div>
    </div>
  );
}
