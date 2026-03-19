import { Component, input, output, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MapNode } from '../../models/map-node.model';
import { slidePanelAnimation } from '../../animations/travel.animation';

// Curated Unsplash photo IDs for real estate
const UNSPLASH_PHOTOS = [
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=600&h=400&fit=crop',
];

@Component({
  selector: 'app-detail-panel',
  standalone: true,
  imports: [CurrencyPipe],
  animations: [slidePanelAnimation],
  template: `
    <aside class="detail-panel" @slidePanel>
      <div class="panel-header">
        <h2>{{ property().name }}</h2>
        <button class="close-btn" (click)="close.emit()">✕</button>
      </div>

      <!-- Photo gallery -->
      <div class="photo-gallery">
        <img
          [src]="photos()[currentPhotoIndex]"
          alt="Foto del departamento"
          class="gallery-photo"
          (error)="onImageError($event)"
        />
        @if (photos().length > 1) {
          <div class="gallery-controls">
            <button class="gallery-btn" (click)="prevPhoto()">‹</button>
            <span class="gallery-counter"
              >{{ currentPhotoIndex + 1 }} / {{ photos().length }}</span
            >
            <button class="gallery-btn" (click)="nextPhoto()">›</button>
          </div>
        }
      </div>

      @if (property().details; as details) {
        <div class="panel-body">
          <div class="status-badge" [class]="'status-' + details.status">
            {{ getStatusLabel(details.status) }}
          </div>

          <div class="price">
            {{
              details.price
                | currency : details.currency : 'symbol-narrow' : '1.0-0'
            }}
          </div>

          <div class="stats-grid">
            <div class="stat">
              <span class="stat-value">{{ details.area }}</span>
              <span class="stat-label">m²</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ details.bedrooms }}</span>
              <span class="stat-label">Habitaciones</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ details.bathrooms }}</span>
              <span class="stat-label">Baños</span>
            </div>
            @if (details.floor) {
              <div class="stat">
                <span class="stat-value">{{ details.floor }}</span>
                <span class="stat-label">Piso</span>
              </div>
            }
          </div>

          <div class="price-per-m2">
            {{
              details.price / details.area
                | currency : details.currency : 'symbol-narrow' : '1.0-0'
            }}
            / m²
          </div>

          <button class="contact-btn">Contactar</button>
          <button class="schedule-btn">Agendar visita</button>
        </div>
      }
    </aside>
  `,
  styles: [
    `
      .detail-panel {
        position: absolute;
        top: 0;
        right: 0;
        width: 360px;
        height: 100%;
        background: white;
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        background: white;
        z-index: 1;
      }
      .panel-header h2 {
        margin: 0;
        font-size: 18px;
        color: #1f2937;
      }
      .close-btn {
        border: none;
        background: #f3f4f6;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        flex-shrink: 0;
      }
      .close-btn:hover {
        background: #e5e7eb;
      }

      /* Photo gallery */
      .photo-gallery {
        position: relative;
        width: 100%;
        height: 220px;
        overflow: hidden;
        background: #f3f4f6;
      }
      .gallery-photo {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .gallery-controls {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 20px;
        padding: 4px 8px;
      }
      .gallery-btn {
        border: none;
        background: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
      }
      .gallery-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .gallery-counter {
        color: white;
        font-size: 12px;
        font-weight: 500;
      }

      .panel-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        width: fit-content;
      }
      .status-available {
        background: #d1fae5;
        color: #065f46;
      }
      .status-reserved {
        background: #fef3c7;
        color: #92400e;
      }
      .status-sold {
        background: #fee2e2;
        color: #991b1b;
      }
      .price {
        font-size: 28px;
        font-weight: 700;
        color: #1f2937;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .stat {
        background: #f9fafb;
        padding: 12px;
        border-radius: 10px;
        text-align: center;
      }
      .stat-value {
        display: block;
        font-size: 22px;
        font-weight: 700;
        color: #1f2937;
      }
      .stat-label {
        display: block;
        font-size: 12px;
        color: #6b7280;
        margin-top: 2px;
      }
      .price-per-m2 {
        font-size: 14px;
        color: #6b7280;
        text-align: center;
        padding: 8px;
        background: #f9fafb;
        border-radius: 8px;
      }
      .contact-btn,
      .schedule-btn {
        width: 100%;
        padding: 14px;
        border: none;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
      }
      .contact-btn {
        background: #3b82f6;
        color: white;
      }
      .contact-btn:hover {
        background: #2563eb;
      }
      .schedule-btn {
        background: white;
        color: #3b82f6;
        border: 2px solid #3b82f6;
      }
      .schedule-btn:hover {
        background: #eff6ff;
      }

      @media (max-width: 768px) {
        .detail-panel {
          width: 100%;
          height: 50%;
          top: auto;
          bottom: 0;
          border-radius: 20px 20px 0 0;
        }
        .photo-gallery {
          height: 160px;
        }
      }
    `,
  ],
})
export class DetailPanelComponent {
  property = input.required<MapNode>();
  close = output<void>();
  currentPhotoIndex = 0;

  // Generate 3 random photos per property based on its id hash
  photos = computed(() => {
    const node = this.property();
    this.currentPhotoIndex = 0;
    const hash = this.hashCode(node.id);
    const count = 3;
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.abs(hash + i * 7) % UNSPLASH_PHOTOS.length;
      result.push(UNSPLASH_PHOTOS[idx]);
    }
    return result;
  });

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      available: 'Disponible',
      reserved: 'Reservado',
      sold: 'Vendido',
    };
    return labels[status] ?? status;
  }

  nextPhoto(): void {
    const len = this.photos().length;
    this.currentPhotoIndex = (this.currentPhotoIndex + 1) % len;
  }

  prevPhoto(): void {
    const len = this.photos().length;
    this.currentPhotoIndex =
      (this.currentPhotoIndex - 1 + len) % len;
  }

  onImageError(event: Event): void {
    // Fallback to a gradient placeholder if images fail to load
    (event.target as HTMLImageElement).src =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%233B82F6"/><stop offset="100%" stop-color="%238B5CF6"/></linearGradient></defs><rect fill="url(%23g)" width="600" height="400"/><text x="300" y="200" text-anchor="middle" fill="white" font-family="Arial" font-size="18">Foto no disponible</text></svg>'
      );
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash;
  }
}
