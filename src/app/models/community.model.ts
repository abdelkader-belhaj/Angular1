export interface Community {
  id?: number;
  name: string;
  description: string;
  category: string;
  createdAt?: string;
  createdBy?: number;
  totalPosts?: number;
  totalMembers?: number;
  aiModerationEnabled?: boolean;
  moderationLevel?: string;

  members?: Array<{ id: number; username: string }>;
  joinRequests?: Array<{
    id: number;
    communityId: number;
    user: { id: number; username: string };
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: string;
  }>;
  forums?: any[];
}
