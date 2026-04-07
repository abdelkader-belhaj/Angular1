import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map } from 'rxjs';
import { Community } from '../models/community.model';
import { Forum } from '../models/forum.model';

export interface JoinRequest {
  id: number;
  communityId: number;
  user: { id: number; username: string };
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
}

interface CommunityRuntimeState {
  joinRequests: JoinRequest[];
  members: Array<{ id: number; username: string }>;
  forums: Forum[];
}

@Injectable({
  providedIn: 'root'
})
export class CommunityService {

  private apiUrl = 'http://localhost:8080/api/communities';
  private storageKey = 'communityRuntimeState';

  constructor(private http: HttpClient) {}

  private loadState(): Record<number, CommunityRuntimeState> {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
    } catch {
      return {};
    }
  }

  private saveState(state: Record<number, CommunityRuntimeState>): void {
    localStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  private ensureStateForCommunity(communityId: number): CommunityRuntimeState {
    const state = this.loadState();
    if (!state[communityId]) {
      state[communityId] = { joinRequests: [], members: [], forums: [] };
      this.saveState(state);
    }
    return state[communityId];
  }

  private mergeCommunityState(community: Community): Community {
    const runtime = this.ensureStateForCommunity(community.id!);
    return {
      ...community,
      joinRequests: [...runtime.joinRequests],
      members: [...runtime.members],
      forums: [...runtime.forums]
    };
  }

  private mergeCommunities(communities: Community[]): Community[] {
    return communities.map((community) => this.mergeCommunityState(community));
  }

  getAll(): Observable<Community[]> {
    return this.http.get<Community[]>(this.apiUrl).pipe(
      map((communities) => this.mergeCommunities(communities))
    );
  }

  getById(id: number): Observable<Community | undefined> {
    return this.getAll().pipe(
      map((communities) => communities.find((community) => community.id === id))
    );
  }

  create(community: Community): Observable<Community> {
    return this.http.post<Community>(this.apiUrl, community).pipe(
      map((created) => this.mergeCommunityState(created))
    );
  }

  update(id: number, community: Community): Observable<Community> {
    return this.http.put<Community>(`${this.apiUrl}/${id}`, community).pipe(
      map((updated) => this.mergeCommunityState(updated))
    );
  }

  delete(id: number): Observable<void> {
    return this.http
      .delete(`${this.apiUrl}/${id}`, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  requestJoin(communityId: number, user: { id: number; username: string }): Observable<JoinRequest> {
    const stateRoot = this.loadState();
    const state = stateRoot[communityId] ?? { joinRequests: [], members: [], forums: [] };
    const existing = state.joinRequests.find((request) => request.user.id === user.id);
    if (existing) {
      return of(existing);
    }

    const request: JoinRequest = {
      id: Date.now(),
      communityId,
      user,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    state.joinRequests.push(request);
    stateRoot[communityId] = state;
    this.saveState(stateRoot);
    return of(request);
  }

  approveJoin(communityId: number, userId: number): Observable<boolean> {
    const stateRoot = this.loadState();
    const state = stateRoot[communityId];
    if (!state) {
      return of(false);
    }
    const request = state.joinRequests.find((item) => item.user.id === userId);
    if (!request) {
      return of(false);
    }
    request.status = 'approved';
    if (!state.members.some((member) => member.id === userId)) {
      state.members.push({ id: userId, username: request.user.username });
    }
    stateRoot[communityId] = state;
    this.saveState(stateRoot);
    return of(true);
  }

  isMember(communityId: number, userId: number): boolean {
    const state = this.loadState()[communityId];
    return !!state?.members.some((member) => member.id === userId);
  }

  getJoinRequests(communityId: number): JoinRequest[] {
    const state = this.loadState()[communityId];
    return state?.joinRequests ?? [];
  }

  getAllPendingRequests(): JoinRequest[] {
    const state = this.loadState();
    return Object.values(state).flatMap((item) => item.joinRequests.filter((request) => request.status === 'pending'));
  }

  createForum(communityId: number, forum: Forum): Observable<Forum> {
    const stateRoot = this.loadState();
    const state = stateRoot[communityId] ?? { joinRequests: [], members: [], forums: [] };
    const newForum = {
      ...forum,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: forum.status ?? 'open',
      likesCount: forum.likesCount ?? 0,
      dislikesCount: forum.dislikesCount ?? 0,
      views: forum.views ?? 0,
      flaggedByAI: forum.flaggedByAI ?? false,
      toxicityScore: forum.toxicityScore ?? 0,
      aiDecision: forum.aiDecision ?? 'pending',
      containsForbiddenWords: forum.containsForbiddenWords ?? false,
      aiStatus: forum.aiStatus ?? 'pending',
      aiReason: forum.aiReason ?? '',
      comments: forum.comments ?? [],
      reviews: forum.reviews ?? [],
      reactions: forum.reactions ?? []
    };
    state.forums.unshift(newForum);
    stateRoot[communityId] = state;
    this.saveState(stateRoot);
    return of(newForum);
  }

  updateForum(communityId: number, forum: Forum): Observable<Forum> {
    const stateRoot = this.loadState();
    const state = stateRoot[communityId] ?? { joinRequests: [], members: [], forums: [] };
    const index = state.forums.findIndex((item) => item.id === forum.id);
    if (index >= 0) {
      state.forums[index] = {
        ...state.forums[index],
        ...forum,
        comments: state.forums[index].comments ?? [],
        reviews: state.forums[index].reviews ?? [],
        reactions: state.forums[index].reactions ?? []
      };
      stateRoot[communityId] = state;
      this.saveState(stateRoot);
      return of(state.forums[index]);
    }
    return of(forum);
  }

  deleteForum(communityId: number, forumId: number): Observable<boolean> {
    const stateRoot = this.loadState();
    const state = stateRoot[communityId] ?? { joinRequests: [], members: [], forums: [] };
    state.forums = state.forums.filter((forum) => forum.id !== forumId);
    stateRoot[communityId] = state;
    this.saveState(stateRoot);
    return of(true);
  }
}
