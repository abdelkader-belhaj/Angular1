export interface Categorie {
  idCategorie: number;
  nom: string;
  description: string;
}

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
}

export interface Logement {
  idLogement: number;
  categorie: Categorie;
  hebergeur: User;
  nom: string;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  videoUrl?: string;
  adresse: string;
  ville: string;
  prixNuit: number;
  capacite: number;
  disponible: boolean;
  latitude?: number;
  longitude?: number;
  dateCreation: string;
}
