// src/app/features/transport/core/models/message-transport.model.ts
import { Course } from './course.model';
import { User } from './user.model';

export interface MessageTransport {
  id?: number;
  course: Course;
  sender: User;
  contenu: string;
  dateEnvoi?: string;
  delivered: boolean;
  isRead: boolean;
  dateLecture?: string;
}

export interface ChatMessageDTO {
  id?: number;
  courseId: number;
  senderId: number;
  senderRole: string;
  contenu: string;
  dateEnvoi?: string;
  delivered?: boolean;
  isRead?: boolean;
  read?: boolean;
}

// Alias pour rétrocompatibilité
export type ChatMessageNDTO = ChatMessageDTO;

export interface MessageSendRequest {
  courseId: number;
  contenu: string;
}
