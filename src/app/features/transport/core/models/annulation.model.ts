// src/app/features/transport/core/models/annulation.model.ts
import { Course } from './course.model';
import { AnnulePar } from './enums';

export interface AnnulationTransport {
  idAnnulation: number;
  course: Course;
  annulePar: AnnulePar;
  raison?: string;
  montantPenalite: number;
  montantRemboursement: number;
  dateCreation?: string;
  dateModification?: string;
}

export interface AnnulationRequest {
  courseId: number;
  annulePar: AnnulePar;
  raison?: string;
}

export interface AnnulationResponse {
  annulation: AnnulationTransport;
  message: string;
  montantRemboursement: number;
  penaliteAppliquee: boolean;
}
