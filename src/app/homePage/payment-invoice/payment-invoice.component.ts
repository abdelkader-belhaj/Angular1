import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentReceipt, PaymentRecordsService } from '../../services/payment/payment-records.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-payment-invoice',
  templateUrl: './payment-invoice.component.html',
  styleUrls: ['./payment-invoice.component.css']
})
export class PaymentInvoiceComponent implements OnInit {
  @ViewChild('invoiceContent') invoiceContent!: ElementRef;

  reservationId: number | null = null;
  receipt: PaymentReceipt | null = null;
  isDownloading = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly paymentRecordsService: PaymentRecordsService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const reservationId = Number(params.get('reservationId'));
      if (!Number.isFinite(reservationId) || reservationId <= 0) {
        this.reservationId = null;
        this.receipt = null;
        return;
      }

      this.reservationId = reservationId;
      this.receipt = this.paymentRecordsService.getReceiptByReservationId(reservationId);
    });
  }

  backToReservations(): void {
    void this.router.navigate(['/mes-reservations-logement']);
  }

  backToSuccess(): void {
    if (!this.reservationId) return;
    void this.router.navigate(['/paiement/succes'], {
      queryParams: { reservationId: this.reservationId }
    });
  }

  getInvoiceReference(): string {
    if (!this.receipt) return 'FACT-0000';

    const datePart = this.receipt.paidAtIso
      ? this.receipt.paidAtIso.slice(0, 10).replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const initials = (this.receipt.customerFullName || 'CL')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'CL';

    return `FACT-${datePart}-${initials}`;
  }

  async downloadPDF(): Promise<void> {
    if (!this.invoiceContent) return;
    this.isDownloading = true;
    try {
      const element = this.invoiceContent.nativeElement;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
      pdf.save(`Facture-${this.getInvoiceReference()}.pdf`);
    } finally {
      this.isDownloading = false;
    }
  }
}
