import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommunityService } from '../../../services/community.service';
import { AuthService } from '../../../services/auth.service';
import { Community } from '../../../models/community.model';

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

  constructor(
    private route: ActivatedRoute,
    private communityService: CommunityService,
    private authService: AuthService
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
    if (!this.community || !this.currentUser) {
      return 'none';
    }
    if (this.community.members?.some((member) => member.id === this.currentUser?.id)) {
      return 'approved';
    }
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
}