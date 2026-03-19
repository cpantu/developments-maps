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
  template: `
    <div #mapContainer class="map-container" [class.hidden]="isImageMode"></div>
    <div
      #imageContainer
      class="image-container"
      [class.hidden]="!isImageMode"
    >
      <div class="image-wrapper" #imageWrapper>
        <img
          #buildingImage
          class="overlay-image"
          [src]="currentImageUrl"
          (load)="onImageLoaded()"
          alt=""
        />
        <!-- Clickable zones on the image -->
        <div class="image-zones" #imageZones></div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        position: relative;
      }
      .map-container {
        width: 100%;
        height: 100%;
      }
      .map-container.hidden {
        display: none;
      }
      .image-container {
        width: 100%;
        height: 100%;
        overflow: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f4f6;
      }
      .image-container.hidden {
        display: none;
      }
      .image-wrapper {
        position: relative;
        display: inline-block;
        max-width: 100%;
        max-height: 100%;
      }
      .overlay-image {
        display: block;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }
      .image-zones {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .image-zone-btn {
        position: absolute;
        pointer-events: all;
        cursor: pointer;
        border: 3px solid transparent;
        border-radius: 8px;
        background: transparent;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .image-zone-btn:hover {
        background: rgba(59, 130, 246, 0.15);
        border-color: rgba(59, 130, 246, 0.6);
        transform: scale(1.02);
      }
      .image-zone-btn .zone-label-tag {
        background: white;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        color: #1f2937;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        white-space: nowrap;
        pointer-events: none;
      }
      .image-zone-btn .zone-label-tag.available {
        border-left: 3px solid #10b981;
      }
      .image-zone-btn .zone-label-tag.reserved {
        border-left: 3px solid #f59e0b;
      }
      .image-zone-btn .zone-label-tag.sold {
        border-left: 3px solid #ef4444;
      }
      .image-zone-btn .zone-label-tag.floor {
        border-left: 3px solid #8b5cf6;
      }
    `,
  ],
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('imageZones') imageZones!: ElementRef;
  @ViewChild('buildingImage') buildingImage!: ElementRef;

  currentNode = input.required<MapNode>();
  zoneClicked = output<MapNode>();
  transitionStart = output<void>();
  transitionEnd = output<void>();

  isImageMode = false;
  currentImageUrl = '';

  private map!: L.Map;
  private tileLayer!: L.TileLayer;
  private layerGroup = L.layerGroup();
  private isAnimating = false;
  private mapInitialized = false;

  private readonly typeColors: Record<NodeType, string> = {
    city: '#3b82f6',
    neighborhood: '#8b5cf6',
    building: '#f59e0b',
    floor: '#8b5cf6',
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
      if (!node) return;

      // Determine if we should use image mode
      const useImage = !!node.imageOverlay;

      if (useImage) {
        this.isImageMode = true;
        this.currentImageUrl = node.imageOverlay!.url;
        // Children will be rendered as clickable zones on the image once loaded
      } else {
        this.isImageMode = false;
        if (this.mapInitialized) {
          this.flyToAndRender(node);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  onImageLoaded(): void {
    this.renderImageZones();
  }

  private initMap(): void {
    const node = this.currentNode();
    this.map = L.map(this.mapContainer.nativeElement, {
      center: node.center,
      zoom: node.zoom,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.tileLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 20,
        subdomains: 'abcd',
      }
    ).addTo(this.map);

    this.layerGroup.addTo(this.map);
    this.mapInitialized = true;

    if (!node.imageOverlay) {
      this.renderChildren(node);
    }
  }

  private flyToAndRender(node: MapNode): void {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.transitionStart.emit();

    // Invalidate map size in case it was hidden
    setTimeout(() => this.map.invalidateSize(), 50);

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

  private renderImageZones(): void {
    const node = this.currentNode();
    if (!node.children?.length || !this.imageZones?.nativeElement) return;

    const container = this.imageZones.nativeElement as HTMLElement;
    container.innerHTML = '';

    const img = this.buildingImage.nativeElement as HTMLImageElement;
    const imgRect = img.getBoundingClientRect();
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    for (const child of node.children) {
      if (!child.polygon?.length) continue;

      // polygon coords are in image-pixel percentages [y%, x%]
      // We interpret polygon as [[topPct, leftPct], [bottomPct, rightPct]]
      const [topLeft, bottomRight] = child.polygon;
      const top = topLeft[0];
      const left = topLeft[1];
      const height = bottomRight[0] - topLeft[0];
      const width = bottomRight[1] - topLeft[1];

      const btn = document.createElement('button');
      btn.className = 'image-zone-btn';
      btn.style.top = `${top}%`;
      btn.style.left = `${left}%`;
      btn.style.width = `${width}%`;
      btn.style.height = `${height}%`;

      const statusClass =
        child.type === 'property'
          ? child.details?.status ?? 'available'
          : child.type === 'floor'
            ? 'floor'
            : 'available';

      btn.innerHTML = `<span class="zone-label-tag ${statusClass}">${child.name}</span>`;

      btn.addEventListener('click', () => {
        if (!this.isAnimating) {
          this.zoneClicked.emit(child);
        }
      });

      container.appendChild(btn);
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
    const childLabel = this.getChildLabel(node);
    const label = L.marker(center, {
      icon: L.divIcon({
        className: 'zone-label',
        html: `<div class="zone-label-inner" style="border-color: ${color}">
          <strong>${node.name}</strong>
          ${childLabel ? `<span>${childLabel}</span>` : ''}
        </div>`,
        iconSize: [160, 50],
        iconAnchor: [80, 25],
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
      ? new Intl.NumberFormat('es-AR', {
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
      {
        className: 'property-tooltip-wrapper',
        direction: 'top',
        offset: [0, -15],
      }
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

  private getChildLabel(node: MapNode): string {
    const count = node.children?.length ?? 0;
    if (count === 0) return '';
    switch (node.type) {
      case 'city':
        return `${count} zona${count !== 1 ? 's' : ''}`;
      case 'neighborhood':
        return `${count} edificio${count !== 1 ? 's' : ''}`;
      case 'building':
        return `${count} piso${count !== 1 ? 's' : ''}`;
      case 'floor':
        return `${count} depto${count !== 1 ? 's' : ''}`;
      default:
        return `${count} elemento${count !== 1 ? 's' : ''}`;
    }
  }

  private createTooltipContent(node: MapNode): string {
    const childLabel = this.getChildLabel(node);
    return `<div class="zone-tooltip-content">
      <strong>${node.name}</strong>
      ${node.description ? `<div>${node.description}</div>` : ''}
      ${childLabel ? `<div class="child-count">${childLabel}</div>` : ''}
    </div>`;
  }
}
