import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { FilterPills, type OptionFiltre } from '../components/FilterPills';
import { AppointmentRow } from '../components/AppointmentRow';
import {
  annulerRendezVous,
  confirmerRendezVous,
  listerRendezVous,
  type Periode,
  type RendezVous,
} from '../api/rendez-vous';
import { ApiError } from '../api/client';
import './RendezVous.css';

const LIMITE = 20;

const PERIODES: readonly OptionFiltre<Periode>[] = [
  { valeur: 'jour', label: "Aujourd'hui" },
  { valeur: 'semaine', label: 'Cette semaine' },
  { valeur: 'a-venir', label: 'À venir' },
];

export function RendezVous() {
  const [periode, setPeriode] = useState<Periode>('a-venir');
  const [rendezVous, setRendezVous] = useState<RendezVous[]>([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [actionEnCoursId, setActionEnCoursId] = useState<string | null>(null);

  const charger = useCallback(async (periodeActuelle: Periode, quantite: number) => {
    try {
      const reponse = await listerRendezVous(periodeActuelle, quantite, 0);
      setRendezVous(reponse.data);
      setTotal(reponse.total);
      setErreur(null);
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    setChargement(true);
    charger(periode, LIMITE).finally(() => setChargement(false));
  }, [periode, charger]);

  async function chargerPlus() {
    setChargementPlus(true);
    await charger(periode, rendezVous.length + LIMITE);
    setChargementPlus(false);
  }

  async function rafraichir() {
    await charger(periode, Math.max(rendezVous.length, LIMITE));
  }

  async function surConfirmer(id: string) {
    setActionEnCoursId(id);
    try {
      await confirmerRendezVous(id);
      await rafraichir();
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setActionEnCoursId(null);
    }
  }

  async function surAnnuler(rdv: RendezVous) {
    const nom = rdv.conversation.clientNom || rdv.conversation.clientTelephone;
    const confirme = window.confirm(
      `Annuler le rendez-vous de ${nom} (${rdv.service}) ? Cette action est irréversible.`,
    );
    if (!confirme) return;

    setActionEnCoursId(rdv.id);
    try {
      await annulerRendezVous(rdv.id);
      await rafraichir();
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setActionEnCoursId(null);
    }
  }

  return (
    <div>
      <PageHeader titre="Rendez-vous">
        <FilterPills options={PERIODES} valeur={periode} onChange={setPeriode} />
      </PageHeader>

      {erreur && <p className="detail-erreur">{erreur}</p>}

      {chargement ? (
        <p className="etat-vide">Chargement…</p>
      ) : rendezVous.length === 0 ? (
        <p className="etat-vide">Aucun rendez-vous à afficher pour cette période.</p>
      ) : (
        <div className="appt-view">
          {rendezVous.map((rdv) => (
            <AppointmentRow
              key={rdv.id}
              rendezVous={rdv}
              onConfirmer={() => surConfirmer(rdv.id)}
              onAnnuler={() => surAnnuler(rdv)}
              actionEnCours={actionEnCoursId === rdv.id}
            />
          ))}
          {rendezVous.length < total && (
            <button className="charger-plus" onClick={chargerPlus} disabled={chargementPlus}>
              {chargementPlus ? 'Chargement…' : 'Charger plus'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
