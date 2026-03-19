import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

export const travelOverlayAnimation = trigger('travelOverlay', [
  state('idle', style({ opacity: 0, pointerEvents: 'none' })),
  state('traveling', style({ opacity: 1, pointerEvents: 'all' })),
  transition('idle => traveling', animate('400ms ease-in')),
  transition('traveling => idle', animate('600ms 200ms ease-out')),
]);

export const slidePanelAnimation = trigger('slidePanel', [
  transition(':enter', [
    style({ transform: 'translateX(100%)', opacity: 0 }),
    animate(
      '350ms cubic-bezier(0.25, 0.8, 0.25, 1)',
      style({ transform: 'translateX(0)', opacity: 1 })
    ),
  ]),
  transition(':leave', [
    animate(
      '250ms cubic-bezier(0.25, 0.8, 0.25, 1)',
      style({ transform: 'translateX(100%)', opacity: 0 })
    ),
  ]),
]);

export const fadeInAnimation = trigger('fadeIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(10px)' }),
    animate(
      '300ms ease-out',
      style({ opacity: 1, transform: 'translateY(0)' })
    ),
  ]),
]);
