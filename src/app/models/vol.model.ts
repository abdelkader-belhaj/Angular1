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
}

export interface VolSearchParams {
  depart: string;
  arrivee: string;
  date: string;
}