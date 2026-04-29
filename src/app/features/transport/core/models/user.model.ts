// src/app/features/transport/core/models/user.model.ts
import { Role } from './enums';

export interface User {
  id: number;
  username: string;
  email: string;
  password?: string; // Optionnel en réponse
  enabled: boolean;
  role: Role;
  phone?: string;
  bio?: string;
  profileImage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserMinimal {
  id: number;
  username: string;
  email: string;
  phone?: string;
}
