import { Injectable, signal, computed } from '@angular/core';
import { MapNode } from '../models/map-node.model';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private stack = signal<MapNode[]>([]);

  currentNode = computed(() => {
    const s = this.stack();
    return s.length > 0 ? s[s.length - 1] : null;
  });

  breadcrumbs = this.stack.asReadonly();

  isTransitioning = signal(false);

  selectedProperty = signal<MapNode | null>(null);

  initialize(root: MapNode): void {
    this.stack.set([root]);
    this.selectedProperty.set(null);
  }

  navigateToChild(node: MapNode): void {
    if (node.type === 'property') {
      this.selectedProperty.set(node);
    } else {
      this.selectedProperty.set(null);
      this.stack.update((s) => [...s, node]);
    }
  }

  navigateTo(nodeId: string): void {
    this.selectedProperty.set(null);
    this.stack.update((s) => {
      const idx = s.findIndex((n) => n.id === nodeId);
      return idx >= 0 ? s.slice(0, idx + 1) : s;
    });
  }

  goBack(): void {
    this.selectedProperty.set(null);
    this.stack.update((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }
}
