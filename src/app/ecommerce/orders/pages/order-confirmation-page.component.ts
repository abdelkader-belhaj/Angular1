import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../services/order.service';

@Component({
  selector: 'app-order-confirmation-page',
  templateUrl: './order-confirmation-page.component.html',
  styleUrls: ['./order-confirmation-page.component.css']
})
export class OrderConfirmationPageComponent implements OnInit {
  orderId: string | null = null;
  order: any = null;
  isLoading = true;

  constructor(
    private activatedRoute: ActivatedRoute,
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe((params) => {
      this.orderId = params.get('id');
      if (this.orderId) {
        this.loadOrder();
      }
    });
  }

  loadOrder(): void {
    if (!this.orderId) return;
    const orderId = Number(this.orderId);
    this.orderService.getOrderById(orderId).subscribe(
      (order) => {
        this.order = order;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading order:', error);
        this.isLoading = false;
      }
    );
  }

  printOrder(): void {
    window.print();
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }

  viewMyOrders(): void {
    this.router.navigate(['/my-orders']);
  }
}
