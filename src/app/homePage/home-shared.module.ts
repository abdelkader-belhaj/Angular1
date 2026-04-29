import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { NavbarComponent } from './navbar/navbar.component';
import { LoginDialogComponent } from './login-dialog/login-dialog.component';

@NgModule({
  declarations: [NavbarComponent, LoginDialogComponent],
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  exports: [NavbarComponent],
})
export class HomeSharedModule {}
