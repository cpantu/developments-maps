export type NodeType = 'city' | 'neighborhood' | 'building' | 'property';

export interface MapNode {
  id: string;
  name: string;
  type: NodeType;
  description?: string;
  thumbnail?: string;
  center: [number, number];
  zoom: number;
  polygon?: [number, number][];
  imageOverlay?: {
    url: string;
    bounds: [[number, number], [number, number]];
  };
  details?: PropertyDetails;
  children?: MapNode[];
}

export interface PropertyDetails {
  price: number;
  currency: string;
  area: number;
  bedrooms: number;
  bathrooms: number;
  floor?: number;
  status: 'available' | 'reserved' | 'sold';
  images?: string[];
}
