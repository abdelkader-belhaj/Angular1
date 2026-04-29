import { Component, OnInit } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { CourseService } from '../../features/transport/core/services/course.service';
import { LocationService } from '../../features/transport/core/services/location.service';
import { PaiementService } from '../../features/transport/core/services/paiement.service';
import {
  AgenceLocation,
  Course,
  CourseStatus,
  EvaluationTransport,
  EvaluationType,
  Localisation,
  PaiementMethode,
  PaiementStatut,
  PaiementTransport,
  PaiementType,
  ReservationLocation,
  ReservationStatus,
} from '../../features/transport/core/models';

type TransportPaymentRow = PaiementTransport & {
  phasePaiement?: string;
  idCourse?: number;
  idReservationLocation?: number;
};

type RatingSummary = {
  name: string;
  average: number;
  count: number;
  badge: string;
  sample: string;
};

type ZoneSummary = {
  label: string;
  count: number;
};

/** Ligne agence enrichie pour le tableau (KPIs issus des réservations réelles). */
export type AgenceLocationStatsRow = AgenceLocation & {
  activeRentals: number;
  revenue: number;
  status: 'ACTIVE' | 'SUSPENDED';
};

@Component({
  selector: 'app-transport-stats',
  templateUrl: './transport-stats.component.html',
  styleUrls: ['./transport-stats.component.css'],
})
export class TransportStatsComponent implements OnInit {
  readonly CourseStatus = CourseStatus;
  readonly PaiementType = PaiementType;
  readonly PaiementStatut = PaiementStatut;

  activeTab: 'courses' | 'location' = 'courses';
  isLoading = true;

  totalRevenue = 0;
  /** Part du CA issue des courses terminées (graphiques / synthèse). */
  courseRevenueTotal = 0;
  /** Part du CA issue des locations (réservations comptabilisées). */
  locationRevenueTotal = 0;
  /** Commission totale encaissée par Tunisiatour. */
  commissionReceivedTotal = 0;
  /** Commission issue des courses terminées. */
  courseCommissionTotal = 0;
  /** Commission issue des locations finalisées. */
  locationCommissionTotal = 0;
  /** Montant net reversé après commission. */
  netPayoutTotal = 0;
  /** Nombre total de courses (tous statuts). */
  totalCourses = 0;
  /** Courses encore « ouvertes » (non terminées / non annulées). */
  openCoursesCount = 0;
  /** Chauffeurs assignés à une course acceptée, démarrée ou en cours. */
  activeDrivers = 0;
  /** Réservations de location actives (véhicule engagé), toutes agences. */
  totalRentedVehicles = 0;
  /** Nombre total de paiements chargés. */
  totalPayments = 0;
  /** Nombre de paiements finalisés. */
  completedPayments = 0;
  /** Nombre de paiements remboursés. */
  refundedPayments = 0;
  /** Nombre de paiements en attente. */
  pendingPayments = 0;

  /** Chauffeurs les mieux notés. */
  topChauffeurs: RatingSummary[] = [];
  /** Clients les mieux notés. */
  topClients: RatingSummary[] = [];
  /** Zones les plus sollicitées sur les courses terminées. */
  topZones: ZoneSummary[] = [];

  coursesList: Course[] = [];
  agencesList: AgenceLocationStatsRow[] = [];
  paymentsList: TransportPaymentRow[] = [];
  recentPayments: TransportPaymentRow[] = [];

  coursesStatusChart: Array<{
    label: string;
    value: number;
    width: number;
    class: string;
  }> = [];

  /** Chart.js — répartition des statuts (donut). */
  courseDoughnutData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }],
  };

  courseDoughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, padding: 14, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const total =
              (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0) || 1;
            const v = Number(ctx.raw) || 0;
            return `${ctx.label}: ${v} (${Math.round((v / total) * 100)}%)`;
          },
        },
      },
    },
    cutout: '62%',
  };

  /** Répartition du chiffre d'affaires global. */
  revenueSplitData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [
      { data: [], backgroundColor: ['#6366f1', '#14b8a6'], borderWidth: 0 },
    ],
  };

  revenueSplitOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, padding: 14 },
      },
    },
    cutout: '55%',
  };

  /** Répartition des commissions par type de paiement. */
  commissionSplitData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [
      { data: [], backgroundColor: ['#2563eb', '#f97316'], borderWidth: 0 },
    ],
  };

  commissionSplitOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, padding: 14 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = Number(ctx.raw) || 0;
            return `${ctx.label}: ${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} TND`;
          },
        },
      },
    },
    cutout: '55%',
  };

  /** Tendance des courses créées sur 7 jours. */
  courseTrendData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        label: 'Courses créées',
        data: [],
        fill: true,
        tension: 0.35,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.12)',
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
      },
    ],
  };

  courseTrendOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 45, font: { size: 10 } },
      },
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  /** Revenu par agence (barres horizontales). */
  agencyRevenueBarData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        label: 'Revenu (TND)',
        data: [],
        backgroundColor: 'rgba(99, 102, 241, 0.88)',
        borderRadius: 8,
      },
    ],
  };

  agencyRevenueBarOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} TND`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
        ticks: { font: { size: 10 } },
      },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  /** Locations actives par agence. */
  agencyRentalsBarData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        label: 'Locations actives',
        data: [],
        backgroundColor: 'rgba(20, 184, 166, 0.88)',
        borderRadius: 8,
      },
    ],
  };

  agencyRentalsBarOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 10 } },
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
      },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  topPerformanceBarData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        label: 'Note moyenne',
        data: [],
        backgroundColor: ['rgba(99, 102, 241, 0.88)'],
        borderRadius: 8,
      },
    ],
  };

  topPerformanceBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = Number(ctx.raw) || 0;
            return `Note moyenne: ${value.toFixed(2)} / 5`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 5,
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
      },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  topZoneBarData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        label: 'Courses',
        data: [],
        backgroundColor: 'rgba(20, 184, 166, 0.9)',
        borderRadius: 8,
      },
    ],
  };

  topZoneBarOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  /** Même périmètre que `revenueEstimate` dans `tableau-bord-agence`. */
  private readonly locationRevenueStatuses: ReservationStatus[] = [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CHECKOUT_PENDING,
    ReservationStatus.IN_PROGRESS,
    ReservationStatus.COMPLETED,
  ];

  /** Réservations où un véhicule est considéré comme loué / engagé. */
  private readonly locationActiveRentalStatuses: ReservationStatus[] = [
    ReservationStatus.CONFIRMED,
    ReservationStatus.DEPOSIT_HELD,
    ReservationStatus.CONTRACT_SIGNED,
    ReservationStatus.CHECKOUT_PENDING,
    ReservationStatus.IN_PROGRESS,
    ReservationStatus.ACTIVE,
  ];

  private readonly driverActiveCourseStatuses: CourseStatus[] = [
    CourseStatus.ACCEPTED,
    CourseStatus.STARTED,
    CourseStatus.IN_PROGRESS,
  ];

  constructor(
    private readonly courseService: CourseService,
    private readonly locationService: LocationService,
    private readonly paiementService: PaiementService,
  ) {}

  ngOnInit(): void {
    this.loadRealData();
  }

  loadRealData(): void {
    this.isLoading = true;

    forkJoin({
      courses: this.courseService.getAllCourses().pipe(
        catchError(() => of<unknown[]>([])),
        map((payload) => this.normalizeCourseList(payload)),
      ),
      agences: this.locationService
        .getAllAgences()
        .pipe(catchError(() => of<AgenceLocation[]>([]))),
      paiements: this.paiementService.getAllPaiements().pipe(
        catchError(() => of<unknown[]>([])),
        map((payload) => this.normalizePaymentList(payload)),
      ),
    })
      .pipe(
        switchMap(({ courses, agences, paiements }) => {
          const list = agences ?? [];
          if (!list.length) {
            return of({
              courses,
              paiements,
              agenceRows: [] as AgenceLocationStatsRow[],
            });
          }

          return forkJoin(
            list.map((agence) =>
              this.locationService
                .getReservationsByAgence(agence.idAgence)
                .pipe(catchError(() => of<ReservationLocation[]>([]))),
            ),
          ).pipe(
            map((reservationLists) => ({
              courses,
              paiements,
              agenceRows: list.map((agence, index) =>
                this.buildAgenceRow(agence, reservationLists[index] ?? []),
              ),
            })),
          );
        }),
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: ({ courses, agenceRows, paiements }) => {
          this.coursesList = courses;
          this.agencesList = agenceRows;
          this.paymentsList = [...paiements].sort((a, b) =>
            this.sortPaymentsDesc(a, b),
          );
          this.recentPayments = this.paymentsList.slice(0, 8);
          this.applyCourseAggregates(courses);
          this.applyGlobalAggregates(courses, agenceRows);
          this.applyPaymentAggregates(this.paymentsList);
          this.applyRecommendationAggregates(courses);
          this.rebuildCharts();
        },
        error: () => {
          this.coursesList = [];
          this.agencesList = [];
          this.paymentsList = [];
          this.recentPayments = [];
          this.resetAggregates();
          this.rebuildCharts();
        },
      });
  }

  getAgenceId(agency: AgenceLocationStatsRow): number {
    const raw = agency as unknown as { idAgence?: number; id?: number };
    return Number(raw.idAgence ?? raw.id ?? 0);
  }

  getChauffeurLabel(course: Course): string {
    const ch = course.chauffeur as unknown as
      | Record<string, unknown>
      | undefined;
    if (!ch) {
      return 'Non assigné';
    }
    const user = ch['utilisateur'] as Record<string, unknown> | undefined;
    const username = String(user?.['username'] ?? '').trim();
    if (username) {
      return username;
    }
    const nomAffichage = String(ch['nomAffichage'] ?? '').trim();
    if (nomAffichage) {
      return nomAffichage;
    }
    const nom = String(ch['nom'] ?? '').trim();
    const prenom = String(ch['prenom'] ?? '').trim();
    const combined = `${prenom} ${nom}`.trim();
    return combined || 'Chauffeur';
  }

  getClientLabel(course: Course): string {
    const demande = course.demande as unknown as
      | Record<string, unknown>
      | undefined;
    const fromDemande = demande?.['client'] as
      | Record<string, unknown>
      | undefined;
    const fromCourse = (course as unknown as Record<string, unknown>)[
      'client'
    ] as Record<string, unknown> | undefined;
    const client = fromDemande ?? fromCourse;
    if (!client) {
      return 'Client';
    }
    const username = String(client['username'] ?? '').trim();
    if (username) {
      return username;
    }
    const nom = String(client['nom'] ?? '').trim();
    const prenom = String(client['prenom'] ?? '').trim();
    const combined = `${prenom} ${nom}`.trim();
    return combined || 'Client';
  }

  getChauffeurId(course: Course): number | null {
    const ch = course.chauffeur as unknown as
      | Record<string, unknown>
      | undefined;
    if (!ch) {
      return null;
    }
    const idChauffeur = Number(ch['idChauffeur'] ?? ch['id']);
    if (Number.isFinite(idChauffeur) && idChauffeur > 0) {
      return idChauffeur;
    }
    const user = ch['utilisateur'] as Record<string, unknown> | undefined;
    const userId = Number(user?.['id']);
    return Number.isFinite(userId) && userId > 0 ? userId : null;
  }

  getCourseStatusLabel(statut: CourseStatus | string | undefined): string {
    const value = String(statut || '').toUpperCase() as CourseStatus;
    switch (value) {
      case CourseStatus.ACCEPTED:
        return 'Acceptée';
      case CourseStatus.STARTED:
        return 'Démarrée';
      case CourseStatus.IN_PROGRESS:
        return 'En cours';
      case CourseStatus.COMPLETED:
        return 'Terminée';
      case CourseStatus.CANCELLED:
        return 'Annulée';
      default:
        return value || '—';
    }
  }

  getCourseStatusClass(statut: CourseStatus | string | undefined): string {
    const value = String(statut || '').toUpperCase() as CourseStatus;
    switch (value) {
      case CourseStatus.IN_PROGRESS:
      case CourseStatus.STARTED:
        return 'in-progress';
      case CourseStatus.ACCEPTED:
        return 'accepted';
      case CourseStatus.COMPLETED:
        return 'completed';
      case CourseStatus.CANCELLED:
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  switchTab(tab: 'courses' | 'location'): void {
    this.activeTab = tab;
  }

  cancelCourse(id: number): void {
    this.courseService.cancelCourse(id).subscribe({
      next: () => this.loadRealData(),
      error: () => this.loadRealData(),
    });
  }

  suspendDriver(id: number): void {
    alert(`Fonctionnalité backend en attente pour le chauffeur ID : ${id}`);
  }

  suspendAgency(id: number): void {
    this.locationService.deactivateAgence(id).subscribe({
      next: () => {
        const agency = this.agencesList.find((a) => this.getAgenceId(a) === id);
        if (agency) {
          agency.status = 'SUSPENDED';
          (agency as AgenceLocation).statut = false;
        }
      },
    });
  }

  approveAgency(id: number): void {
    this.locationService.approveAgence(id).subscribe({
      next: () => {
        const agency = this.agencesList.find((a) => this.getAgenceId(a) === id);
        if (agency) {
          agency.status = 'ACTIVE';
          (agency as AgenceLocation).statut = true;
        }
      },
    });
  }

  private resetAggregates(): void {
    this.totalRevenue = 0;
    this.courseRevenueTotal = 0;
    this.locationRevenueTotal = 0;
    this.commissionReceivedTotal = 0;
    this.courseCommissionTotal = 0;
    this.locationCommissionTotal = 0;
    this.netPayoutTotal = 0;
    this.totalCourses = 0;
    this.openCoursesCount = 0;
    this.activeDrivers = 0;
    this.totalRentedVehicles = 0;
    this.totalPayments = 0;
    this.completedPayments = 0;
    this.refundedPayments = 0;
    this.pendingPayments = 0;
    this.topChauffeurs = [];
    this.topClients = [];
    this.topZones = [];
    this.coursesStatusChart = [];
  }

  private truncateLabel(text: string, maxLen: number): string {
    const t = String(text || '').trim();
    if (t.length <= maxLen) {
      return t || '—';
    }
    return `${t.slice(0, maxLen - 1)}…`;
  }

  private buildCourseTrendChart(courses: Course[]): void {
    const dayCount = 7;
    const labels: string[] = [];
    const keys: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
      labels.push(
        d.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
      );
    }

    const counts = new Map<string, number>();
    for (const k of keys) {
      counts.set(k, 0);
    }

    for (const course of courses) {
      const raw = course.dateCreation ?? course.dateModification;
      if (!raw) {
        continue;
      }
      const c = new Date(raw);
      if (Number.isNaN(c.getTime())) {
        continue;
      }
      c.setHours(0, 0, 0, 0);
      const key = c.toISOString().slice(0, 10);
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const data = keys.map((k) => counts.get(k) ?? 0);
    const base = this.courseTrendData.datasets[0];
    this.courseTrendData = {
      labels,
      datasets: [
        {
          ...base,
          label: 'Courses créées',
          data,
        },
      ],
    };
  }

  private rebuildCharts(): void {
    const palette = ['#0ea5e9', '#f59e0b', '#10b981', '#f87171'];
    const stats = this.coursesStatusChart;
    const statSum = stats.reduce((acc, s) => acc + s.value, 0);
    if (statSum === 0) {
      this.courseDoughnutData = {
        labels: ['Aucune course'],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#e2e8f0'],
            borderWidth: 0,
          },
        ],
      };
    } else {
      const colors = stats.map((_, i) => palette[i % palette.length]);
      this.courseDoughnutData = {
        labels: stats.map((s) => s.label),
        datasets: [
          {
            data: stats.map((s) => s.value),
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      };
    }

    const cr = Math.max(0, this.courseRevenueTotal);
    const lr = Math.max(0, this.locationRevenueTotal);
    const sum = cr + lr;
    if (sum === 0) {
      this.revenueSplitData = {
        labels: ['Aucune donnée'],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#e2e8f0'],
            borderWidth: 0,
          },
        ],
      };
    } else {
      this.revenueSplitData = {
        labels: ['Courses terminées', 'Locations'],
        datasets: [
          {
            data: [cr, lr],
            backgroundColor: ['#6366f1', '#14b8a6'],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      };
    }

    const commissionCourse = Math.max(0, this.courseCommissionTotal);
    const commissionLocation = Math.max(0, this.locationCommissionTotal);
    const commissionSum = commissionCourse + commissionLocation;
    if (commissionSum === 0) {
      this.commissionSplitData = {
        labels: ['Aucune commission'],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#e2e8f0'],
            borderWidth: 0,
          },
        ],
      };
    } else {
      this.commissionSplitData = {
        labels: ['Courses', 'Locations'],
        datasets: [
          {
            data: [commissionCourse, commissionLocation],
            backgroundColor: ['#2563eb', '#f97316'],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      };
    }

    this.buildCourseTrendChart(this.coursesList);

    const agencies = this.agencesList;
    const names = agencies.map((a) =>
      this.truncateLabel(a.nomAgence || `Agence #${this.getAgenceId(a)}`, 26),
    );

    this.agencyRevenueBarData = {
      labels: names,
      datasets: [
        {
          label: 'Revenu (TND)',
          data: agencies.map((a) => Number(a.revenue || 0)),
          backgroundColor: agencies.map(
            (_, i) => `hsl(${225 + (i % 6) * 22}, 72%, ${52 - (i % 3) * 4}%)`,
          ),
          borderRadius: 8,
        },
      ],
    };

    this.agencyRentalsBarData = {
      labels: names,
      datasets: [
        {
          label: 'Locations actives',
          data: agencies.map((a) => Number(a.activeRentals || 0)),
          backgroundColor: 'rgba(20, 184, 166, 0.88)',
          borderRadius: 8,
        },
      ],
    };

    this.topPerformanceBarData = {
      labels: this.topChauffeurs.map((item) => item.name),
      datasets: [
        {
          label: 'Note moyenne',
          data: this.topChauffeurs.map((item) => item.average),
          backgroundColor: this.topChauffeurs.map(
            (_, i) => `hsl(${235 + i * 18}, 75%, ${54 - i * 3}%)`,
          ),
          borderRadius: 8,
        },
      ],
    };

    this.topZoneBarData = {
      labels: this.topZones.map((item) => item.label),
      datasets: [
        {
          label: 'Courses',
          data: this.topZones.map((item) => item.count),
          backgroundColor: this.topZones.map(
            (_, i) => `hsl(${170 + i * 18}, 68%, ${48 - i * 2}%)`,
          ),
          borderRadius: 8,
        },
      ],
    };
  }

  private normalizeCourseList(payload: unknown): Course[] {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { data?: unknown })?.data)
        ? ((payload as { data: unknown[] }).data ?? [])
        : Array.isArray((payload as { content?: unknown })?.content)
          ? ((payload as { content: unknown[] }).content ?? [])
          : [];

    return list.map((raw) => {
      const row = raw as Record<string, unknown>;
      const merged = { ...row, idCourse: row['idCourse'] ?? row['id'] };
      const course = merged as unknown as Course;
      course.statut = this.normalizeCourseStatus(course);
      return course;
    });
  }

  private normalizePaymentList(payload: unknown): TransportPaymentRow[] {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { data?: unknown })?.data)
        ? ((payload as { data: unknown[] }).data ?? [])
        : Array.isArray((payload as { content?: unknown })?.content)
          ? ((payload as { content: unknown[] }).content ?? [])
          : [];

    return list
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        const paiement = {
          ...(row as Record<string, unknown>),
          idPaiement: Number(
            row['idPaiement'] ?? row['id_paiement'] ?? row['id'] ?? 0,
          ),
          montantTotal: Number(
            row['montantTotal'] ?? row['montant_total'] ?? 0,
          ),
          montantCommission: Number(
            row['montantCommission'] ?? row['montant_commission'] ?? 0,
          ),
          montantNet: Number(row['montantNet'] ?? row['montant_net'] ?? 0),
          methode: String(
            row['methode'] ?? '',
          ).toUpperCase() as PaiementMethode,
          statut: String(row['statut'] ?? '').toUpperCase() as PaiementStatut,
          typePaiement: String(
            row['typePaiement'] ?? row['type_paiement'] ?? '',
          ).toUpperCase() as PaiementType,
          datePaiement: this.normalizeText(
            row['datePaiement'] ??
              row['date_paiement'] ??
              row['dateCreation'] ??
              row['date_creation'],
          ),
          dateCreation: this.normalizeText(
            row['dateCreation'] ?? row['date_creation'],
          ),
          dateModification: this.normalizeText(
            row['dateModification'] ?? row['date_modification'],
          ),
          phasePaiement: this.normalizeText(
            row['phasePaiement'] ?? row['phase_paiement'],
          ),
          idCourse:
            Number(row['idCourse'] ?? row['id_course'] ?? 0) || undefined,
          idReservationLocation:
            Number(
              row['idReservationLocation'] ??
                row['id_reservation_location'] ??
                0,
            ) || undefined,
        } as TransportPaymentRow;

        if (!paiement.typePaiement) {
          paiement.typePaiement = paiement.idReservationLocation
            ? PaiementType.RESERVATION_LOCATION
            : PaiementType.COURSE;
        }

        return paiement;
      })
      .filter((paiement) => paiement.idPaiement > 0);
  }

  private normalizeText(value: unknown): string | undefined {
    const text = String(value ?? '').trim();
    return text ? text : undefined;
  }

  private sortPaymentsDesc(
    a: TransportPaymentRow,
    b: TransportPaymentRow,
  ): number {
    return this.getPaymentSortTime(b) - this.getPaymentSortTime(a);
  }

  private getPaymentSortTime(payment: TransportPaymentRow): number {
    const raw =
      payment.datePaiement ?? payment.dateModification ?? payment.dateCreation;
    const parsed = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private applyPaymentAggregates(payments: TransportPaymentRow[]): void {
    const completed = payments.filter(
      (payment) => payment.statut === PaiementStatut.COMPLETED,
    );
    const refunded = payments.filter(
      (payment) => payment.statut === PaiementStatut.REFUNDED,
    );
    const pending = payments.filter(
      (payment) => payment.statut === PaiementStatut.PENDING,
    );

    this.totalPayments = payments.length;
    this.completedPayments = completed.length;
    this.refundedPayments = refunded.length;
    this.pendingPayments = pending.length;

    const grossTotal = completed.reduce(
      (sum, payment) => sum + Number(payment.montantTotal || 0),
      0,
    );
    const commissionTotal = completed.reduce(
      (sum, payment) => sum + Number(payment.montantCommission || 0),
      0,
    );
    const netTotal = completed.reduce(
      (sum, payment) => sum + Number(payment.montantNet || 0),
      0,
    );

    const coursePayments = completed.filter(
      (payment) => payment.typePaiement === PaiementType.COURSE,
    );
    const reservationPayments = completed.filter(
      (payment) => payment.typePaiement === PaiementType.RESERVATION_LOCATION,
    );

    this.totalRevenue = grossTotal;
    this.courseRevenueTotal = coursePayments.reduce(
      (sum, payment) => sum + Number(payment.montantTotal || 0),
      0,
    );
    this.locationRevenueTotal = reservationPayments.reduce(
      (sum, payment) => sum + Number(payment.montantTotal || 0),
      0,
    );
    this.commissionReceivedTotal = commissionTotal;
    this.courseCommissionTotal = coursePayments.reduce(
      (sum, payment) => sum + Number(payment.montantCommission || 0),
      0,
    );
    this.locationCommissionTotal = reservationPayments.reduce(
      (sum, payment) => sum + Number(payment.montantCommission || 0),
      0,
    );
    this.netPayoutTotal = netTotal;
  }

  getPaymentTypeLabel(type: PaiementType | string | undefined): string {
    const value = String(type || '').toUpperCase();
    switch (value) {
      case PaiementType.COURSE:
        return 'Course';
      case PaiementType.RESERVATION_LOCATION:
        return 'Location';
      default:
        return value || '—';
    }
  }

  getPaymentMethodLabel(method: PaiementMethode | string | undefined): string {
    const value = String(method || '').toUpperCase();
    switch (value) {
      case PaiementMethode.CARD:
        return 'Carte';
      case PaiementMethode.CASH:
        return 'Espèces';
      case PaiementMethode.WALLET:
        return 'Wallet';
      default:
        return value || '—';
    }
  }

  getPaymentStatusLabel(status: PaiementStatut | string | undefined): string {
    const value = String(status || '').toUpperCase();
    switch (value) {
      case PaiementStatut.COMPLETED:
        return 'Finalisé';
      case PaiementStatut.REFUNDED:
        return 'Remboursé';
      case PaiementStatut.FAILED:
        return 'Échoué';
      case PaiementStatut.PENDING:
        return 'En attente';
      default:
        return value || '—';
    }
  }

  getPaymentStatusClass(status: PaiementStatut | string | undefined): string {
    const value = String(status || '').toUpperCase();
    switch (value) {
      case PaiementStatut.COMPLETED:
        return 'completed';
      case PaiementStatut.REFUNDED:
        return 'cancelled';
      case PaiementStatut.PENDING:
        return 'pending';
      default:
        return 'accepted';
    }
  }

  getPaymentReference(payment: TransportPaymentRow): string {
    if (payment.typePaiement === PaiementType.RESERVATION_LOCATION) {
      return payment.reservationLocation?.idReservation
        ? `Réservation #${payment.reservationLocation.idReservation}`
        : payment.idReservationLocation
          ? `Réservation #${payment.idReservationLocation}`
          : 'Réservation';
    }

    return payment.course?.idCourse
      ? `Course #${payment.course.idCourse}`
      : payment.idCourse
        ? `Course #${payment.idCourse}`
        : 'Course';
  }

  getPaymentDate(payment: TransportPaymentRow): string {
    const raw =
      payment.datePaiement ?? payment.dateModification ?? payment.dateCreation;
    if (!raw) {
      return '—';
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return '—';
    }

    return parsed.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private normalizeCourseStatus(course: Course): CourseStatus {
    if (
      course.statut === CourseStatus.CANCELLED ||
      course.annulationTransport
    ) {
      return CourseStatus.CANCELLED;
    }

    if (
      course.statut === CourseStatus.COMPLETED ||
      course.paiementTransport?.datePaiement
    ) {
      return CourseStatus.COMPLETED;
    }

    const raw = String(course.statut || '').toUpperCase();
    if (Object.values(CourseStatus).includes(raw as CourseStatus)) {
      return raw as CourseStatus;
    }

    return course.statut;
  }

  private applyRecommendationAggregates(courses: Course[]): void {
    const chauffeurScores = new Map<
      string,
      { sum: number; count: number; samples: string[] }
    >();
    const clientScores = new Map<
      string,
      { sum: number; count: number; samples: string[] }
    >();
    const zoneCounts = new Map<string, number>();

    for (const course of courses) {
      const isCompleted =
        course.statut === CourseStatus.COMPLETED ||
        !!course.paiementTransport?.datePaiement;
      if (!isCompleted) {
        continue;
      }

      for (const evaluation of course.evaluationTransports ?? []) {
        this.collectEvaluationSummary(
          evaluation,
          chauffeurScores,
          clientScores,
        );
      }

      const zone = this.extractZoneLabel(course);
      if (zone) {
        zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
      }
    }

    this.topChauffeurs = this.rankSummaries(chauffeurScores, 5);
    this.topClients = this.rankSummaries(clientScores, 5);
    this.topZones = [...zoneCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  private collectEvaluationSummary(
    evaluation: EvaluationTransport,
    chauffeurScores: Map<
      string,
      { sum: number; count: number; samples: string[] }
    >,
    clientScores: Map<
      string,
      { sum: number; count: number; samples: string[] }
    >,
  ): void {
    const note = Number(evaluation.note);
    if (!Number.isFinite(note) || note < 0) {
      return;
    }

    const ratingKey = this.extractEvaluationTargetKey(evaluation);
    if (!ratingKey) {
      return;
    }

    const sample = String(evaluation.commentaire ?? '').trim();
    const targetMap =
      evaluation.type === EvaluationType.CLIENT_TO_DRIVER
        ? chauffeurScores
        : clientScores;
    const current = targetMap.get(ratingKey) ?? {
      sum: 0,
      count: 0,
      samples: [],
    };
    current.sum += note;
    current.count += 1;
    if (sample) {
      current.samples = [...current.samples.slice(0, 2), sample].slice(-3);
    }
    targetMap.set(ratingKey, current);
  }

  private rankSummaries(
    scores: Map<string, { sum: number; count: number; samples: string[] }>,
    limit: number,
  ): RatingSummary[] {
    return [...scores.entries()]
      .map(([name, stats]) => ({
        name,
        average: stats.count > 0 ? stats.sum / stats.count : 0,
        count: stats.count,
        badge: this.ratingBadge(stats.sum / Math.max(stats.count, 1)),
        sample: stats.samples[stats.samples.length - 1] ?? 'Aucun commentaire',
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.average - a.average || b.count - a.count)
      .slice(0, limit);
  }

  private extractEvaluationTargetKey(evaluation: EvaluationTransport): string {
    const target = evaluation.evalue as unknown as
      | Record<string, unknown>
      | undefined;
    const targetUser = target?.['utilisateur'] as
      | Record<string, unknown>
      | undefined;
    const username = String(
      targetUser?.['username'] ?? target?.['username'] ?? '',
    ).trim();
    if (username) {
      return username;
    }

    const display = String(
      target?.['nomAffichage'] ?? target?.['nom'] ?? target?.['prenom'] ?? '',
    ).trim();
    if (display) {
      return display;
    }

    const fallback = String(
      evaluation.evalueNom ?? evaluation.evaluateurNom ?? '',
    ).trim();
    return fallback;
  }

  private extractZoneLabel(course: Course): string {
    const depart = this.extractAddressLabel(
      course.demande?.localisationDepart ?? course.localisationDepart,
    );
    const arrivee = this.extractAddressLabel(
      course.demande?.localisationArrivee ?? course.localisationArrivee,
    );
    const demandeDepart = String(
      course.demande?.localisationDepart?.adresse ?? '',
    ).trim();
    if (demandeDepart) {
      return this.normalizeZoneName(demandeDepart);
    }
    if (depart) {
      return this.normalizeZoneName(depart);
    }
    if (arrivee) {
      return this.normalizeZoneName(arrivee);
    }
    return '';
  }

  private extractAddressLabel(localisation?: Localisation): string {
    if (!localisation) {
      return '';
    }
    const address = String(localisation.adresse ?? '').trim();
    if (address) {
      return address;
    }
    const coords = [localisation.latitude, localisation.longitude]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    return coords.length === 2
      ? `${coords[0].toFixed(3)}, ${coords[1].toFixed(3)}`
      : '';
  }

  private normalizeZoneName(value: string): string {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    const cleaned = text
      .replace(/\s+/g, ' ')
      .replace(/^(departement|zone|quartier|ville|adresse)\s*[:\-]?\s*/i, '');
    const parts = cleaned
      .split(/[\/,\-]/)
      .map((part) => part.trim())
      .filter(Boolean);
    return this.truncateLabel(parts[0] || cleaned, 28);
  }

  private ratingBadge(average: number): string {
    if (average >= 4.8) {
      return 'Excellence';
    }
    if (average >= 4.4) {
      return 'Très fort';
    }
    if (average >= 4.0) {
      return 'Solide';
    }
    return 'En progression';
  }

  private buildAgenceRow(
    agence: AgenceLocation,
    reservations: ReservationLocation[],
  ): AgenceLocationStatsRow {
    const activeRentals = reservations.filter((r) =>
      this.locationActiveRentalStatuses.includes(r.statut),
    ).length;

    const revenue = reservations
      .filter((r) => this.locationRevenueStatuses.includes(r.statut))
      .reduce((sum, r) => sum + Number(r.prixTotal ?? 0), 0);

    const row = agence as AgenceLocation & Record<string, unknown>;
    /** Aligné sur l’écran agence : actif sauf désactivation explicite. */
    const isActive =
      row['actif'] !== false && row['statut'] !== false && row['actif'] !== 0;

    return {
      ...agence,
      activeRentals,
      revenue,
      status: isActive ? 'ACTIVE' : 'SUSPENDED',
    };
  }

  private applyCourseAggregates(courses: Course[]): void {
    this.totalCourses = courses.length;
    this.openCoursesCount = courses.filter(
      (c) =>
        c.statut !== CourseStatus.COMPLETED &&
        c.statut !== CourseStatus.CANCELLED,
    ).length;

    const driverIds = new Set<number>();
    for (const course of courses) {
      if (!this.driverActiveCourseStatuses.includes(course.statut)) {
        continue;
      }
      const id = this.getChauffeurId(course);
      if (id != null) {
        driverIds.add(id);
      }
    }
    this.activeDrivers = driverIds.size;

    let inProgress = 0;
    let accepted = 0;
    let completed = 0;
    let cancelled = 0;

    for (const c of courses) {
      if (
        c.statut === CourseStatus.IN_PROGRESS ||
        c.statut === CourseStatus.STARTED
      ) {
        inProgress += 1;
      } else if (c.statut === CourseStatus.ACCEPTED) {
        accepted += 1;
      } else if (c.statut === CourseStatus.COMPLETED) {
        completed += 1;
      } else if (c.statut === CourseStatus.CANCELLED) {
        cancelled += 1;
      }
    }

    const denom = Math.max(this.totalCourses, 1);
    this.coursesStatusChart = [
      {
        label: 'En cours / démarrée',
        value: inProgress,
        width: (inProgress / denom) * 100,
        class: 'bg-sky-500',
      },
      {
        label: 'Acceptées',
        value: accepted,
        width: (accepted / denom) * 100,
        class: 'bg-amber-400',
      },
      {
        label: 'Terminées',
        value: completed,
        width: (completed / denom) * 100,
        class: 'bg-green-500',
      },
      {
        label: 'Annulées',
        value: cancelled,
        width: (cancelled / denom) * 100,
        class: 'bg-red-400',
      },
    ];
  }

  private applyGlobalAggregates(
    courses: Course[],
    agenceRows: AgenceLocationStatsRow[],
  ): void {
    const courseRevenue = courses
      .filter((c) => c.statut === CourseStatus.COMPLETED)
      .reduce(
        (sum, c) =>
          sum +
          Number(
            c.prixFinal ??
              c.demande?.prixEstime ??
              (c as { prixEstime?: number }).prixEstime ??
              0,
          ),
        0,
      );

    const locationRevenue = agenceRows.reduce(
      (sum, row) => sum + Number(row.revenue || 0),
      0,
    );

    this.courseRevenueTotal = courseRevenue;
    this.locationRevenueTotal = locationRevenue;
    this.totalRevenue = courseRevenue + locationRevenue;
    this.totalRentedVehicles = agenceRows.reduce(
      (sum, row) => sum + row.activeRentals,
      0,
    );
  }
}
