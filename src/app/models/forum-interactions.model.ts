export interface Reaction {
  id?: number;
  type?: string;           // ex: 'LIKE' | 'DISLIKE' | 'LOVE' ...
  createdAt?: string;      // LocalDateTime → string ISO

  // Relations
  forum?: { id: number; title?: string };
  user?: { id: number; username?: string };
}

export interface ForumComment {
  id?: number;
  content: string;
  createdAt?: string;           // LocalDateTime → string ISO
  flaggedByAI?: boolean;
  aiStatus?: string;            // ex: 'APPROVED' | 'REJECTED' | 'PENDING'
  aiReason?: string;
  voiceUrl?: string;            // URL du message vocal
  voiceDuration?: number;       // Durée en secondes

  // Relations
  forum?: { id: number; title?: string };
  user?: { id: number; username?: string };
}

export interface Review {
  id?: number;
  rating?: number;         // ex: 1 à 5
  comment?: string;
  createdAt?: string;      // LocalDateTime → string ISO
  flaggedByAI?: boolean;
  status?: string;         // ex: 'APPROVED' | 'REJECTED' | 'PENDING'

  // Relations
  forum?: { id: number; title?: string };
  user?: { id: number; username?: string };
}