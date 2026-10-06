import type { Car } from "./Car";
import type { CarControls } from "./CarControls";
import { closestPointOnSegment, distance, type Segment } from "./geometry";
import type { Track } from "./Track";

const WALL_SPEED_FACTOR = 0.5;

export class Simulation {
    readonly car: Car;
    readonly track: Track;

    constructor(car: Car, track: Track) {
        this.car = car;
        this.track = track;
    }

    public update(dt: number, controls: CarControls) {
        this.car.update(dt, controls);

        let hitWall = false;
        for (const wall of this.track.walls) {
            if (this.pushOutOf(wall)) hitWall = true;
        }
        if (hitWall) this.car.currentSpeed *= WALL_SPEED_FACTOR;
    }

    // Replace le centre de la voiture à exactement `radius` du mur. Renvoie true s'il y avait contact.
    private pushOutOf(wall: Segment): boolean {
        const car = this.car;
        const closest = closestPointOnSegment(car, wall);
        const d = distance(car, closest);
        if (d >= car.radius || d === 0) return false;

        car.x = closest.x + (car.x - closest.x) / d * car.radius;
        car.z = closest.z + (car.z - closest.z) / d * car.radius;
        return true;
    }
}
