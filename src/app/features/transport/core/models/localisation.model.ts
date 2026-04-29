// src/app/features/transport/core/models/localisation.model.ts

export interface Localisation {
  idLocalisation?: number;
  latitude: number;
  longitude: number;
  adresse?: string;
  dateCreation?: string;
}

export interface LocalisationCreateRequest {
  latitude: number;
  longitude: number;
  adresse?: string;
}

export interface PositionUpdate {
  idLocalisation?: number;
  latitude: number;
  longitude: number;
  courseId?: number; // Optionnel, pour lier la position à une course active
}
