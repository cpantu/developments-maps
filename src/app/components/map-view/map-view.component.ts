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
  private autoNavCooldown = false;

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

    // Listen for user zoom changes to auto-navigate
    this.map.on('zoomend', () => {
      if (this.isAnimating || !this.userZoomEnabled || this.autoNavCooldown) return;
      const currentZoom = this.map.getZoom();
      const nodeZoom = this.currentNode().zoom;

      // Zoom-out: navigate back
      if (currentZoom < nodeZoom - 1.5) {
        this.ngZone.run(() => {
          this.zoomOutBack.emit();
        });
        return;
      }

      // Zoom-in: auto-navigate into a child if it dominates the viewport
      this.checkAutoNavIntoChild();
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
    this.autoNavCooldown = false;
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

  /**
   * Auto-navigate into a child node when the user zooms in enough that
   * a single child dominates the viewport.
   *
   * Criteria (any triggers navigation):
   * - Only one child is visible in the viewport
   * - A child's bounding box covers ≥ 55% of the viewport area
   *
   * Additional guard: the current zoom must be at or above the child's
   * target zoom minus 1, so we don't trigger too early.
   */
  private checkAutoNavIntoChild(): void {
    const node = this.currentNode();
    if (!node.children?.length) return;

    // Skip property-type children (they open a detail panel, not a map level)
    const navigableChildren = node.children.filter(c => c.type !== 'property');
    if (!navigableChildren.length) return;

    const mapBounds = this.map.getBounds();
    const viewportArea = this.boundsArea(mapBounds);
    if (viewportArea <= 0) return;

    const currentZoom = this.map.getZoom();

    // Compute visible children and their viewport coverage
    const visibleChildren: { child: MapNode; coverage: number }[] = [];

    for (const child of navigableChildren) {
      const childBounds = this.getChildBounds(child);
      if (!childBounds) continue;

      // Check if child is visible in the viewport
      if (!mapBounds.intersects(childBounds)) continue;

      // Zoom guard: don't auto-nav if we're still far from the child's zoom level
      if (currentZoom < child.zoom - 1) continue;

      // Compute intersection area as percentage of viewport
      const intersection = L.latLngBounds(
        L.latLng(
          Math.max(mapBounds.getSouth(), childBounds.getSouth()),
          Math.max(mapBounds.getWest(), childBounds.getWest()),
        ),
        L.latLng(
          Math.min(mapBounds.getNorth(), childBounds.getNorth()),
          Math.min(mapBounds.getEast(), childBounds.getEast()),
        ),
      );
      const coverage = this.boundsArea(intersection) / viewportArea;

      visibleChildren.push({ child, coverage });
    }

    if (visibleChildren.length === 0) return;

    // Pick the best candidate
    let target: MapNode | null = null;

    // Case 1: only one navigable child is visible in the viewport
    if (visibleChildren.length === 1 && visibleChildren[0].coverage > 0.15) {
      target = visibleChildren[0].child;
    }

    // Case 2: a single child covers ≥ 55% of the viewport
    if (!target) {
      const dominant = visibleChildren.reduce((a, b) =>
        a.coverage > b.coverage ? a : b,
      );
      if (dominant.coverage >= 0.55) {
        target = dominant.child;
      }
    }

    if (target) {
      // Prevent rapid re-triggers
      this.autoNavCooldown = true;
      this.ngZone.run(() => {
        this.zoneClicked.emit(target!);
      });
      setTimeout(() => {
        this.autoNavCooldown = false;
      }, 2000);
    }
  }

  private getChildBounds(child: MapNode): L.LatLngBounds | null {
    if (child.polygon && child.polygon.length >= 3) {
      return L.latLngBounds(
        child.polygon.map(([lat, lng]) => L.latLng(lat, lng)),
      );
    }
    // For children without polygon, create a small bounds around center
    if (child.center) {
      const offset = 0.002; // ~200m approximate
      return L.latLngBounds(
        L.latLng(child.center[0] - offset, child.center[1] - offset),
        L.latLng(child.center[0] + offset, child.center[1] + offset),
      );
    }
    return null;
  }

  private boundsArea(bounds: L.LatLngBounds): number {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return Math.abs((ne.lat - sw.lat) * (ne.lng - sw.lng));
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

    const statusColors: Record<string, string> = {
      available: '#10b981',
      reserved: '#f59e0b',
      sold: '#ef4444',
      floor: '#8b5cf6',
    };

    for (const child of node.children) {
      if (!child.polygon?.length || child.polygon.length < 2) continue;

      // polygon coords: [[topPct, leftPct], [bottomPct, rightPct]]
      const [topLeft, bottomRight] = child.polygon;
      const top = topLeft[0];
      const left = topLeft[1];
      const height = bottomRight[0] - topLeft[0];
      const width = bottomRight[1] - topLeft[1];

      const statusKey =
        child.type === 'property'
          ? child.details?.status ?? 'available'
          : child.type === 'floor'
            ? 'floor'
            : 'available';
      const dotColor = statusColors[statusKey] ?? statusColors['available'];

      // Build tooltip text
      let tipText = child.name;
      if (child.type === 'property' && child.details) {
        const price = new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: child.details.currency,
          maximumFractionDigits: 0,
        }).format(child.details.price);
        tipText += ` · ${price}`;
      }
      if (child.type === 'floor' && child.children) {
        tipText += ` · ${child.children.length} deptos`;
      }

      // --- Zone clickable area ---
      const isFloor = child.type === 'floor';
      const baseBackground = isFloor
        ? `${dotColor}22`
        : 'transparent';
      const baseBorder = isFloor
        ? `2px solid ${dotColor}55`
        : 'none';

      const zone = document.createElement('button');
      Object.assign(zone.style, {
        position: 'absolute',
        top: `${top}%`,
        left: `${left}%`,
        width: `${width}%`,
        height: `${height}%`,
        cursor: 'pointer',
        border: baseBorder,
        borderRadius: '6px',
        background: baseBackground,
        padding: '0',
        outline: 'none',
        transition: 'background 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
      });

      // --- Tooltip (hidden by default, shown on hover) ---
      const tip = document.createElement('span');
      Object.assign(tip.style, {
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%) translateY(6px)',
        background: 'white',
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#1f2937',
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      });

      // Status dot + text
      const dot = document.createElement('span');
      Object.assign(dot.style, {
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        marginRight: '6px',
        verticalAlign: 'middle',
        background: dotColor,
      });
      tip.appendChild(dot);
      tip.appendChild(document.createTextNode(tipText));

      // Tooltip arrow
      const arrow = document.createElement('span');
      Object.assign(arrow.style, {
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        border: '6px solid transparent',
        borderTopColor: 'white',
      });
      tip.appendChild(arrow);

      zone.appendChild(tip);

      // --- Hover effects (inline, no CSS needed) ---
      const hoverBg = isFloor
        ? `${dotColor}40`
        : 'rgba(59, 130, 246, 0.18)';
      const hoverBorder = isFloor
        ? `2px solid ${dotColor}88`
        : baseBorder;
      const activeBg = isFloor
        ? `${dotColor}55`
        : 'rgba(59, 130, 246, 0.30)';

      zone.addEventListener('mouseenter', () => {
        zone.style.background = hoverBg;
        zone.style.border = hoverBorder;
        zone.style.boxShadow = isFloor
          ? `0 0 12px ${dotColor}33`
          : 'inset 0 0 0 2px rgba(59, 130, 246, 0.5)';
        tip.style.opacity = '1';
        tip.style.transform = 'translateX(-50%) translateY(0)';
      });
      zone.addEventListener('mouseleave', () => {
        zone.style.background = baseBackground;
        zone.style.border = baseBorder;
        zone.style.boxShadow = 'none';
        tip.style.opacity = '0';
        tip.style.transform = 'translateX(-50%) translateY(6px)';
      });
      zone.addEventListener('mousedown', () => {
        zone.style.background = activeBg;
      });
      zone.addEventListener('mouseup', () => {
        zone.style.background = hoverBg;
      });

      zone.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.ngZone.run(() => {
          this.zoneClicked.emit(child);
        });
      });

      container.appendChild(zone);
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
