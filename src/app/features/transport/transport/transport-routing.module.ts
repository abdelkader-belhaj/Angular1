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
import { TransporteurOnboardingComponent } from '../pages/transporteur-onboarding/transporteur-onboarding.component';
import { transporteurOnboardingGuard } from '../core/guards/transporteur-onboarding.guard';

const routes: Routes = [
  {
    path: 'onboarding-transporteur',
    component: TransporteurOnboardingComponent,
  },
  {
    path: '',
    pathMatch: 'full',
    component: AccueilTransportComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  // --- Section Client ---
  {
    path: 'demander-course', // L'URL sera /transport/demander-course
    component: DemanderCourseComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'attente-chauffeur',
    component: AttenteChauffeurComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'course-active',
    component: CourseActiveComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'paiement-course',
    component: StripePaymentComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'historique-courses',
    component: HistoriqueCoursesComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  // --- Section Chauffeur ---
  {
    path: 'chauffeur-dashboard',
    component: TableauBordChauffeurComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'profil-chauffeur',
    component: ProfilChauffeurComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'gestion-vehicules',
    component: GestionVehiculesComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'chauffeur-course-active',
    component: CourseActiveChauffeurComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'chauffeur-attente-confirmation-client',
    component: AttenteConfirmationClientComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'chauffeur-historique-courses',
    component: HistoriqueCoursesChauffeurComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'chauffeur-portefeuille',
    component: PortefeuilleChauffeurComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'chauffeur-statistiques',
    component: StatistiquesChauffeurComponent,
    canActivate: [transporteurOnboardingGuard],
  },
  {
    path: 'location',
    canActivate: [transporteurOnboardingGuard],
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
