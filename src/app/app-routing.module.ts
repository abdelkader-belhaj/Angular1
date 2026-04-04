import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePageComponent } from './homePage/home-page.component';
import { DashbordPageComponent } from './dashbord/dashbord-page.component';
import { adminGuard } from './guards/admin.guard';
import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';

const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'dashbord', component: DashbordPageComponent, canActivate: [adminGuard] },
  { path: 'dashboard', component: DashbordPageComponent, canActivate: [adminGuard] },
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
