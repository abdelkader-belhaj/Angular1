// src/app/features/transport/core/models/websocket.model.ts

/**
 * DTO pour la mise à jour de position GPS (envoyé par le chauffeur)
 */
export interface LocationUpdateDTO {
  courseId?: number; // ID de la course en cours (optionnel)
  chauffeurId?: number; // ID du chauffeur
  clientId?: number; // ID du client
  actorType?: 'CHAUFFEUR' | 'CLIENT';
  latitude: number;
  longitude: number;
  timestamp?: string; // ISO date string
  speed?: number; // Vitesse en km/h (optionnel)
  heading?: number; // Direction en degrés (optionnel)
}

// ChatMessageDTO is defined in message-transport.model.ts to keep a single source of truth.
