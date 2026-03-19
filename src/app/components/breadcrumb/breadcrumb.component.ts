import { Component, input, output } from '@angular/core';
import { MapNode } from '../../models/map-node.model';
import { fadeInAnimation } from '../../animations/travel.animation';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  animations: [fadeInAnimation],
  template: `
    <nav class="breadcrumb" @fadeIn>
      @for (node of breadcrumbs(); track node.id; let last = $last) {
        @if (!last) {
          <button class="breadcrumb-item" (click)="navigateTo.emit(node.id)">
            <span class="type-icon">{{ getIcon(node.type) }}</span>
            {{ node.name }}
          </button>
          <span class="separator">›</span>
        } @else {
          <span class="breadcrumb-item active">
            <span class="type-icon">{{ getIcon(node.type) }}</span>
            {{ node.name }}
          </span>
        }
      }
    </nav>
  `,
  styles: [
    `
      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 12px 20px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid #e5e7eb;
        font-size: 14px;
        flex-wrap: wrap;
      }
      .breadcrumb-item {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: none;
        background: none;
        font-size: 14px;
        cursor: pointer;
        color: #6b7280;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.2s;
        font-family: inherit;
      }
      .breadcrumb-item:hover:not(.active) {
        background: #f3f4f6;
        color: #1f2937;
      }
      .breadcrumb-item.active {
        color: #1f2937;
        font-weight: 600;
        cursor: default;
      }
      .separator {
        color: #d1d5db;
        font-size: 16px;
      }
      .type-icon {
        font-size: 16px;
      }
    `,
  ],
})
export class BreadcrumbComponent {
  breadcrumbs = input.required<MapNode[]>();
  navigateTo = output<string>();

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      city: '🏙️',
      neighborhood: '🏘️',
      building: '🏢',
      floor: '📐',
      property: '🏠',
    };
    return icons[type] ?? '📍';
  }
}
