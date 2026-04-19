import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AccueilTransportComponent } from '../pages/accueil-transport/accueil-transport.component';
import { TableauBordChauffeurComponent } from '../courses/chauffeur/tableau-bord-chauffeur/tableau-bord-chauffeur.component';
import { ProfilChauffeurComponent } from '../courses/chauffeur/profil-chauffeur/profil-chauffeur.component';
import { GestionVehiculesComponent } from '../courses/chauffeur/gestion-vehicules/gestion-vehicules.component';
import { DemanderCourseComponent } from '../courses/client/demander-course/demander-course.component';
import { CourseActiveComponent } from '../courses/client/course-active/course-active.component';
import { AttenteChauffeurComponent } from '../courses/client/attente-chauffeur/attente-chauffeur.component';
import { HistoriqueCoursesComponent } from '../courses/client/historique-courses/historique-courses.component';
import { HistoriqueCoursesChauffeurComponent } from '../courses/chauffeur/historique-courses-chauffeur/historique-courses-chauffeur.component';
import { CourseActiveChauffeurComponent } from '../courses/chauffeur/course-active-chauffeur/course-active-chauffeur.component';
import { PortefeuilleChauffeurComponent } from '../courses/chauffeur/portefeuille-chauffeur/portefeuille-chauffeur.component';
import { AttenteConfirmationClientComponent } from '../courses/chauffeur/attente-confirmation-client/attente-confirmation-client.component';
import { StatistiquesChauffeurComponent } from '../courses/chauffeur/statistiques-chauffeur/statistiques-chauffeur.component';
import { StripePaymentComponent } from '../core/components/stripe-payment.component';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: AccueilTransportComponent,
  },
  // --- Section Client ---
  {
    path: 'demander-course', // L'URL sera /transport/demander-course
    component: DemanderCourseComponent,
  },
  {
    path: 'attente-chauffeur',
    component: AttenteChauffeurComponent,
  },
  {
    path: 'course-active',
    component: CourseActiveComponent,
  },
  {
    path: 'paiement-course',
    component: StripePaymentComponent,
  },
  {
    path: 'historique-courses',
    component: HistoriqueCoursesComponent,
  },
  // --- Section Chauffeur ---
  {
    path: 'chauffeur-dashboard',
    component: TableauBordChauffeurComponent,
  },
  {
    path: 'profil-chauffeur',
    component: ProfilChauffeurComponent,
  },
  {
    path: 'gestion-vehicules',
    component: GestionVehiculesComponent,
  },
  {
    path: 'chauffeur-course-active',
    component: CourseActiveChauffeurComponent,
  },
  {
    path: 'chauffeur-attente-confirmation-client',
    component: AttenteConfirmationClientComponent,
  },
  {
    path: 'chauffeur-historique-courses',
    component: HistoriqueCoursesChauffeurComponent,
  },
  {
    path: 'chauffeur-portefeuille',
    component: PortefeuilleChauffeurComponent,
  },
  {
    path: 'chauffeur-statistiques',
    component: StatistiquesChauffeurComponent,
  },
  {
    path: 'location',
    loadChildren: () =>
      import('../location/location/location.module').then(
        (m) => m.LocationModule,
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TransportRoutingModule {}
