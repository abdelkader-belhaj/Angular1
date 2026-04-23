// src/app/event/components/ticket/ticket.component.ts

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import html2canvas from 'html2canvas';

import { EventReservation, EventTicket, EventVisionAnalysisResult } from '../../models/event.model';
import { ReservationService } from '../../../services/events/reservation.service';
import { AuthService }        from '../../../services/auth.service';

type PrintableTicket = {
  ticketCode?: string;
  ticketNumber: number;
  status: EventTicket['status'];
};

@Component({
  selector:    'app-ticket',
  templateUrl: './ticket.component.html',
  styleUrls:   ['./ticket.component.css'],
})
export class TicketComponent implements OnInit {

  reservation: EventReservation | null = null;
  tickets: EventTicket[] = [];
  loading  = true;
  errorMsg = '';

  isAlreadyUsed = false;
  isAnalyzing = false;
  visionResult: { success: boolean; title: string; message: string; extracted?: string | null } | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly refreshIntervalMs = 5000;
  private reservationId = 0;

  private readonly printTicketFallback: PrintableTicket = {
    ticketCode: undefined,
    ticketNumber: 1,
    status: 'AVAILABLE' as const,
  };

  get isAdmin():        boolean { return this.auth.isAdmin(); }
  get isOrganisateur(): boolean { return this.auth.isOrganisateur?.() ?? false; }
  get canScan():        boolean { return this.isAdmin || this.isOrganisateur; }

  constructor(
    private readonly route:      ActivatedRoute,
    private readonly resService: ReservationService,
    private readonly auth:       AuthService,
    private readonly router:     Router,
    public  readonly location:   Location,
  ) {}

  ngOnInit(): void {
    const id = +this.route.snapshot.paramMap.get('reservationId')!;
    this.reservationId = id;
    this.autoValidateFromQrLink();

    this.loadReservation(id, true);
    this.refreshTimer = setInterval(() => this.loadReservation(this.reservationId, false), this.refreshIntervalMs);
    window.addEventListener('focus', this.refreshOnFocus);
    document.addEventListener('visibilitychange', this.refreshOnVisibility);
  }

  private autoValidateFromQrLink(): void {
    if (!this.canScan) return;

    const query = this.route.snapshot.queryParamMap;
    const rawCode = query.get('code');
    const scanFlag = query.get('scan');

    if (rawCode && rawCode.trim().length > 0) {
      this.scanTicket(decodeURIComponent(rawCode.trim()));
      return;
    }

    // Fallback: old QR links may only contain ?scan=1
    if (scanFlag === '1' && this.reservationId > 0 && !this.isAnalyzing) {
      this.isAnalyzing = true;
      this.resService.scanQr(this.reservationId).subscribe({
        next: (result) => {
          this.visionResult = {
            success: result.valid,
            title: result.valid ? 'Ticket validé' : 'Ticket invalide',
            message: result.message,
          };
          this.loadReservation(this.reservationId, false);
          this.isAnalyzing = false;
        },
        error: () => {
          this.visionResult = {
            success: false,
            title: 'Erreur scan',
            message: 'Impossible de valider ce ticket pour le moment.',
          };
          this.isAnalyzing = false;
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    window.removeEventListener('focus', this.refreshOnFocus);
    document.removeEventListener('visibilitychange', this.refreshOnVisibility);
  }

  get isEntryValidated(): boolean {
    if (this.tickets.length > 0) {
      return this.tickets.every(t => t.used || t.status === 'USED');
    }
    return !!this.reservation?.qrUsed;
  }

  get canPrint(): boolean {
    return !this.isAdmin && !this.isOrganisateur;
  }

  get showPendingPaymentWarning(): boolean {
    if (!this.reservation) return false;
    return this.reservation.status === 'PENDING' && this.canPrint;
  }

  private loadReservation(id: number, firstLoad: boolean): void {
    this.resService.getById(id).subscribe({
      next: (r: EventReservation) => {
        // 🔐 SÉCURITÉ: Vérifier que l'utilisateur est propriétaire du ticket
        const currentUser = this.auth.getCurrentUser();
        const currentUserId = currentUser?.id;
        const reservationUserId = r.userId;

        // L'utilisateur est propriétaire si:
        // 1. C'est un admin/organisateur, OU
        // 2. L'ID de l'utilisateur correspond à celui du ticket
        const isOwner = this.isAdmin || this.isOrganisateur || (currentUserId === reservationUserId);

        if (!isOwner) {
          // ❌ L'utilisateur n'a pas accès à ce ticket
          if (firstLoad) this.loading = false;
          this.errorMsg = '❌ Vous n\'avez pas accès à ce ticket.';
          return;
        }

        this.reservation = r;
        this.isAlreadyUsed = !!r.qrUsed;
        this.loadTickets(r.id);
        if (firstLoad) this.loading = false;
      },
      error: () => {
        if (firstLoad) this.loading = false;
        this.errorMsg = 'Ticket introuvable.';
      },
    });
  }

  private loadTickets(reservationId: number): void {
    this.resService.getTicketsByReservation(reservationId).subscribe({
      next: (items) => {
        this.tickets = items ?? [];
        this.isAlreadyUsed = this.isEntryValidated;
      },
      error: () => {
        this.tickets = [];
      },
    });
  }

  qrUrl(ticketCode?: string): string {
    const payload = ticketCode && ticketCode.trim().length > 0
      ? `${this.getPublicOrigin()}/ticket/${this.reservationId}?code=${encodeURIComponent(ticketCode)}`
      : `${this.getPublicOrigin()}/ticket/${this.reservationId}?scan=1`;
    const encoded = encodeURIComponent(payload);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}`;
  }

  scanTicket(ticketCode: string): void {
    if (!ticketCode || this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.resService.scanTicketByCode(ticketCode).subscribe({
      next: (result) => {
        this.visionResult = {
          success: result.valid,
          title: result.valid ? 'Ticket validé' : 'Ticket invalide',
          message: result.message,
        };
        this.loadReservation(this.reservationId, false);
        this.isAnalyzing = false;
      },
      error: () => {
        this.visionResult = {
          success: false,
          title: 'Erreur scan',
          message: 'Impossible de scanner ce ticket pour le moment.',
        };
        this.isAnalyzing = false;
      },
    });
  }

  private refreshOnFocus = (): void => {
    if (this.reservationId > 0) {
      this.loadReservation(this.reservationId, false);
    }
  };

  private refreshOnVisibility = (): void => {
    if (!document.hidden && this.reservationId > 0) {
      this.loadReservation(this.reservationId, false);
    }
  };

  private getPublicOrigin(): string {
    // If Angular runs on localhost, force LAN URL so phones on same Wi-Fi can open it.
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://192.168.10.166:4200';
    }
    return window.location.origin;
  }

  goBack(): void { this.location.back(); }

  goToPayment(): void {
    if (!this.reservation) return;
    void this.router.navigate(['/payment', this.reservation.id]);
  }

  async analyzeTicketWithVisionAI(): Promise<void> {
    if (!this.reservation || this.isAlreadyUsed || this.isAnalyzing) return;

    this.isAnalyzing = true;
    this.visionResult = null;

    try {
      const ticketElement = document.querySelector('.ticket') as HTMLElement | null;
      if (!ticketElement) {
        throw new Error('Ticket non trouvé');
      }

      const canvas = await html2canvas(ticketElement, {
        backgroundColor: '#ffffff',
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
      });

      const base64Image = canvas.toDataURL('image/jpeg', 0.88);

      const response = await firstValueFrom(
        this.resService.analyzeTicketWithAI(base64Image, this.reservation.id)
      );

      this.applyVisionResult(response);
    } catch {
      this.visionResult = {
        success: false,
        title: 'Erreur IA Vision',
        message: 'Impossible d\'analyser le ticket pour le moment.',
      };
    } finally {
      this.isAnalyzing = false;
    }
  }

  private applyVisionResult(response: EventVisionAnalysisResult): void {
    this.visionResult = {
      success: response.valid,
      title: response.valid ? 'Validation réussie par IA Vision' : 'Validation échouée',
      message: response.message,
      extracted: response.extractedData ?? null,
    };

    if (response.valid && this.reservation) {
      this.isAlreadyUsed = true;
      this.reservation.qrUsed = true;
      this.loadReservation(this.reservationId, false);
      this.loadTickets(this.reservation.id);
    }
  }

  print():  void {
    if (!this.reservation) return;

    const popup = window.open('', '_blank', 'width=900,height=1200');
    if (!popup) {
      window.print();
      return;
    }

    const ticketsToPrint: PrintableTicket[] =
      this.tickets.length > 0
        ? this.tickets
        : [{
            ...this.printTicketFallback,
            status: this.reservation.status === 'CANCELLED' ? 'CANCELLED' : this.printTicketFallback.status,
          }];

    popup.document.write(`
      <!doctype html>
      <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Billet ${this.reservation.eventTitle}</title>
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f6f9fc; color: #10223a; }
          .sheet { max-width: 820px; margin: 0 auto; }
          .card { width: 100%; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 35px rgba(0,0,0,.12); page-break-after: always; }
          .card:last-child { page-break-after: auto; }
          .head { background: linear-gradient(135deg,#003974,#0b5ea7); color: #fff; padding: 24px 28px; }
          .brand { font-size: 20px; font-weight: 800; }
          .label { margin-top: 6px; display: inline-block; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: .85; }
          .body { display: flex; gap: 22px; padding: 28px; align-items: flex-start; }
          .info { flex: 1; }
          h1 { margin: 0 0 14px; font-size: 24px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin-bottom: 16px; }
          .item { background: #f8fbff; border: 1px solid #dce8f3; border-radius: 12px; padding: 10px 12px; }
          .item small { display:block; color:#6b7d90; text-transform: uppercase; letter-spacing: .4px; font-size: 11px; margin-bottom: 4px; }
          .item b { font-size: 15px; }
          .status { display:inline-block; margin-top: 6px; padding: 10px 14px; border-radius: 12px; font-weight: 700; }
          .status.ok { background:#d1fae5; color:#065f46; }
          .status.wait { background:#fef3c7; color:#92400e; }
          .status.bad { background:#fee2e2; color:#991b1b; }
          .qr { width: 220px; text-align: center; }
          .qr img { width: 220px; height: 220px; border-radius: 14px; border: 3px solid #003974; background:#fff; padding: 6px; box-sizing: border-box; }
          .qr p { margin: 10px 0 0; font-size: 13px; color: #526173; }
          .qr .ticket-no { margin-top: 8px; font-size: 12px; font-weight: 700; color: #003974; }
          .foot { display:flex; justify-content: space-between; padding: 16px 28px 22px; background: #f8fbff; font-size: 12px; color: #7b8a9a; }
          @media print { body { background:#fff; padding:0; } .sheet { max-width:none; } .card { box-shadow:none; border-radius:0; margin:0; } }
        </style>
      </head>
      <body>
        <div class="sheet">
          ${ticketsToPrint.map((ticket, index) => {
            const ticketStatus = ticket.status === 'CANCELLED'
              ? 'Billet annulé'
              : ticket.status === 'USED'
                ? 'Entrée déjà validée'
                : this.reservation?.status === 'PENDING'
                  ? 'En attente de paiement'
                  : 'Billet confirmé - Présentez ce QR à l’entrée';

            const statusClass = ticket.status === 'CANCELLED'
              ? 'bad'
              : ticket.status === 'USED' || this.isEntryValidated
                ? 'ok'
                : 'wait';

            return `
              <div class="card">
                <div class="head">
                  <div class="brand">🌍 Looking Tunisia</div>
                  <div class="label">Billet électronique</div>
                </div>
                <div class="body">
                  <div class="info">
                    <h1>${this.escapeHtml(this.reservation!.eventTitle)}</h1>
                    <div class="grid">
                      <div class="item"><small>Nom</small><b>${this.escapeHtml(this.reservation!.userName)}</b></div>
                      <div class="item"><small>Billet</small><b>${index + 1}/${ticketsToPrint.length}</b></div>
                      <div class="item"><small>Total billets</small><b>${this.reservation!.numberOfTickets}</b></div>
                      <div class="item"><small>Total payé</small><b>${this.reservation!.totalPrice.toFixed(0)} TND</b></div>
                      <div class="item"><small>Réservé le</small><b>${new Date(this.reservation!.reservationDate).toLocaleDateString('fr-FR')}</b></div>
                      <div class="item"><small>Code billet</small><b>${ticket.ticketCode ? this.escapeHtml(ticket.ticketCode.slice(0, 10) + '…') : 'N/A'}</b></div>
                    </div>
                    <div class="status ${statusClass}">${ticketStatus}</div>
                  </div>
                  <div class="qr">
                    <img src="${this.qrUrl(ticket.ticketCode)}" alt="QR Code billet ${index + 1}" />
                    <div class="ticket-no">Ticket #${ticket.ticketNumber}</div>
                    <p>Présentez ce QR à l’entrée</p>
                  </div>
                </div>
                <div class="foot">
                  <span>Billet numérique sécurisé</span>
                  <span>TunisiaTour © 2026</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();

    const waitForImages = async (): Promise<void> => {
      const images = Array.from(popup.document.images);
      await Promise.all(images.map((image) => new Promise<void>((resolve) => {
        if (image.complete) {
          resolve();
          return;
        }

        image.onload = () => resolve();
        image.onerror = () => resolve();
      })));
    };

    void waitForImages().then(() => {
      setTimeout(() => {
        popup.print();
        popup.close();
      }, 250);
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}