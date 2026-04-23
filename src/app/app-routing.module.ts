import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomePageComponent } from './homePage/home-page.component';
import { DashbordPageComponent } from './dashbord/dashbord-page.component';
import { adminGuard } from './guards/admin.guard';
import { roleGuard } from './guards/role.guard';
import { authGuard } from './guards/auth.guard';
import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';

import { HebergeurPageComponent } from './hebergeur/hebergeur-page.component';
import { AirlinePartnerPageComponent } from './airline_partner/airline-partner-page.component';
import { OrganisateurPageComponent } from './organisateur/organisateur-page.component';
import { VendeurArtPageComponent } from './vendeur_art/vendeur-art-page.component';
import { SocietePageComponent } from './societe/societe-page.component';
import { ReclamationsSocieteComponent } from './societe/reclamations/reclamations-societe.component';

import { ProfilePageComponent } from './profile/profile-page.component';
import { SecurityPageComponent } from './security/security-page.component';

import { AdminUsersPageComponent } from './dashbord/admin-users/admin-users-page.component';
import { WaitingResponsePageComponent } from './waiting-response/waiting-response-page.component';
import { TransportStatsComponent } from './dashbord/transport-stats/transport-stats.component';

import { VolsListComponent } from './homePage/vols-list.component';
import { MesReservationsComponent } from './homePage/mes-reservations.component';
import { StatistiquesPageComponent } from './statistiques/statistiques-page.component';
import { BilletComponent } from './billet/billet.component';
import { NouvelleReclamationComponent } from './homePage/reclamations/nouvelle-reclamation.component';
import { MesReclamationsComponent } from './homePage/reclamations/mes-reclamations.component';
import { TransporteurPageComponent } from './transporteur/transporteur-page.component';

const routes: Routes = [
  { path: '', component: HomePageComponent },

  {
    path: 'homePage',
    component: HomePageComponent,
    canActivate: [roleGuard],
    data: { roles: ['CLIENT_TOURISTE'] },
  },

  { path: 'waiting-approval', component: WaitingResponsePageComponent },
  { path: 'reset-password', component: ResetPasswordComponent },

  { path: 'vols', component: VolsListComponent },
  { path: 'mes-reservations', component: MesReservationsComponent },
  {
    path: 'reclamations/nouvelle',
    component: NouvelleReclamationComponent,
    canActivate: [roleGuard],
    data: { roles: ['CLIENT_TOURISTE'] },
  },
  {
    path: 'reclamations/mes',
    component: MesReclamationsComponent,
    canActivate: [roleGuard],
    data: { roles: ['CLIENT_TOURISTE'] },
  },

  {
    path: 'profile',
    component: ProfilePageComponent,
    canActivate: [authGuard],
  },
  {
    path: 'security',
    component: SecurityPageComponent,
    canActivate: [authGuard],
  },

  {
    path: 'dashbord',
    component: DashbordPageComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'dashboard',
    component: DashbordPageComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'dashbord/users',
    component: AdminUsersPageComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'dashboard/users',
    component: AdminUsersPageComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'dashbord/transport-stats',
    component: TransportStatsComponent,
    canActivate: [adminGuard],
  },
  {
    path: 'dashboard/transport-stats',
    component: TransportStatsComponent,
    canActivate: [adminGuard],
  },

  {
    path: 'hebergeur',
    component: HebergeurPageComponent,
    canActivate: [roleGuard],
    data: { roles: ['HEBERGEUR'] },
  },
  {
    path: 'transporteur',
    component: TransporteurPageComponent,
    canActivate: [roleGuard],
    data: { roles: ['TRANSPORTEUR'] },
  },
  {
    path: 'airline-partner',
    component: AirlinePartnerPageComponent,
    canActivate: [roleGuard],
    data: { roles: ['AIRLINE_PARTNER'] },
  },
  {
    path: 'organisateur',
    component: OrganisateurPageComponent,
    canActivate: [roleGuard],
    data: { roles: ['ORGANISATEUR'] },
  },
  {
    path: 'vendeur-arti',
    component: VendeurArtPageComponent,
    canActivate: [roleGuard],
    data: { roles: ['VENDEUR_ARTI'] },
  },
  {
    path: 'societe',
    component: SocietePageComponent,
    canActivate: [roleGuard],
    data: { roles: ['SOCIETE'] },
  },
  {
    path: 'societe/reclamations',
    component: ReclamationsSocieteComponent,
    canActivate: [roleGuard],
    data: { roles: ['SOCIETE'] },
  },
  {
    path: 'societe/statistiques',
    component: StatistiquesPageComponent,
    canActivate: [roleGuard],
    data: { roles: ['SOCIETE'] },
  },
  {
    path: 'transport',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/transport/transport/transport.module').then(
        (m) => m.TransportModule,
      ),
  },

  { path: 'billet/:reference', component: BilletComponent },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
