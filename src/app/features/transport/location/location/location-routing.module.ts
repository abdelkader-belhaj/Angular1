import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { estClientGuard } from '../../core/guards/est-client.guard';
import { estAgenceGuard } from '../../core/guards/est-agence.guard';
import { LayoutAgenceComponent } from '../../layouts/layout-agence/layout-agence.component';

const routes: Routes = [
  // ========== ESPACE CLIENT ==========
  {
    path: 'client',
    canActivate: [estClientGuard],
    children: [
      { path: '', redirectTo: 'recherche', pathMatch: 'full' },
      {
        path: 'recherche',
        loadComponent: () =>
          import('../client/recherche-vehicule/recherche-vehicule.component').then(
            (c) => c.RechercheVehiculeComponent,
          ),
      },
      {
        path: 'reserver/:id',
        loadComponent: () =>
          import('../client/reserver-vehicule/reserver-vehicule.component').then(
            (c) => c.ReserverVehiculeComponent,
          ),
      },
      {
        path: 'vehicule/:id',
        loadComponent: () =>
          import('../client/detail-vehicule/detail-vehicule.component').then(
            (c) => c.DetailVehiculeComponent,
          ),
      },
      {
        path: 'mes-locations',
        loadComponent: () =>
          import('../client/mes-locations/mes-locations.component').then(
            (c) => c.MesLocationsComponent,
          ),
      },
      {
        path: 'detail/:id',
        loadComponent: () =>
          import('../client/detail-location/detail-location.component').then(
            (c) => c.DetailLocationComponent,
          ),
      },
    ],
  },

  // ========== ESPACE AGENCE ==========
  {
    path: 'agence',
    canActivate: [estAgenceGuard],
    component: LayoutAgenceComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../agence/tableau-bord-agence/tableau-bord-agence.component').then(
            (c) => c.TableauBordAgenceComponent,
          ),
      },
      {
        path: 'flotte',
        loadComponent: () =>
          import('../agence/gestion-flotte/gestion-flotte.component').then(
            (c) => c.GestionFlotteComponent,
          ),
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('../agence/liste-reservations/liste-reservations.component').then(
            (c) => c.ListeReservationsComponent,
          ),
      },
      {
        path: 'reservation/:id',
        loadComponent: () =>
          import('../agence/detail-reservation/detail-reservation.component').then(
            (c) => c.DetailReservationComponent,
          ),
      },
      {
        path: 'portefeuille',
        loadComponent: () =>
          import('../agence/portefeuille-agence/portefeuille-agence.component').then(
            (c) => c.PortefeuilleAgenceComponent,
          ),
      },
      {
        path: 'statistiques',
        loadComponent: () =>
          import('../agence/statistiques-agence/statistiques-agence.component').then(
            (c) => c.StatistiquesAgenceComponent,
          ),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LocationRoutingModule {}
