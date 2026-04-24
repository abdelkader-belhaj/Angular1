// src/app/features/transport/core/models/vehicule.model.ts
import { Chauffeur } from './chauffeur.model';
import { TypeVehicule, VehiculeStatut } from './enums';

export interface Vehicule {
  idVehicule: number;
  chauffeur: Chauffeur;
  marque?: string;
  modele?: string;
  numeroPlaque: string;
  typeVehicule: TypeVehicule;
  capacitePassagers?: number;
  prixKm?: number;
  prixMinute?: number;
  statut: VehiculeStatut;
  photoUrls?: string[];
  chauffeurId?: number;
  dateCreation?: string;
  dateModification?: string;
}

export interface VehiculeCreateRequest {
  marque: string;
  modele: string;
  numeroPlaque: string;
  typeVehicule: TypeVehicule;
  capacitePassagers?: number;
  prixKm: number;
  prixMinute: number;
}

export interface VehiculeUpdateRequest {
  marque?: string;
  modele?: string;
  typeVehicule?: TypeVehicule;
  capacitePassagers?: number;
  prixKm?: number;
  prixMinute?: number;
  statut?: VehiculeStatut;
}
