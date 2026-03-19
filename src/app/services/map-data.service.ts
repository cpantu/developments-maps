import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MapNode } from '../models/map-node.model';

@Injectable({ providedIn: 'root' })
export class MapDataService {
  private root = signal<MapNode | null>(null);
  private nodeIndex = new Map<string, MapNode>();

  constructor(private http: HttpClient) {
    this.loadData();
  }

  private loadData(): void {
    this.http.get<MapNode>('assets/data/map-data.json').subscribe((data) => {
      this.buildIndex(data);
      this.root.set(data);
    });
  }

  private buildIndex(node: MapNode): void {
    this.nodeIndex.set(node.id, node);
    node.children?.forEach((child) => this.buildIndex(child));
  }

  getRootNode() {
    return this.root.asReadonly();
  }

  findNode(id: string): MapNode | undefined {
    return this.nodeIndex.get(id);
  }

  getPathTo(id: string): MapNode[] {
    const path: MapNode[] = [];
    const root = this.root();
    if (!root) return path;

    const search = (node: MapNode, trail: MapNode[]): boolean => {
      trail.push(node);
      if (node.id === id) return true;
      for (const child of node.children ?? []) {
        if (search(child, trail)) return true;
      }
      trail.pop();
      return false;
    };

    search(root, path);
    return path;
  }
}
