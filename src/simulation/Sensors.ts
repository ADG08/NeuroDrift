import { raySegmentDistance, type Pose, type Segment } from "./geometry";

// Angles des rayons par rapport à l'avant de la voiture, positifs vers la gauche (comme le braquage).
export const SENSOR_ANGLES = [-90, -45, -20, 0, 20, 45, 90].map(degrees => (degrees * Math.PI) / 180);
export const SENSOR_RANGE = 60;

// Rayons partant du centre de la voiture : chacun mesure la distance jusqu'au premier mur, plafonnée à SENSOR_RANGE.
// C'est tout ce que « verra » l'IA du circuit.
export class Sensors {
    readonly distances = SENSOR_ANGLES.map(() => SENSOR_RANGE);

    update(pose: Pose, walls: Segment[]) {
        SENSOR_ANGLES.forEach((offset, i) => {
            const angle = pose.rotation + offset;
            const dirX = Math.sin(angle);
            const dirZ = Math.cos(angle);

            let nearest = SENSOR_RANGE;
            for (const wall of walls) {
                const d = raySegmentDistance(pose, dirX, dirZ, wall);
                if (d !== null && d < nearest) nearest = d;
            }
            this.distances[i] = nearest;
        });
    }
}
