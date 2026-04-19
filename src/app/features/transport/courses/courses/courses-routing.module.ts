import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LayoutChauffeurComponent } from '../../layouts/layout-chauffeur/layout-chauffeur.component';
import { TableauBordChauffeurComponent } from '../chauffeur/tableau-bord-chauffeur/tableau-bord-chauffeur.component';

const routes: Routes = [
  {
    path: 'chauffeur',
    component: LayoutChauffeurComponent,
    // canActivate: [EstChauffeurGuard],     ← temporairement désactivé pour test
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        component: TableauBordChauffeurComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CoursesRoutingModule {}
