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
  filteredOrders: any[] = [];
  isLoading = true;
  error: string | null = null;
  
  // Filtrage
  selectedStatus = '';
  sortOrder: 'ascending' | 'descending' = 'descending';

  // Pagination
  currentPage = 1;
  pageSize = 5;
  totalPages = 1;
  
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
    this.isLoading = true;
    this.error = null;
    
    this.orderService.getMyOrders().subscribe({
      next: (orders) => {
        console.log('Orders received:', orders);
        this.orders = orders || [];
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.error = 'Impossible de charger vos commandes. Veuillez réessayer.';
        this.orders = [];
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.orders];

    // Filtre par statut
    if (this.selectedStatus) {
      filtered = filtered.filter(order => order.status === this.selectedStatus);
    }

    // Tri par date
    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return this.sortOrder === 'descending' ? dateB - dateA : dateA - dateB;
    });

    // Pagination
    this.totalPages = Math.ceil(filtered.length / this.pageSize);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = 1;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.filteredOrders = filtered.slice(startIndex, startIndex + this.pageSize);
  }

  onStatusChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onSortChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyFilters();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyFilters();
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilters();
    }
  }

  resetFilters(): void {
    this.selectedStatus = '';
    this.sortOrder = 'descending';
    this.currentPage = 1;
    this.applyFilters();
  }

  get displayedOrdersCount(): string {
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.orders.filter(o => !this.selectedStatus || o.status === this.selectedStatus).length);
    const total = this.orders.filter(o => !this.selectedStatus || o.status === this.selectedStatus).length;
    return `${total > 0 ? start : 0}-${end} sur ${total}`;
  }

  get pages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }
selectedOrderId: number | null = null;

viewOrder(orderId: number): void {
  this.selectedOrderId = this.selectedOrderId === orderId ? null : orderId;
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

  downloadInvoice(orderId: number, orderNumber: string): void {
    this.orderService.downloadInvoicePDF(orderId).subscribe(
      (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `facture-${orderNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      (error) => {
        console.error('Error downloading invoice:', error);
        alert('Erreur lors du téléchargement de la facture');
      }
    );
  }

  getStatusColor(status: string): string {
    return this.statusColors[status] || 'bg-gray-100 text-gray-700';
  }
  getStatusLabel(status: string): string {
  const labels: { [key: string]: string } = {
    pending: 'En attente',
    paid: 'Payé',
    shipped: 'Expédié',
    delivered: 'Livré',
    cancelled: 'Annulé',
    confirmed: 'Confirmé'
  };
  return labels[status] || status;
}

getStatusIcon(status: string): string {
  const icons: { [key: string]: string } = {
    pending: 'schedule',
    paid: 'verified_user',
    shipped: 'local_shipping',
    delivered: 'check_circle',
    cancelled: 'cancel',
    confirmed: 'thumb_up'
  };
  return icons[status] || 'info';
}
}
