import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { obtenirLienConversion } from '../api/commercants';
import { ApiError } from '../api/client';

export function LienConversionCard() {
  const [lien, setLien] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    obtenirLienConversion()
      .then(({ lienConversion }) => {
        setLien(lienConversion);
        return QRCode.toDataURL(lienConversion, {
          width: 240,
          margin: 1,
          color: { dark: '#161c36', light: '#ffffff' },
        });
      })
      .then(setQrDataUrl)
      .catch((error) => {
        setErreur(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      });
  }, []);

  async function copier() {
    if (!lien) return;
    await navigator.clipboard.writeText(lien);
    setCopie(true);
    setTimeout(() => setCopie(false), 1600);
  }

  if (erreur) {
    return <p className="save-erreur">{erreur}</p>;
  }

  return (
    <div>
      <div className="wa-link-box">
        <span>{lien ?? 'Chargement…'}</span>
        <button type="button" className="btn-ghost tiny" onClick={copier} disabled={!lien}>
          {copie ? 'Copié ✓' : 'Copier'}
        </button>
      </div>
      {qrDataUrl && (
        <>
          <div className="qr-box">
            <img src={qrDataUrl} alt="QR code du lien de conversion" />
          </div>
          <p className="qr-cap">QR code à afficher en boutique</p>
        </>
      )}
    </div>
  );
}
