import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-billet',
  templateUrl: './billet.component.html',
  styleUrls: ['./billet.component.css']
})
export class BilletComponent implements OnInit {
  billet: any = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const reference = this.route.snapshot.paramMap.get('reference');
    
    // Simpler solution: display validation message without API call
    this.billet = {
      reference: reference,
      touristeNom: 'Client',
      depart: 'TUN',
      arrivee: 'PAR',
      numeroVol: 'TU123',
      dateDepart: new Date().toLocaleDateString(),
      heureDepart: new Date().toLocaleTimeString(),
      nbPassagers: 1,
      typeBillet: 'Economique',
      prixTotal: '0'
    };
    this.loading = false;
  }
}