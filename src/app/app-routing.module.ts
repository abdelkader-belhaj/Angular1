import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
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
import { SocietePageComponent } from './societe/societe-page.component';
import { ProfilePageComponent } from './profile/profile-page.component';
import { SecurityPageComponent } from './security/security-page.component';
import { AdminUsersPageComponent } from './dashbord/admin-users/admin-users-page.component';
import { WaitingResponsePageComponent } from './waiting-response/waiting-response-page.component';
import { ArtisanDashboardComponent } from './ecommerce/artisan/pages/artisan-dashboard.component';
import { ManageProductsComponent } from './ecommerce/artisan/pages/manage-products.component';
import { ArtisanSalesComponent } from './ecommerce/artisan/pages/artisan-sales.component';
import { ProductsPageComponent } from './ecommerce/products/pages/products-page.component';
import { CartComponent } from './ecommerce/cart/cart.component';
import { CheckoutComponent } from './ecommerce/checkout/checkout.component';
import { MyOrdersPageComponent } from './ecommerce/orders/pages/my-orders-page.component';
import { OrderConfirmationPageComponent } from './ecommerce/orders/pages/order-confirmation-page.component';
import { OrderDetailPageComponent } from './ecommerce/orders/pages/order-detail-page.component';
import { MarketplacePageComponent } from './dashbord/marketplace/marketplace-page.component';
import { DealsPageComponent } from './ecommerce/deals/pages/deals-page.component';
import { MyFavoritesPageComponent } from './ecommerce/deals/pages/my-favorites-page.component';

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
  { path: 'dashbord/Market-place', component: MarketplacePageComponent, canActivate: [adminGuard] },
  { path: 'dashboard/Market-place', component: MarketplacePageComponent, canActivate: [adminGuard] },
  { path: 'hebergeur', component: HebergeurPageComponent, canActivate: [roleGuard], data: { roles: ['HEBERGEUR'] } },
  { path: 'transporteur', component: TransporteurPageComponent, canActivate: [roleGuard], data: { roles: ['TRANSPORTEUR'] } },
  { path: 'airline-partner', component: AirlinePartnerPageComponent, canActivate: [roleGuard], data: { roles: ['AIRLINE_PARTNER'] } },
  { path: 'organisateur', component: OrganisateurPageComponent, canActivate: [roleGuard], data: { roles: ['ORGANISATEUR'] } },
  { path: 'artisan', component: ArtisanDashboardComponent, canActivate: [roleGuard], data: { roles: ['VENDEUR_ARTI'] } },
  { path: 'artisan/products', component: ManageProductsComponent, canActivate: [roleGuard], data: { roles: ['VENDEUR_ARTI'] } },
  { path: 'artisan/sales', component: ArtisanSalesComponent, canActivate: [roleGuard], data: { roles: ['VENDEUR_ARTI'] } },
  { path: 'products', component: ProductsPageComponent },
  { path: 'deals', component: DealsPageComponent },
  { path: 'my-favorites', component: MyFavoritesPageComponent, canActivate: [authGuard] },
  { path: 'cart', component: CartComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'my-orders', component: MyOrdersPageComponent, canActivate: [authGuard] },
  { path: 'order-confirmation/:id', component: OrderConfirmationPageComponent, canActivate: [authGuard] },
  { path: 'orders/:id', component: OrderDetailPageComponent, canActivate: [authGuard] },
  { path: 'societe', component: SocietePageComponent, canActivate: [roleGuard], data: { roles: ['SOCIETE'] } },
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
