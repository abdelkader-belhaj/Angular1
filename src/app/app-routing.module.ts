import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePageComponent } from './homePage/home-page.component';
import { DashbordPageComponent } from './dashbord/dashbord-page.component';
import { HebergeurDashboardComponent } from './hebergeur/hebergeur-dashboard/hebergeur-dashboard.component';
import { adminGuard } from './guards/admin.guard';
import { hebergeurGuard } from './guards/hebergeur.guard';
import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';
import { CategorieComponent } from './dashbord/accommodation/categorie/categorie.component';
import { LogementComponent } from './dashbord/accommodation/logement/logement.component';
import { HebergeurHomeComponent } from './hebergeur/hebergeur-home/hebergeur-home.component';
import { HebergeurLogementCreateComponent } from './hebergeur/hebergeur-logement-create/hebergeur-logement-create.component';
import { HebergeurSettingsComponent } from './hebergeur/hebergeur-settings/hebergeur-settings.component';
import { HebergeurNotificationsComponent } from './hebergeur/hebergeur-notifications/hebergeur-notifications.component';
import { AccommodationsComponent } from './homePage/accommodations/accommodations.component';
import { LogementDetailsComponent } from './homePage/accommodations/logement-details/logement-details.component';
import { ProfileComponent } from './homePage/profile/profile.component';
import { MesReservationsComponent } from './homePage/mes-reservations/mes-reservations.component';
import { PaymentPageComponent } from './homePage/payment-page/payment-page.component';
import { PaymentSuccessComponent } from './homePage/payment-success/payment-success.component';
import { PaymentInvoiceComponent } from './homePage/payment-invoice/payment-invoice.component';
import { BookingsTableComponent } from './dashbord/bookings-table/bookings-table.component';
import { HebergeurReservationsComponent } from './hebergeur/hebergeur-reservations/hebergeur-reservations.component';
import { ReclamationsSpaceComponent } from './reclamations/reclamations-space.component';
const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'stays', component: AccommodationsComponent },
  { path: 'logement/:id', component: LogementDetailsComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'mes-reservations', component: MesReservationsComponent },
  { path: 'paiement', component: PaymentPageComponent },
  { path: 'paiement/succes', component: PaymentSuccessComponent },
  { path: 'paiement/facture/:reservationId', component: PaymentInvoiceComponent },
  { path: 'mes-reclamations', component: ReclamationsSpaceComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  {
    path: 'dashbord',
    component: DashbordPageComponent,
    canActivate: [adminGuard],
    children: [
      { path: 'categorie', component: CategorieComponent },
      { path: 'logements', component: LogementComponent },
      { path: 'reservations', component: BookingsTableComponent },
      { path: 'reclamations', component: ReclamationsSpaceComponent }
    ]
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
  { path: 'dashboard', redirectTo: 'dashbord', pathMatch: 'full' },
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
export class AppRoutingModule { }