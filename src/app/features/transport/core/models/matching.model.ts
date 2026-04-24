// src/app/features/transport/core/models/matching.model.ts
import { DemandeCourse } from './demande-course.model';
import { Chauffeur } from './chauffeur.model';
import { Course } from './course.model';
import { MatchingStatut } from './enums';

export interface Matching {
  idMatching: number;
  demande: DemandeCourse;
  chauffeur: Chauffeur;
  statut: MatchingStatut;
  course?: Course;
  dateCreation?: string;
  dateModification?: string;
}

export interface MatchingNotification {
  idMatching: number;
  idDemande: number;
  adresseDepart: string;
  adresseArrivee: string;
  prixEstime: number;
  typeVehicule: string;
  distanceKm?: number;
  clientNom: string;
  tempsEstimeMinutes?: number;
}

export interface MatchingAcceptResponse {
  matching: Matching;
  course: Course;
  message: string;
}
