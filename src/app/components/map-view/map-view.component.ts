import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  input,
  output,
  effect,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import * as L from 'leaflet';
import { MapNode, NodeType } from '../../models/map-node.model';

@Component({
  selector: 'app-map-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #mapContainer class="map-container" [class.hidden]="isImageMode"></div>
    <div class="image-container" [class.hidden]="!isImageMode">
      <div class="image-wrapper" #imageWrapper>
        <img
          #buildingImage
          class="overlay-image"
          alt=""
        />
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
        height: 100%;
      }
      .overlay-image {
        display: block;
        height: 100%;
        width: auto;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }
      .image-zones {
        position: absolute;
        inset: 0;
      }
      .image-zone-btn {
        position: absolute;
        cursor: pointer;
        border: 3px solid rgba(99, 102, 241, 0.3);
        border-radius: 8px;
        background: rgba(99, 102, 241, 0.05);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        outline: none;
      }
      .image-zone-btn:hover {
        background: rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.8);
        transform: scale(1.02);
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
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
  @ViewChild('imageWrapper') imageWrapper!: ElementRef;

  currentNode = input.required<MapNode>();
  zoneClicked = output<MapNode>();
  zoomOutBack = output<void>();
  transitionStart = output<void>();
  transitionEnd = output<void>();

  isImageMode = false;
  currentImageUrl = '';

  private map!: L.Map;
  private tileLayer!: L.TileLayer;
  private layerGroup = L.layerGroup();
  private isAnimating = false;
  private mapInitialized = false;
  private userZoomEnabled = false;

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

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
    effect(() => {
      const node = this.currentNode();
      if (!node) return;

      const useImage = !!node.imageOverlay;

      if (useImage) {
        this.isImageMode = true;
        this.loadImageAndRenderZones(node);
        this.cdr.markForCheck();
      } else {
        this.isImageMode = false;
        this.cdr.markForCheck();
        if (this.mapInitialized) {
          // Small delay so the map container becomes visible before flyTo
          setTimeout(() => {
            this.map.invalidateSize();
            this.flyToAndRender(node);
          }, 50);
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

  private loadImageAndRenderZones(node: MapNode): void {
    const img = this.buildingImage?.nativeElement as HTMLImageElement;
    if (!img) return;

    const url = node.imageOverlay!.url;

    // Force re-render even if same URL by clearing first
    img.src = '';
    setTimeout(() => {
      img.onload = () => {
        this.renderImageZones(node);
      };
      img.src = url;
    }, 10);
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

    // Listen for user zoom-out to navigate back
    this.map.on('zoomend', () => {
      if (this.isAnimating || !this.userZoomEnabled) return;
      const currentZoom = this.map.getZoom();
      const nodeZoom = this.currentNode().zoom;
      // If user zoomed out significantly below the current node's zoom level
      if (currentZoom < nodeZoom - 1.5) {
        this.ngZone.run(() => {
          this.zoomOutBack.emit();
        });
      }
    });

    // Track user-initiated zooms vs programmatic
    this.map.on('movestart', () => {
      // flyTo sets isAnimating=true, so if not animating it's user-initiated
      if (!this.isAnimating) {
        this.userZoomEnabled = true;
      }
    });

    if (!node.imageOverlay) {
      this.renderChildren(node);
    }
  }

  private flyToAndRender(node: MapNode): void {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.userZoomEnabled = false;
    this.transitionStart.emit();

    this.map.flyTo(node.center, node.zoom, {
      duration: 1.5,
      easeLinearity: 0.25,
    });

    this.map.once('moveend', () => {
      this.layerGroup.clearLayers();
      this.renderChildren(node);
      this.isAnimating = false;
      // Re-enable user zoom detection after a brief delay
      setTimeout(() => {
        this.userZoomEnabled = true;
      }, 300);
      this.transitionEnd.emit();
    });
  }

  private renderChildren(node: MapNode): void {
    if (!node.children?.length) return;

    for (const child of node.children) {
      if (child.type === 'property') {
        this.addPropertyMarker(child);
      } else if (child.polygon && child.polygon.length > 2) {
        this.addPolygon(child);
      } else {
        this.addMarker(child);
      }
    }
  }

  private renderImageZones(node: MapNode): void {
    if (!node.children?.length || !this.imageZones?.nativeElement) return;

    const container = this.imageZones.nativeElement as HTMLElement;
    container.innerHTML = '';

    for (const child of node.children) {
      if (!child.polygon?.length || child.polygon.length < 2) continue;

      // polygon coords: [[topPct, leftPct], [bottomPct, rightPct]]
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

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.ngZone.run(() => {
          this.zoneClicked.emit(child);
        });
      });

      container.appendChild(btn);
    }
  }

  private addPolygon(node: MapNode): void {
    const color = this.typeColors[node.type];

    const polygon = L.polygon(node.polygon!, {
      color,
      weight: 3,
      fillColor: color,
      fillOpacity: 0.2,
      className: 'zone-polygon',
    });

    // Click on polygon itself
    polygon.on('click', () => {
      if (!this.isAnimating) {
        this.ngZone.run(() => {
          this.zoneClicked.emit(node);
        });
      }
    });

    polygon.on('mouseover', () => {
      polygon.setStyle({ fillOpacity: 0.4, weight: 4 });
    });

    polygon.on('mouseout', () => {
      polygon.setStyle({ fillOpacity: 0.2, weight: 3 });
    });

    this.layerGroup.addLayer(polygon);

    // Add clickable label at center
    const center = polygon.getBounds().getCenter();
    const childLabel = this.getChildLabel(node);
    const label = L.marker(center, {
      icon: L.divIcon({
        className: 'zone-label',
        html: `<div class="zone-label-inner clickable-label" style="border-color: ${color}">
          <strong>${node.name}</strong>
          ${childLabel ? `<span>${childLabel}</span>` : ''}
        </div>`,
        iconSize: [160, 50],
        iconAnchor: [80, 25],
      }),
      interactive: true,
    });

    label.on('click', () => {
      if (!this.isAnimating) {
        this.ngZone.run(() => {
          this.zoneClicked.emit(node);
        });
      }
    });

    this.layerGroup.addLayer(label);
  }

  private addPropertyMarker(node: MapNode): void {
    const status = node.details?.status ?? 'available';
    const color = this.statusColors[status];

    const marker = L.circleMarker(node.center, {
      radius: 14,
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

    // Use popup instead of tooltip for better click handling
    marker.bindPopup(
      `<div class="property-popup">
        <strong>${node.name}</strong>
        <div class="popup-price">${priceFormatted}</div>
        <div>${node.details?.area}m² · ${node.details?.bedrooms} hab · ${node.details?.bathrooms} baños</div>
        <div class="status-badge status-${status}">${status === 'available' ? 'Disponible' : status === 'reserved' ? 'Reservado' : 'Vendido'}</div>
        <button class="popup-detail-btn" data-node-id="${node.id}">Ver detalle</button>
      </div>`,
      {
        className: 'property-popup-wrapper',
        closeButton: true,
        maxWidth: 250,
      }
    );

    marker.on('popupopen', () => {
      setTimeout(() => {
        const btn = document.querySelector(
          `[data-node-id="${node.id}"]`
        ) as HTMLElement;
        if (btn) {
          btn.addEventListener('click', () => {
            this.ngZone.run(() => {
              this.zoneClicked.emit(node);
            });
            marker.closePopup();
          });
        }
      }, 50);
    });

    this.layerGroup.addLayer(marker);
  }

  private addMarker(node: MapNode): void {
    const color = this.typeColors[node.type];
    const marker = L.circleMarker(node.center, {
      radius: 12,
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
        this.ngZone.run(() => {
          this.zoneClicked.emit(node);
        });
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
