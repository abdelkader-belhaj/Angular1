// src/app/features/transport/core/models/chauffeur.model.ts
import { User } from './user.model';
import { Vehicule } from './vehicule.model';
import { Localisation } from './localisation.model';
import { ChauffeurStatut, DisponibiliteStatut } from './enums';

export interface Chauffeur {
  idChauffeur: number;
  utilisateur?: User;
  utilisateurId?: number; // Transient pour le frontend
  nomAffichage?: string;
  emailAffichage?: string;
  photoProfil?: string;
  telephone: string;
  numeroLicence: string;
  statut: ChauffeurStatut;
  disponibilite: DisponibiliteStatut;
  noteMoyenne?: number;
  solde: number;
  positionActuelle?: Localisation;
  dateCreation?: string;
  dateModification?: string;
  version?: number;
  // Relations
  vehicules?: Vehicule[];
}

export interface ChauffeurDashboardStats {
  totalCoursesAujourdhui: number;
  totalCoursesSemaine: number;
  revenusAujourdhui: number;
  revenusSemaine: number;
  noteMoyenne: number;
  tempsEnLigneMinutes: number;
}

export interface ChauffeurUpdateRequest {
  telephone?: string;
  disponibilite?: DisponibiliteStatut;
  positionActuelle?: Localisation;
}

export interface ChauffeurRegistrationRequest {
  utilisateurId: number;
  telephone: string;
  numeroLicence: string;
}
