import { Component, effect, inject, OnInit } from '@angular/core';
import { MapViewComponent } from '../map-view/map-view.component';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { DetailPanelComponent } from '../detail-panel/detail-panel.component';
import { MapDataService } from '../../services/map-data.service';
import { NavigationService } from '../../services/navigation.service';
import { travelOverlayAnimation } from '../../animations/travel.animation';
import { MapNode } from '../../models/map-node.model';

@Component({
  selector: 'app-map-shell',
  standalone: true,
  imports: [MapViewComponent, BreadcrumbComponent, DetailPanelComponent],
  animations: [travelOverlayAnimation],
  template: `
    @if (nav.currentNode(); as currentNode) {
      <div class="shell">
        <app-breadcrumb
          [breadcrumbs]="nav.breadcrumbs()"
          (navigateTo)="onBreadcrumbClick($event)"
        />

        <div class="map-area">
          <app-map-view
            [currentNode]="currentNode"
            (zoneClicked)="onZoneClicked($event)"
            (transitionStart)="transitionState = 'traveling'"
            (transitionEnd)="transitionState = 'idle'"
          />

          <!-- Travel overlay -->
          <div class="travel-overlay" [@travelOverlay]="transitionState">
            <div class="travel-spinner"></div>
            <span>Viajando...</span>
          </div>

          <!-- Back button -->
          @if (nav.breadcrumbs().length > 1) {
            <button class="back-btn" (click)="nav.goBack()">
              ← Volver
            </button>
          }

          <!-- Detail panel -->
          @if (nav.selectedProperty(); as property) {
            <app-detail-panel
              [property]="property"
              (close)="nav.selectedProperty.set(null)"
            />
          }
        </div>
      </div>
    } @else {
      <div class="loading">
        <div class="travel-spinner"></div>
        <span>Cargando mapa...</span>
      </div>
    }
  `,
  styles: [
    `
      .shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
        width: 100vw;
      }
      .map-area {
        flex: 1;
        position: relative;
        overflow: hidden;
      }
      .travel-overlay {
        position: absolute;
        inset: 0;
        background: radial-gradient(
          ellipse at center,
          rgba(255, 255, 255, 0.6) 0%,
          rgba(255, 255, 255, 0.9) 100%
        );
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        z-index: 999;
        font-size: 16px;
        color: #4b5563;
        font-weight: 500;
        backdrop-filter: blur(4px);
      }
      .travel-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #e5e7eb;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .back-btn {
        position: absolute;
        top: 16px;
        left: 16px;
        z-index: 500;
        background: white;
        border: none;
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
        transition: all 0.2s;
        font-family: inherit;
      }
      .back-btn:hover {
        background: #f3f4f6;
        transform: translateX(-2px);
      }
      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        gap: 12px;
        color: #4b5563;
        font-size: 16px;
      }
    `,
  ],
})
export class MapShellComponent implements OnInit {
  private mapData = inject(MapDataService);
  nav = inject(NavigationService);
  transitionState: 'idle' | 'traveling' = 'idle';

  constructor() {
    effect(() => {
      const root = this.mapData.getRootNode()();
      if (root && !this.nav.currentNode()) {
        this.nav.initialize(root);
      }
    });
  }

  ngOnInit(): void {}

  onZoneClicked(node: MapNode): void {
    this.nav.navigateToChild(node);
  }

  onBreadcrumbClick(nodeId: string): void {
    this.nav.navigateTo(nodeId);
  }
}
