// src/app/features/transport/core/models/evaluation.model.ts
import { Course } from './course.model';
import { User } from './user.model';
import { EvaluationType } from './enums';

export interface EvaluationTransport {
  idEvaluation: number;
  course: Course;
  courseId?: number;
  evaluateur: User;
  evalue: User;
  evaluateurId?: number; // Transient
  evalueId?: number; // Transient
  evaluateurNom?: string;
  evalueNom?: string;
  type: EvaluationType;
  note: number; // 1-5
  commentaire?: string;
  dateCreation?: string;
}

export interface EvaluationCreateRequest {
  courseId: number;
  evaluateurId: number;
  evalueId: number;
  type: EvaluationType;
  note: number;
  commentaire?: string;
}

export interface EvaluationRecue {
  idEvaluation: number;
  note: number;
  commentaire?: string;
  dateCreation: string;
  type: EvaluationType;
  evaluateurNom: string;
}
