import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { FilterPills, type OptionFiltre } from '../components/FilterPills';
import { ConversationRow } from '../components/ConversationRow';
import { ConversationDetailPanel } from '../components/ConversationDetailPanel';
import { listerConversations, type ConversationApercu, type StatutConversation } from '../api/conversations';
import { ApiError } from '../api/client';
import './Conversations.css';

const LIMITE = 20;

type FiltreStatut = StatutConversation | 'toutes';

const STATUTS: readonly OptionFiltre<FiltreStatut>[] = [
  { valeur: 'toutes', label: 'Toutes' },
  { valeur: 'attention', label: 'Nécessite intervention' },
  { valeur: 'en_cours', label: 'En cours' },
  { valeur: 'terminee', label: 'Terminée' },
  { valeur: 'abandon', label: 'Abandonnée' },
];

export function Conversations() {
  const [statut, setStatut] = useState<FiltreStatut>('toutes');
  const [conversations, setConversations] = useState<ConversationApercu[]>([]);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selectionId, setSelectionId] = useState<string | null>(null);

  const charger = useCallback(async (statutActuel: FiltreStatut, quantite: number) => {
    try {
      const reponse = await listerConversations(
        statutActuel === 'toutes' ? undefined : statutActuel,
        quantite,
        0,
      );
      setConversations(reponse.data);
      setTotal(reponse.total);
      setErreur(null);
    } catch (error) {
      setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }, []);

  useEffect(() => {
    setChargement(true);
    setSelectionId(null);
    charger(statut, LIMITE).finally(() => setChargement(false));
  }, [statut, charger]);

  async function chargerPlus() {
    setChargementPlus(true);
    await charger(statut, conversations.length + LIMITE);
    setChargementPlus(false);
  }

  function rafraichirApresAction() {
    charger(statut, Math.max(conversations.length, LIMITE));
  }

  return (
    <div>
      <PageHeader titre="Conversations">
        <FilterPills options={STATUTS} valeur={statut} onChange={setStatut} />
      </PageHeader>

      {erreur && <p className="detail-erreur">{erreur}</p>}

      {chargement ? (
        <p className="etat-vide">Chargement…</p>
      ) : conversations.length === 0 ? (
        <p className="etat-vide">Aucune conversation à afficher pour ce filtre.</p>
      ) : (
        <div className="two-col">
          <div className="conv-list">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selectionnee={conversation.id === selectionId}
                onClick={() => setSelectionId(conversation.id)}
              />
            ))}
            {conversations.length < total && (
              <button className="charger-plus" onClick={chargerPlus} disabled={chargementPlus}>
                {chargementPlus ? 'Chargement…' : 'Charger plus'}
              </button>
            )}
          </div>

          {selectionId ? (
            <ConversationDetailPanel
              key={selectionId}
              conversationId={selectionId}
              onActionReussie={rafraichirApresAction}
            />
          ) : (
            <div className="conv-detail">
              <p className="empty">Sélectionnez une conversation</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
