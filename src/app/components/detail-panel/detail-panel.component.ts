import { Component, input, output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MapNode } from '../../models/map-node.model';
import { slidePanelAnimation } from '../../animations/travel.animation';

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

      @if (property().details; as details) {
        <div class="panel-body">
          <div class="status-badge" [class]="'status-' + details.status">
            {{ getStatusLabel(details.status) }}
          </div>

          <div class="price">
            {{ details.price | currency : details.currency : 'symbol-narrow' : '1.0-0' }}
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
            {{ details.price / details.area | currency : details.currency : 'symbol-narrow' : '1.0-0' }} / m²
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
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        background: white;
      }
      .panel-header h2 {
        margin: 0;
        font-size: 20px;
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
      }
      .close-btn:hover {
        background: #e5e7eb;
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
      }
    `,
  ],
})
export class DetailPanelComponent {
  property = input.required<MapNode>();
  close = output<void>();

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      available: 'Disponible',
      reserved: 'Reservado',
      sold: 'Vendido',
    };
    return labels[status] ?? status;
  }
}
