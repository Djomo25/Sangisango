import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getToken, setToken as persisterToken, clearToken } from '../api/client';
import { monProfil, type Commercant } from '../api/commercants';

// TODO(sécurité) : localStorage est lisible par tout script exécuté sur la page
// (vulnérable en cas de XSS). C'est acceptable pour ce MVP, mais une prochaine
// itération pourrait envisager un cookie httpOnly + refresh token côté serveur.

interface AuthContextValue {
  token: string | null;
  commercant: Commercant | null;
  chargement: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [commercant, setCommercant] = useState<Commercant | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!token) {
      setChargement(false);
      return;
    }

    monProfil()
      .then(setCommercant)
      .catch(() => {
        // Token invalide/expiré : apiFetch a déjà nettoyé le storage et
        // redirigé vers /login le cas échéant.
        setTokenState(null);
        setCommercant(null);
      })
      .finally(() => setChargement(false));
  }, [token]);

  async function login(nouveauToken: string) {
    persisterToken(nouveauToken);
    setTokenState(nouveauToken);
    const profil = await monProfil();
    setCommercant(profil);
  }

  function logout() {
    clearToken();
    setTokenState(null);
    setCommercant(null);
  }

  return (
    <AuthContext.Provider value={{ token, commercant, chargement, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  }
  return context;
}
