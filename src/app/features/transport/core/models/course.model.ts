// src/app/features/transport/core/models/course.model.ts
import { Chauffeur } from './chauffeur.model';
import { DemandeCourse } from './demande-course.model';
import { Matching } from './matching.model';
import { Localisation } from './localisation.model';
import { Vehicule } from './vehicule.model';
import { PaiementTransport } from './paiement.model';
import { EvaluationTransport } from './evaluation.model';
import { AnnulationTransport } from './annulation.model';
import { CourseStatus } from './enums';

export interface Course {
  idCourse: number;
  demande: DemandeCourse;
  matching?: Matching;
  chauffeur: Chauffeur;
  vehicule: Vehicule;
  localisationDepart: Localisation;
  localisationArrivee: Localisation;
  statut: CourseStatus;
  prixFinal?: number;
  montantCommission?: number;
  dateCreation?: string;
  dateModification?: string;

  // Relations optionnelles
  paiementTransport?: PaiementTransport;
  evaluationTransports?: EvaluationTransport[];
  annulationTransport?: AnnulationTransport;
}

export interface CourseStartRequest {
  idCourse: number;
}

export interface CourseCompleteResponse {
  course: Course;
  paiement: PaiementTransport;
  montantNetChauffeur: number;
}

export interface CourseEnCours {
  idCourse: number;
  clientNom: string;
  clientTelephone?: string;
  adresseDepart: string;
  adresseArrivee: string;
  prixEstime: number;
  statut: CourseStatus;
  heureDebut?: string;
}
