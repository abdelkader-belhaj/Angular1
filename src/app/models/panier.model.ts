import { Vol } from './vol.model';
import { TypeBillet } from './reservation.model';

export interface PanierItem {
  id: number;
  volAller: Vol;
  volRetour?: Vol | null;
  typeBillet: TypeBillet;
  nbPassagers: number;
  prixTotal: number;
  dateAjout: string;
}

export interface PanierRequest {
  volAllerId: number;
  volRetourId?: number | null;
  typeBillet: TypeBillet;
  nbPassagers: number;
}