import type { Car } from "./Car";
import type { CarControls } from "./CarControls";
import { closestPointOnSegment, distance, normalizeAngle, type Pose, type Segment } from "./geometry";
import type { Track } from "./Track";

// Vitesse conservée à chaque pas où l'on frotte un mur : après 1 s de frottement (120 pas), il en reste 30 %.
const WALL_GRIP = 0.99;
// Pas de temps fixe : à la vitesse max (100), la voiture avance de 0,83 par pas, moins que son rayon.
const FIXED_STEP = 1 / 120;

export class Simulation {
    readonly car: Car;
    readonly track: Track;
    inContact = false;
    private accumulator = 0;
    // État de la voiture avant le dernier pas, pour interpoler l'affichage.
    private previous: Pose;

    constructor(car: Car, track: Track) {
        this.car = car;
        this.track = track;
        this.previous = {x: car.x, z: car.z, rotation: car.rotation};
    }

    // À appeler après avoir replacé la voiture : oublie le temps en attente et la pose précédente.
    public reset() {
        this.accumulator = 0;
        this.previous = {x: this.car.x, z: this.car.z, rotation: this.car.rotation};
        this.inContact = false;
    }

    // Consomme le temps écoulé par pas fixes ; le reste est gardé pour la frame suivante.
    public update(dt: number, controls: CarControls) {
        this.accumulator += dt;
        while (this.accumulator >= FIXED_STEP) {
            this.previous = {x: this.car.x, z: this.car.z, rotation: this.car.rotation};
            this.step(FIXED_STEP, controls);
            this.accumulator -= FIXED_STEP;
        }
    }

    // Pose à afficher : entre l'avant-dernier et le dernier pas, au prorata du temps resté dans l'accumulateur.
    // Sans ça, une image peut tomber sur 0, 1 ou 2 pas et la voiture avance par à-coups.
    public renderPose(): Pose {
        const alpha = this.accumulator / FIXED_STEP;
        const {previous, car} = this;
        return {
            x: previous.x + (car.x - previous.x) * alpha,
            z: previous.z + (car.z - previous.z) * alpha,
            rotation: previous.rotation + normalizeAngle(car.rotation - previous.rotation) * alpha,
        };
    }

    private step(dt: number, controls: CarControls) {
        this.car.update(dt, controls);

        const {x, z, radius} = this.car;
        let hitWall = false;
        for (const wall of this.track.wallsInBox(x - radius, z - radius, x + radius, z + radius)) {
            if (this.collideWith(wall)) hitWall = true;
        }
        this.inContact = hitWall;
    }

    // Si la voiture chevauche le mur : la replace à `radius` du mur et retire la vitesse qui rentre dedans.
    // Renvoie true s'il y avait contact.
    private collideWith(wall: Segment): boolean {
        const car = this.car;
        const closest = closestPointOnSegment(car, wall);
        const d = distance(car, closest);
        if (d >= car.radius || d === 0) return false;

        // Normale du contact : vecteur unitaire qui va du mur vers le centre de la voiture.
        const normalX = (car.x - closest.x) / d;
        const normalZ = (car.z - closest.z) / d;
        car.x = closest.x + normalX * car.radius;
        car.z = closest.z + normalZ * car.radius;

        // Produit scalaire vitesse · normale : négatif si la voiture va vers le mur.
        const intoWall = car.velocityX * normalX + car.velocityZ * normalZ;
        if (intoWall < 0) {
            // On retire cette composante (v - n·(v·n)) : il reste la vitesse parallèle au mur, freinée par le frottement.
            car.velocityX = (car.velocityX - normalX * intoWall) * WALL_GRIP;
            car.velocityZ = (car.velocityZ - normalZ * intoWall) * WALL_GRIP;
        }
        return true;
    }
}
