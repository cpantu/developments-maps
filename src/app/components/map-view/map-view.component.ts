import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  input,
  output,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import * as L from 'leaflet';
import { MapNode, NodeType } from '../../models/map-node.model';

@Component({
  selector: 'app-map-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #mapContainer class="map-container"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .map-container {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  currentNode = input.required<MapNode>();
  zoneClicked = output<MapNode>();
  transitionStart = output<void>();
  transitionEnd = output<void>();

  private map!: L.Map;
  private layerGroup = L.layerGroup();
  private isAnimating = false;

  private readonly typeColors: Record<NodeType, string> = {
    city: '#3b82f6',
    neighborhood: '#8b5cf6',
    building: '#f59e0b',
    property: '#10b981',
  };

  private readonly statusColors: Record<string, string> = {
    available: '#10b981',
    reserved: '#f59e0b',
    sold: '#ef4444',
  };

  constructor() {
    effect(() => {
      const node = this.currentNode();
      if (this.map && node) {
        this.flyToAndRender(node);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.currentNode().center,
      zoom: this.currentNode().zoom,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(this.map);

    this.layerGroup.addTo(this.map);
    this.renderChildren(this.currentNode());
  }

  private flyToAndRender(node: MapNode): void {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.transitionStart.emit();

    this.map.flyTo(node.center, node.zoom, {
      duration: 1.5,
      easeLinearity: 0.25,
    });

    this.map.once('moveend', () => {
      this.layerGroup.clearLayers();
      this.renderChildren(node);
      this.isAnimating = false;
      this.transitionEnd.emit();
    });
  }

  private renderChildren(node: MapNode): void {
    if (!node.children?.length) return;

    for (const child of node.children) {
      if (child.type === 'property') {
        this.addPropertyMarker(child);
      } else if (child.polygon) {
        this.addPolygon(child);
      } else {
        this.addMarker(child);
      }
    }
  }

  private addPolygon(node: MapNode): void {
    const color = this.typeColors[node.type];

    const polygon = L.polygon(node.polygon!, {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.15,
      className: 'zone-polygon',
    });

    polygon.bindTooltip(this.createTooltipContent(node), {
      sticky: true,
      className: 'zone-tooltip',
      direction: 'top',
      offset: [0, -10],
    });

    polygon.on('click', () => {
      if (!this.isAnimating) {
        this.zoneClicked.emit(node);
      }
    });

    polygon.on('mouseover', () => {
      polygon.setStyle({ fillOpacity: 0.35, weight: 3 });
    });

    polygon.on('mouseout', () => {
      polygon.setStyle({ fillOpacity: 0.15, weight: 2 });
    });

    this.layerGroup.addLayer(polygon);

    // Add label at center
    const center = polygon.getBounds().getCenter();
    const label = L.marker(center, {
      icon: L.divIcon({
        className: 'zone-label',
        html: `<div class="zone-label-inner" style="border-color: ${color}">
          <strong>${node.name}</strong>
          ${node.children ? `<span>${node.children.length} ${node.type === 'neighborhood' ? 'edificios' : 'propiedades'}</span>` : ''}
        </div>`,
        iconSize: [140, 50],
        iconAnchor: [70, 25],
      }),
      interactive: false,
    });
    this.layerGroup.addLayer(label);
  }

  private addPropertyMarker(node: MapNode): void {
    const status = node.details?.status ?? 'available';
    const color = this.statusColors[status];

    const marker = L.circleMarker(node.center, {
      radius: 12,
      color: '#fff',
      weight: 3,
      fillColor: color,
      fillOpacity: 0.9,
    });

    const priceFormatted = node.details
      ? new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: node.details.currency,
          maximumFractionDigits: 0,
        }).format(node.details.price)
      : '';

    marker.bindTooltip(
      `<div class="property-tooltip">
        <strong>${node.name}</strong>
        <div>${priceFormatted}</div>
        <div>${node.details?.area}m² · ${node.details?.bedrooms} hab · ${node.details?.bathrooms} baños</div>
        <div class="status-badge status-${status}">${status === 'available' ? 'Disponible' : status === 'reserved' ? 'Reservado' : 'Vendido'}</div>
      </div>`,
      { className: 'property-tooltip-wrapper', direction: 'top', offset: [0, -15] }
    );

    marker.on('click', () => {
      if (!this.isAnimating) {
        this.zoneClicked.emit(node);
      }
    });

    this.layerGroup.addLayer(marker);
  }

  private addMarker(node: MapNode): void {
    const color = this.typeColors[node.type];
    const marker = L.circleMarker(node.center, {
      radius: 10,
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.7,
    });

    marker.bindTooltip(this.createTooltipContent(node), {
      className: 'zone-tooltip',
      direction: 'top',
    });

    marker.on('click', () => {
      if (!this.isAnimating) {
        this.zoneClicked.emit(node);
      }
    });

    this.layerGroup.addLayer(marker);
  }

  private createTooltipContent(node: MapNode): string {
    const childCount = node.children?.length ?? 0;
    const childLabel =
      node.type === 'neighborhood'
        ? `${childCount} edificio${childCount !== 1 ? 's' : ''}`
        : `${childCount} propiedad${childCount !== 1 ? 'es' : ''}`;
    return `<div class="zone-tooltip-content">
      <strong>${node.name}</strong>
      ${node.description ? `<div>${node.description}</div>` : ''}
      ${childCount > 0 ? `<div class="child-count">${childLabel}</div>` : ''}
    </div>`;
  }
}
