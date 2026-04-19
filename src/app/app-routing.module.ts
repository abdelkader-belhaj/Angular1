import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePageComponent } from './homePage/home-page.component';
import { DashbordPageComponent } from './dashbord/dashbord-page.component';
import { adminGuard } from './guards/admin.guard';
import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';
<<<<<<< HEAD
=======
import { CommunityAdminComponent } from './dashbord/community-admin/community-admin.component';
import { CommunityDetailComponent } from './homePage/community/community-detail/community-detail.component';
import { ForumDetailComponent } from './homePage/forum/forum-detail/forum-detail.component';
>>>>>>> main

const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'dashbord', component: DashbordPageComponent, canActivate: [adminGuard] },
  { path: 'dashboard', component: DashbordPageComponent, canActivate: [adminGuard] },
<<<<<<< HEAD
=======
  { path: 'community-admin', component: CommunityAdminComponent },
  
  { path: 'communities/:id', component: CommunityDetailComponent },
  { path: 'communities/:id/forum', component: ForumDetailComponent },
>>>>>>> main
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
<<<<<<< HEAD
export class AppRoutingModule { }
=======
export class AppRoutingModule { }
>>>>>>> main
