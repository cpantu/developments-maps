import { Routes } from '@angular/router';
import { MapShellComponent } from './components/map-shell/map-shell.component';

export const routes: Routes = [
  { path: '', component: MapShellComponent },
  { path: '**', redirectTo: '' },
];
