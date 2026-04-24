import { TypeVehicule } from './enums';
import { AgenceLocation } from './AgenceLocation.model';

export interface VehiculeAgence {
  idVehiculeAgence: number;
  agence: AgenceLocation;
  agenceId?: number;
  marque?: string;
  modele?: string;
  numeroPlaque: string;
  typeVehicule: TypeVehicule;
  capacitePassagers?: number;
  prixJour?: number;
  prixKm?: number;
  prixMinute?: number;
  prixVehicule?: number;
  statut: string;
  photoUrls?: string[];
  photoUrlsSerialized?: string;
}
