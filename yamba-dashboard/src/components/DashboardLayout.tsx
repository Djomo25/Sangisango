import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { compterConversationsAttention } from '../api/conversations';
import { IconConversations, IconDeconnexion, IconMonCommerce, IconRendezVous } from './icons';
import './DashboardLayout.css';

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).slice(0, 2);
  return mots.map((mot) => mot[0]?.toUpperCase() ?? '').join('');
}

export function DashboardLayout() {
  const { commercant, logout } = useAuth();
  const navigate = useNavigate();
  const [nbAttention, setNbAttention] = useState(0);

  useEffect(() => {
    compterConversationsAttention()
      .then(setNbAttention)
      .catch(() => setNbAttention(0));
  }, []);

  function seDeconnecter() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark" />
          <span>Yamba</span>
        </div>

        <div className="sidebar-section-label">Activité</div>
        <nav className="sidebar-nav">
          <NavLink
            to="/conversations"
            className={({ isActive }) =>
              isActive ? 'sidebar-lien sidebar-lien--actif' : 'sidebar-lien'
            }
          >
            <IconConversations className="sidebar-lien-icone" />
            <span className="sidebar-lien-label">Conversations</span>
            {nbAttention > 0 && <span className="sidebar-badge">{nbAttention}</span>}
          </NavLink>
          <NavLink
            to="/rendez-vous"
            className={({ isActive }) =>
              isActive ? 'sidebar-lien sidebar-lien--actif' : 'sidebar-lien'
            }
          >
            <IconRendezVous className="sidebar-lien-icone" />
            <span className="sidebar-lien-label">Rendez-vous</span>
          </NavLink>
        </nav>

        <div className="sidebar-divider" />
        <div className="sidebar-section-label">Configuration</div>
        <nav className="sidebar-nav">
          <NavLink
            to="/mon-commerce"
            className={({ isActive }) =>
              isActive ? 'sidebar-lien sidebar-lien--actif' : 'sidebar-lien'
            }
          >
            <IconMonCommerce className="sidebar-lien-icone" />
            <span className="sidebar-lien-label">Mon commerce</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-profil">
            <div className="sidebar-avatar">{commercant ? initiales(commercant.nom) : ''}</div>
            <div className="sidebar-qui">
              <span className="sidebar-commercant" title={commercant?.nom}>
                {commercant?.nom ?? '…'}
              </span>
              <span className="sidebar-secteur">{commercant?.secteur}</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-deconnexion"
            onClick={seDeconnecter}
            title="Se déconnecter"
          >
            <IconDeconnexion />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-contenu">
        <Outlet />
      </main>
    </div>
  );
}
