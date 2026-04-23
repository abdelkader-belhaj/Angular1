import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommunityService } from '../../../services/community.service';
import { AuthService } from '../../../services/auth.service';
import { Community } from '../../../models/community.model';
import { interval } from 'rxjs';

@Component({
  selector: 'app-community-list',
  templateUrl: './community-list.component.html',
  styleUrls: ['./community-list.component.css']
})
export class CommunityListComponent implements OnInit {

  communities: Community[] = [];
  statusMessage = '';

  constructor(
    private communityService: CommunityService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCommunities();
    interval(5000).subscribe(() => {
      this.loadCommunities();
    });
  }

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  loadCommunities(): void {
    this.communityService.getAll().subscribe({
      next: (data) => {
        this.communities = data;
      },
      error: (err) => {
        console.error('ERROR:', err);
      }
    });
  }

  goToCommunity(id: number): void {
    this.router.navigate(['/communities', id]);
  }

  getUserRequestStatus(community: Community): 'approved' | 'pending' | 'none' {
    const userId = this.currentUser?.id;
    if (!userId) {
      return 'none';
    }

    if (community.members?.some((member) => member.id === userId)) {
      return 'approved';
    }

    const request = community.joinRequests?.find((item) => item.user.id === userId);
    if (request?.status === 'pending') {
      return 'pending';
    }

    return 'none';
  }

  handleJoinClick(event: Event, community: Community): void {
    event.stopPropagation();
    const status = this.getUserRequestStatus(community);

    if (status === 'approved') {
      this.goToCommunity(community.id!);
      return;
    }

    if (!this.currentUser) {
      this.statusMessage = 'Connectez-vous pour envoyer une demande de participation.';
      return;
    }

    if (status === 'pending') {
      this.statusMessage = 'Votre demande est déjà en attente pour cette communauté.';
      return;
    }

    this.communityService.requestJoin(community.id!, { id: this.currentUser.id, username: this.currentUser.username }).subscribe(() => {
      this.statusMessage = 'Demande envoyée au manager de la communauté.';
      this.loadCommunities();
    });
  }

  getJoinLabel(community: Community): string {
    const status = this.getUserRequestStatus(community);
    if (status === 'approved') {
      return 'Accéder au forum';
    }
    if (status === 'pending') {
      return 'Demande en attente';
    }
    return 'Rejoindre maintenant';
  }

  getGradient(category: string): string {
    const gradients: Record<string, string> = {
      'Travel':     'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      'Food':       'linear-gradient(135deg, #2d1b00 0%, #5c3317 50%, #8b4513 100%)',
      'Tech':       'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 50%, #16213e 100%)',
      'Sport':      'linear-gradient(135deg, #003300 0%, #004d00 50%, #006600 100%)',
      'Art':        'linear-gradient(135deg, #1a0033 0%, #330066 50%, #4d0099 100%)',
      'Music':      'linear-gradient(135deg, #1a0000 0%, #330000 50%, #660000 100%)',
    };
    return gradients[category] ?? 'linear-gradient(135deg, #1c1c1c 0%, #2d2d2d 100%)';
  }

  getImage(category: string): string {
    const images: Record<string, string> = {
      'Tourisme':    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
      'Culture':     'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=800&q=80',
      'Sport':       'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
      'Gastronomie': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
      'Tech':        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
      'Art':         'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&q=80',
      'Music':       'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
      'Travel':      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
    };
    return images[category] ?? 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80';
  }
}