import { Component, OnInit } from '@angular/core';

import { CommunityService } from '../../../services/community.service';
import { AuthService } from '../../../services/auth.service';
import { Community } from '../../../models/community.model';
import { ForumConditionsService } from '../../../services/forum-conditions.service';
import { ActivatedRoute, Router } from '@angular/router';
@Component({
  selector: 'app-community-detail',
  templateUrl: './community-detail.component.html',
  styleUrls: ['./community-detail.component.css']
})
export class CommunityDetailComponent implements OnInit {

  community?: Community;
  currentUser?: { id: number; username: string } | null;
  infoMessage = '';
  errorMessage = '';
  agreeToRules: boolean = false;
  showConditionsModal = false;  // ← AJOUTER

  constructor(
    private route: ActivatedRoute,
    private router: Router,                            // ← AJOUTER
    private communityService: CommunityService,
    private authService: AuthService,
    private conditionsService: ForumConditionsService  // ← AJOUTER
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadCommunity();
  }

  private loadCommunity(): void {
    const id = Number(this.route.snapshot.params['id']);
    this.communityService.getById(id).subscribe((community) => {
      this.community = community;
    });
  }

  get membershipStatus(): 'approved' | 'pending' | 'none' {
    if (!this.community || !this.currentUser) return 'none';
    if (this.community.members?.some((m) => m.id === this.currentUser?.id)) return 'approved';
    const request = this.community.joinRequests?.find((item) => item.user.id === this.currentUser?.id);
    return request?.status === 'pending' ? 'pending' : 'none';
  }

  requestJoin(): void {
    if (!this.currentUser || !this.community) {
      this.errorMessage = 'Connectez-vous pour envoyer une demande au manager.';
      return;
    }
    this.communityService.requestJoin(this.community.id!, this.currentUser).subscribe(() => {
      this.infoMessage = 'Votre demande a été transmise à l\'administrateur.';
      this.loadCommunity();
    });
  }

  // ── NOUVELLES MÉTHODES ──────────────────────────────
  openConditionsModal(): void {
    console.log('community id:', this.community!.id);
  console.log('type:', typeof this.community!.id);
  console.log('hasAccepted:', this.conditionsService.hasAccepted(this.community!.id!))
  if (this.conditionsService.hasAccepted(this.community!.id!)) {
    this.router.navigate(['/communities', this.community?.id, 'forum']);
  } else {
    this.showConditionsModal = true;
  }
}


  onConditionsAccepted(): void {
  this.showConditionsModal = false;
  this.router.navigate(['/communities', this.community?.id, 'forum']);
}
}