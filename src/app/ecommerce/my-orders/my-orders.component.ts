import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, CommonModule } from '@angular/common';
import { OrderService, Order } from '../../services/order.service';
import { HomeSharedModule } from '../../homePage/home-shared.module';

@Component({
  selector: 'app-my-orders',
  templateUrl: './my-orders.component.html',
  styleUrls: ['./my-orders.component.css'],
  standalone: true,
  imports: [CommonModule, DatePipe, HomeSharedModule],
  providers: [DatePipe]
})
export class MyOrdersComponent implements OnInit {
  orders: Order[] = [];
  isLoading = false;
  error: string | null = null;
  selectedOrder: Order | null = null;

  statusColors: { [key: string]: string } = {
    pending: '#ffc107',
    paid: '#28a745',
    shipped: '#17a2b8',
    delivered: '#20c997',
    cancelled: '#dc3545'
  };

  paymentStatusColors: { [key: string]: string } = {
    pending: '#ffc107',
    paid: '#28a745',
    failed: '#dc3545'
  };

  constructor(
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.error = null;

    this.orderService.getMyOrders().subscribe({
      next: (orders) => {
        this.orders = orders;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load orders';
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  viewOrder(order: Order): void {
    this.selectedOrder = order;
  }

  closeDetail(): void {
    this.selectedOrder = null;
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || '#999';
  }

  getPaymentStatusColor(status: string): string {
    return this.paymentStatusColors[status] || '#999';
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }

  getOrderTotal(order: Order): number {
    return order.orderDetails.reduce((sum, detail) => sum + detail.subtotal, 0);
  }
}
