export interface Vol {
  id: number;
  societeNom: string;
  numero: string;
  depart: string;
  arrivee: string;
  dateDepart: string;
  heureDepart: string;
  prix: number;
  places: number;
  escales?: Escale[];
  offre?: { id: number; code: string; pourcentage: number; actif?: boolean; dateDebut?: string; dateFin?: string };
  retard?: number;
}

export interface Escale {
  id?: number;
  ville: string;
  duree: string;
}

export interface VolSearchParams {
  depart: string;
  arrivee: string;
  date: string;
}