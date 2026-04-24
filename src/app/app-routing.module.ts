import { NgModule } from '@angular/core';

import { RouterModule, Routes } from '@angular/router';
 
import { HomePageComponent } from './homePage/home-page.component';

import { DashbordPageComponent } from './dashbord/dashbord-page.component';

import { HebergeurDashboardComponent } from './hebergeur/hebergeur-dashboard/hebergeur-dashboard.component';

import { adminGuard } from './guards/admin.guard';

import { hebergeurGuard } from './guards/hebergeur.guard';

import { roleGuard } from './guards/role.guard';

import { authGuard } from './guards/auth.guard';

import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';

import { CategorieComponent } from './dashbord/accommodation/categorie/categorie.component';

import { LogementComponent } from './dashbord/accommodation/logement/logement.component';

import { AccommodationsComponent } from './homePage/accommodations/accommodations.component';

import { LogementDetailsComponent } from './homePage/accommodations/logement-details/logement-details.component';

import { PaymentPageComponent } from './homePage/payment-page/payment-page.component';

import { PaymentSuccessComponent } from './homePage/payment-success/payment-success.component';

import { PaymentInvoiceComponent } from './homePage/payment-invoice/payment-invoice.component';

import { BookingsTableComponent } from './dashbord/bookings-table/bookings-table.component';

import { ReclamationsSpaceComponent } from './reclamations/reclamations-space.component';

import { HebergeurHomeComponent } from './hebergeur/hebergeur-home/hebergeur-home.component';

import { HebergeurLogementCreateComponent } from './hebergeur/hebergeur-logement-create/hebergeur-logement-create.component';

import { HebergeurSettingsComponent } from './hebergeur/hebergeur-settings/hebergeur-settings.component';

import { HebergeurNotificationsComponent } from './hebergeur/hebergeur-notifications/hebergeur-notifications.component';

import { HebergeurReservationsComponent } from './hebergeur/hebergeur-reservations/hebergeur-reservations.component';
 
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
 
import { CommunityAdminComponent } from './dashbord/community-admin/community-admin.component';

import { CommunityDetailComponent } from './homePage/community/community-detail/community-detail.component';

import { ForumDetailComponent } from './homePage/forum/forum-detail/forum-detail.component';
 
import { VolsListComponent } from './homePage/vols-list.component';

import { MesReservationsComponent } from './homePage/mes-reservations/mes-reservations.component';

import { MesReservationsComponent as MesReservationsVolComponent } from './homePage/mes-reservations.component';

import { StatistiquesPageComponent } from './statistiques/statistiques-page.component';

import { BilletComponent } from './billet/billet.component';

import { NouvelleReclamationComponent } from './homePage/reclamations/nouvelle-reclamation.component';

import { MesReclamationsComponent } from './homePage/reclamations/mes-reclamations.component';
import { TransporteurPageComponent } from './transporteur/transporteur-page.component';
 
const routes: Routes = [

  { path: '', component: HomePageComponent },
 
  { path: 'homePage', component: HomePageComponent, canActivate: [roleGuard], data: { roles: ['CLIENT_TOURISTE'] } },
 
  { path: 'waiting-approval', component: WaitingResponsePageComponent },

  { path: 'reset-password', component: ResetPasswordComponent },

  { path: 'stays', component: AccommodationsComponent },

  { path: 'logement/:id', component: LogementDetailsComponent },
 
  { path: 'mes-reservations-logement', component: MesReservationsComponent, canActivate: [roleGuard], data: { roles: ['CLIENT_TOURISTE'] } },
  { path: 'mes-reservations', component: MesReservationsVolComponent, canActivate: [roleGuard], data: { roles: ['CLIENT_TOURISTE'] } },
 
  { path: 'paiement', component: PaymentPageComponent, canActivate: [authGuard] },

  { path: 'paiement/succes', component: PaymentSuccessComponent, canActivate: [authGuard] },

  { path: 'paiement/facture/:reservationId', component: PaymentInvoiceComponent, canActivate: [authGuard] },
 
  { path: 'mes-reclamations', component: ReclamationsSpaceComponent, canActivate: [authGuard] },

  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },

  { path: 'security', component: SecurityPageComponent, canActivate: [authGuard] },
 
  { path: 'vols', component: VolsListComponent },
 
  { path: 'reclamations/nouvelle', component: NouvelleReclamationComponent, canActivate: [roleGuard], data: { roles: ['CLIENT_TOURISTE'] } },

  { path: 'reclamations/mes', component: MesReclamationsComponent, canActivate: [roleGuard], data: { roles: ['CLIENT_TOURISTE'] } },
 
  {

    path: 'dashbord',

    component: DashbordPageComponent,

    canActivate: [adminGuard],

    children: [

      { path: 'categorie', component: CategorieComponent },

      { path: 'categories', redirectTo: 'categorie', pathMatch: 'full' },

      { path: 'inventory', redirectTo: 'logements', pathMatch: 'full' },

      { path: 'calendrier', redirectTo: 'reservations', pathMatch: 'full' },

      { path: 'analytics', redirectTo: '', pathMatch: 'full' },

      { path: 'logements', component: LogementComponent },

      { path: 'reservations', component: BookingsTableComponent },

      { path: 'notifications', component: HebergeurNotificationsComponent },

      { path: 'reclamations', component: ReclamationsSpaceComponent }

    ]

  },
 
  { path: 'dashbord/users', component: AdminUsersPageComponent, canActivate: [adminGuard] },

  { path: 'dashboard', redirectTo: 'dashbord', pathMatch: 'full' },

  { path: 'dashboard/users', component: AdminUsersPageComponent, canActivate: [adminGuard] },
 
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

    component: HebergeurDashboardComponent,

    canActivate: [hebergeurGuard],

    children: [

      { path: '', pathMatch: 'full', component: HebergeurHomeComponent },

      { path: 'logements', component: LogementComponent },

      { path: 'logements/ajout', component: HebergeurLogementCreateComponent },

      { path: 'categories', component: CategorieComponent },

      { path: 'reservations', component: HebergeurReservationsComponent },

      { path: 'reclamations', component: ReclamationsSpaceComponent },

      { path: 'notifications', component: HebergeurNotificationsComponent },

      { path: 'parametres', component: HebergeurSettingsComponent }

    ]

  },
 
  { path: 'transporteur', component: TransporteurPageComponent, canActivate: [roleGuard], data: { roles: ['TRANSPORTEUR'] } },

  { path: 'airline-partner', component: AirlinePartnerPageComponent, canActivate: [roleGuard], data: { roles: ['AIRLINE_PARTNER'] } },

  { path: 'organisateur', component: OrganisateurPageComponent, canActivate: [roleGuard], data: { roles: ['ORGANISATEUR'] } },

  { path: 'vendeur-arti', component: VendeurArtPageComponent, canActivate: [roleGuard], data: { roles: ['VENDEUR_ARTI'] } },

  { path: 'societe', component: SocietePageComponent, canActivate: [roleGuard], data: { roles: ['SOCIETE'] } },
 
  { path: 'societe/reclamations', component: ReclamationsSocieteComponent, canActivate: [roleGuard], data: { roles: ['SOCIETE'] } },

  { path: 'societe/statistiques', component: StatistiquesPageComponent, canActivate: [roleGuard], data: { roles: ['SOCIETE'] } },
 
  {

    path: 'transport',

    canActivate: [authGuard],

    loadChildren: () =>

      import('./features/transport/transport/transport.module').then(m => m.TransportModule),

  },
 
  { path: 'billet/:reference', component: BilletComponent },
 
  { path: 'community-admin', component: CommunityAdminComponent },

  { path: 'communities/:id', component: CommunityDetailComponent },

  { path: 'communities/:id/forum', component: ForumDetailComponent },
 
  // 🔥 TOUJOURS À LA FIN

  { path: '**', redirectTo: '' }

];
 
@NgModule({

  imports: [RouterModule.forRoot(routes, {

    anchorScrolling: 'enabled',

    scrollPositionRestoration: 'enabled'

  })],

  exports: [RouterModule],

})

export class AppRoutingModule {}
 