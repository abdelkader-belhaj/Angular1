import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePageComponent } from './homePage/home-page.component';
import { DashbordPageComponent } from './dashbord/dashbord-page.component';
import { adminGuard } from './guards/admin.guard';
import { roleGuard } from './guards/role.guard';
import { authGuard } from './guards/auth.guard';
import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';
import { HebergeurPageComponent } from './hebergeur/hebergeur-page.component';
import { TransporteurPageComponent } from './transporteur/transporteur-page.component';
import { AirlinePartnerPageComponent } from './airline_partner/airline-partner-page.component';
import { OrganisateurPageComponent } from './organisateur/organisateur-page.component';
import { VendeurArtPageComponent } from './vendeur_art/vendeur-art-page.component';
import { SocietePageComponent } from './societe/societe-page.component';
import { ProfilePageComponent } from './profile/profile-page.component';
import { SecurityPageComponent } from './security/security-page.component';
import { AdminUsersPageComponent } from './dashbord/admin-users/admin-users-page.component';
import { WaitingResponsePageComponent } from './waiting-response/waiting-response-page.component';

// ← Chemins CORRECTS avec sous-dossiers
import { VolsListComponent } from './homePage/vols-list.component';
import { MesReservationsComponent } from './homePage/mes-reservations.component';

const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'homePage', component: HomePageComponent, canActivate: [roleGuard], data: { roles: ['CLIENT_TOURISTE'] } },
  { path: 'waiting-approval', component: WaitingResponsePageComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
<<<<<<< HEAD
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },
  { path: 'security', component: SecurityPageComponent, canActivate: [authGuard] },
=======
  { path: 'vols', component: VolsListComponent },
  { path: 'mes-reservations', component: MesReservationsComponent },
>>>>>>> 1c9cf85 (dashbord)
  { path: 'dashbord', component: DashbordPageComponent, canActivate: [adminGuard] },
  { path: 'dashboard', component: DashbordPageComponent, canActivate: [adminGuard] },
  { path: 'dashbord/users', component: AdminUsersPageComponent, canActivate: [adminGuard] },
  { path: 'dashboard/users', component: AdminUsersPageComponent, canActivate: [adminGuard] },
  { path: 'hebergeur', component: HebergeurPageComponent, canActivate: [roleGuard], data: { roles: ['HEBERGEUR'] } },
  { path: 'transporteur', component: TransporteurPageComponent, canActivate: [roleGuard], data: { roles: ['TRANSPORTEUR'] } },
  { path: 'airline-partner', component: AirlinePartnerPageComponent, canActivate: [roleGuard], data: { roles: ['AIRLINE_PARTNER'] } },
  { path: 'organisateur', component: OrganisateurPageComponent, canActivate: [roleGuard], data: { roles: ['ORGANISATEUR'] } },
  { path: 'vendeur-arti', component: VendeurArtPageComponent, canActivate: [roleGuard], data: { roles: ['VENDEUR_ARTI'] } },
  { path: 'societe', component: SocietePageComponent, canActivate: [roleGuard], data: { roles: ['SOCIETE'] } },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      anchorScrolling: 'enabled',
      scrollPositionRestoration: 'enabled',
      scrollOffset: [0, 88]
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}