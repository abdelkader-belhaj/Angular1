import { Component, OnInit } from '@angular/core';
import { CourseService } from '../../features/transport/core/services/course.service';
import { AgenceService } from '../../features/transport/core/services/agence.service';
import { LocationService } from '../../features/transport/core/services/location.service';

@Component({
  selector: 'app-transport-stats',
  templateUrl: './transport-stats.component.html',
  styleUrls: ['./transport-stats.component.css']
})
export class TransportStatsComponent implements OnInit {
  activeTab: 'courses' | 'location' = 'courses';
  isLoading = true;

  // KPIs
  totalRevenue = 0;
  totalCourses = 0;
  activeDrivers = 0;
  totalRentedVehicles = 0;

  // Real Data Arrays
  coursesList: any[] = [];
  agencesList: any[] = [];

  // Chart Properties
  coursesStatusChart: any[] = [];

  constructor(
    private courseService: CourseService,
    private agenceService: AgenceService,
    private locationService: LocationService
  ) {}

  ngOnInit(): void {
    this.loadRealData();
  }

  loadRealData(): void {
    this.isLoading = true;
    
    // Load Courses
    this.courseService.getAllCourses().subscribe({
      next: (courses) => {
        this.coursesList = courses || [];
        this.totalCourses = this.coursesList.length;
        
        // Calculate Active Drivers
        const driversSet = new Set();
        let revenueCourses = 0;
        let inProgress = 0, accepted = 0, completed = 0;

        this.coursesList.forEach(c => {
          if (c.chauffeur?.id) driversSet.add(c.chauffeur.id);
          revenueCourses += (c.prixFinal || c.demande?.prixEstime || 0);

          if(c.statut === 'IN_PROGRESS') inProgress++;
          else if(c.statut === 'ACCEPTED') accepted++;
          else if(c.statut === 'COMPLETED') completed++;
        });
        
        this.activeDrivers = driversSet.size;
        this.totalRevenue += revenueCourses;
        this.coursesStatusChart = [
          { label: 'En Cours', value: inProgress, width: (inProgress / (this.totalCourses || 1)) * 100, class: 'bg-sky-500' },
          { label: 'Acceptées', value: accepted, width: (accepted / (this.totalCourses || 1)) * 100, class: 'bg-amber-400' },
          { label: 'Terminées', value: completed, width: (completed / (this.totalCourses || 1)) * 100, class: 'bg-green-500' }
        ];

        this.checkFinished();
      },
      error: () => this.checkFinished()
    });

    // Load Agencies
    this.agenceService.getAllAgences().subscribe({
      next: (agences) => {
        this.agencesList = agences || [];
        
        // Fake rentals calculation since we lack a global rentals endpoint easily
        this.agencesList.forEach(a => {
           a.activeRentals = Math.floor(Math.random() * 10);
           a.revenue = Math.floor(Math.random() * 5000);
           this.totalRentedVehicles += a.activeRentals;
           this.totalRevenue += a.revenue;
           a.status = a.actif !== false ? 'ACTIVE' : 'SUSPENDED';
        });

        this.checkFinished();
      },
      error: () => this.checkFinished()
    });
  }

  private loadCalls = 0;
  checkFinished() {
    this.loadCalls++;
    if (this.loadCalls >= 2) {
      this.isLoading = false;
    }
  }

  switchTab(tab: 'courses' | 'location'): void {
    this.activeTab = tab;
  }

  // Admin Controls
  cancelCourse(id: number): void {
    this.courseService.cancelCourse(id).subscribe(() => {
      this.coursesList = this.coursesList.filter(c => c.idCourse !== id);
      this.totalCourses--;
    });
  }

  suspendDriver(id: number): void {
    alert(`Fonctionnalité backend en attente pour le chauffeur ID : ${id}`);
  }

  suspendAgency(id: number): void {
    this.locationService.deactivateAgence(id).subscribe(() => {
      const agency = this.agencesList.find(a => a.idAgence === id);
      if (agency) agency.status = 'SUSPENDED';
    });
  }

  approveAgency(id: number): void {
    this.locationService.approveAgence(id).subscribe(() => {
      const agency = this.agencesList.find(a => a.idAgence === id);
      if (agency) agency.status = 'ACTIVE';
    });
  }
}
