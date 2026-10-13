import type { Car } from "../simulation/Car";
import type { Driver } from "../simulation/Driver";
import { SENSOR_ANGLES, SENSOR_RANGE, type Sensors } from "../simulation/Sensors";
import type { NeuralNetwork } from "./NeuralNetwork";

// Entrées : une par capteur, la vitesse et la glisse. Une couche cachée. Sorties : avancer, freiner, gauche, droite.
export const NETWORK_LAYERS = [SENSOR_ANGLES.length + 2, 8, 4];
// Une glisse latérale de cette vitesse vaut 1 en entrée du réseau.
const LATERAL_SCALE = 20;

// Pilote contrôlé par un réseau de neurones : il ne voit du circuit que ses capteurs et sa vitesse.
export class NeuralDriver implements Driver {
    forward = false;
    backward = false;
    left = false;
    right = false;
    // Intention du réseau, avant le seuil : 0 = pas appuyé, 1 = appuyé à fond. Sert à l'affichage.
    throttle = 0;
    brake = 0;

    network: NeuralNetwork;

    constructor(network: NeuralNetwork) {
        this.network = network;
    }

    drive(car: Car, sensors: Sensors) {
        // Entrées ramenées à des ordres de grandeur proches de 1 : sinon une entrée en dizaines
        // écraserait les autres dans les sommes pondérées.
        const inputs = sensors.distances.map(distance => distance / SENSOR_RANGE);
        inputs.push(car.forwardSpeed / car.maxSpeed, car.lateralSpeed / LATERAL_SCALE);

        const [forward, backward, left, right] = this.network.predict(inputs);
        // tanh renvoie une valeur dans ]-1, 1[ : positive = touche enfoncée.
        this.forward = forward > 0;
        this.backward = backward > 0;
        this.left = left > 0;
        this.right = right > 0;
        this.throttle = Math.max(0, forward);
        this.brake = Math.max(0, backward);
    }
}
