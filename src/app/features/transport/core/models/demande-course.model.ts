// src/app/features/transport/core/models/demande-course.model.ts
import { User } from './user.model';
import { Localisation } from './localisation.model';
import { ConfirmationClientStatut, DemandeStatus, TypeVehicule } from './enums';
import { Course } from './course.model';

export interface DemandeCourse {
  /** Alias si le backend sérialise en `id` (Jackson / entité JPA) */
  id?: number;
  idDemande?: number;
  client: User;
  localisationDepart: Localisation;
  localisationArrivee: Localisation;
  typeVehiculeDemande: TypeVehicule;
  prixEstime?: number;
  approbationClientRequise?: boolean;
  confirmationClientStatut?: ConfirmationClientStatut;
  statut: DemandeStatus;
  dateCreation?: string;
  dateModification?: string;
  course?: Course;
}

export interface DemandeCourseCreateRequest {
  clientId: number;
  localisationDepartId: number;
  localisationArriveeId: number;
  typeVehiculeDemande: TypeVehicule;
}

export interface DemandeCourseResponse {
  demande: DemandeCourse;
  prixEstimeCalcule: number;
  distanceKm: number;
  dureeEstimeeMinutes: number;
}
