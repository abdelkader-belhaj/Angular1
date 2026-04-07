export interface Forum {
  id?: number;
  title: string;
  content: string;
  createdAt?: string;
  status?: string;
  likesCount?: number;
  dislikesCount?: number;
  views?: number;
  flaggedByAI?: boolean;
  toxicityScore?: number;
  aiDecision?: string;
  containsForbiddenWords?: boolean;
  aiStatus?: string;
  aiReason?: string;

  community?: { id: number; name?: string };
  user?: { id: number; username?: string };
  comments?: any[];
  reactions?: any[];
  reviews?: any[];
}
