import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OrderService } from '../../../services/order.service';

@Component({
  selector: 'app-my-orders-page',
  templateUrl: './my-orders-page.component.html',
  styleUrls: ['./my-orders-page.component.css']
})
export class MyOrdersPageComponent implements OnInit {
  orders: any[] = [];
  isLoading = true;
  
  statusColors: { [key: string]: string } = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  };

  constructor(
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.orderService.getMyOrders().subscribe(
      (orders) => {
        this.orders = orders;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading orders:', error);
        this.isLoading = false;
      }
    );
  }

  viewOrder(orderId: number): void {
    this.router.navigate(['/order-detail', orderId]);
  }

  cancelOrder(orderId: number): void {
    if (confirm('Êtes-vous sûr de vouloir annuler cette commande?')) {
      this.orderService.cancelOrder(orderId).subscribe(
        () => {
          this.loadOrders();
        },
        (error) => {
          console.error('Error cancelling order:', error);
        }
      );
    }
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || 'bg-gray-100 text-gray-700';
  }
}
