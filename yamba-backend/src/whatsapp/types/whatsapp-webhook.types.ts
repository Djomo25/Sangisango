// Formes utiles du payload envoyé par le webhook WhatsApp Cloud API (Meta).
// Non exhaustif : seuls les champs utilisés par l'application sont typés.
// Référence : https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples

export interface WhatsappIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

export interface WhatsappContact {
  profile?: { name?: string };
  wa_id: string;
}

export interface WhatsappChangeValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsappContact[];
  messages?: WhatsappIncomingMessage[];
  // Présent pour les mises à jour de statut (delivered/read) plutôt que des messages.
  statuses?: unknown[];
}

export interface WhatsappChange {
  value: WhatsappChangeValue;
  field: string;
}

export interface WhatsappEntry {
  id: string;
  changes: WhatsappChange[];
}

export interface WhatsappWebhookPayload {
  object: string;
  entry: WhatsappEntry[];
}
