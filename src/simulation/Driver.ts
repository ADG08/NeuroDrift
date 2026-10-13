import type { Car } from "./Car";
import type { CarControls } from "./CarControls";
import type { Sensors } from "./Sensors";

// Un pilote qui décide lui-même de ses commandes à chaque image (pilote automatique, IA),
// contrairement au clavier dont les commandes viennent du joueur.
export interface Driver extends CarControls {
    drive(car: Car, sensors: Sensors): void;
}
