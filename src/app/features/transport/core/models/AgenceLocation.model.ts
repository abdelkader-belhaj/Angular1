import { User } from './user.model';

export interface AgenceLocation {
  idAgence: number;
  utilisateur: User;
  nomAgence: string;
  telephone?: string;
  adresse?: string;
  statut: boolean;
  solde: number;
}
