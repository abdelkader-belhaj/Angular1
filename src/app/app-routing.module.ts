import { NgModule } from '@angular/core';
import { RouterModule, Routes, UrlMatchResult, UrlSegment } from '@angular/router';
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
import { AdminEventsPageComponent } from './dashbord/organisateurs/pages/admin-events-page.component';

const eventDetailMatcher = (segments: UrlSegment[]): UrlMatchResult | null => {
  if (segments.length !== 2 || segments[0].path !== 'events') {
    return null;
  }

  const idSegment = segments[1].path;
  if (!/^\d+$/.test(idSegment)) {
    return null;
  }

  return {
    consumed: segments,
    posParams: {
      id: segments[1],
    },
  };
};

const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'homePage', component: HomePageComponent, canActivate: [roleGuard], data: { roles: ['CLIENT_TOURISTE'] } },
  { path: 'waiting-approval', component: WaitingResponsePageComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },
  { path: 'security', component: SecurityPageComponent, canActivate: [authGuard] },
  { path: 'dashbord', component: DashbordPageComponent, canActivate: [adminGuard] },
  { path: 'dashboard', component: DashbordPageComponent, canActivate: [adminGuard] },
  { path: 'dashbord/users', component: AdminUsersPageComponent, canActivate: [adminGuard] },
  { path: 'dashboard/users', component: AdminUsersPageComponent, canActivate: [adminGuard] },
  { path: 'dashbord/events', component: AdminEventsPageComponent, canActivate: [adminGuard] },
  { path: 'dashboard/events', component: AdminEventsPageComponent, canActivate: [adminGuard] },
  { path: 'hebergeur', component: HebergeurPageComponent, canActivate: [roleGuard], data: { roles: ['HEBERGEUR'] } },
  { path: 'transporteur', component: TransporteurPageComponent, canActivate: [roleGuard], data: { roles: ['TRANSPORTEUR'] } },
  { path: 'airline-partner', component: AirlinePartnerPageComponent, canActivate: [roleGuard], data: { roles: ['AIRLINE_PARTNER'] } },
  { path: 'organisateur', component: OrganisateurPageComponent, canActivate: [roleGuard], data: { roles: ['ORGANISATEUR'] } },
  { path: 'vendeur-arti', component: VendeurArtPageComponent, canActivate: [roleGuard], data: { roles: ['VENDEUR_ARTI'] } },
  { path: 'societe', component: SocietePageComponent, canActivate: [roleGuard], data: { roles: ['SOCIETE'] } },

  // ✅ Module Event (lazy loaded)
  {
    matcher: eventDetailMatcher,
    loadChildren: () => import('./event/components/event-detail/event-detail.module')
      .then(m => m.EventDetailModule),
  },
  {
    path: 'events',
    loadChildren: () => import('./event/event.module').then(m => m.EventModule),
  },
  {
    path: 'mes-reservations-event',
    loadChildren: () => import('./event/components/mes-reservations-event/mes-reservations-event.module')
      .then(m => m.MesReservationsEventModule),
  },
  {
    path: 'payment/:reservationId',
    loadChildren: () => import('./event/components/payment/payment-page.module')
      .then(m => m.PaymentPageModule),
  },
  {
    path: 'ticket/:reservationId',
    loadChildren: () => import('./event/components/ticket/ticket.module')
      .then(m => m.TicketModule),
    canActivate: [authGuard],
  },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    anchorScrolling: 'enabled',
    scrollPositionRestoration: 'enabled',
    scrollOffset: [0, 88],
  })],
  exports: [RouterModule],
})
export class AppRoutingModule {}