import { userGuides } from './user-guides.js';
// Add a new release with its own ID and screenshots when publishing new features.
export const appUpdates = {
 id: '2026-11-visual-guides-v2',
 title: 'Tu viaje, más fácil',
 slides: [
  {...userGuides[0].steps[2], title:'Una parada, todos los movimientos', text:'Gestiona acompañantes y remolques juntos. Confirma una sola vez para registrar la parada.'},
  {...userGuides[1].steps[1], title:'Cada enganche, una inspección', text:'Al recoger un remolque, realiza una inspección nueva desde la misma parada.'}
 ]
};
