import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import type { Track } from "../simulation/Track";

const WALL_HEIGHT = 1;
const WALL_THICKNESS = 0.5;

export class TrackView {
    readonly group = new Group();

    constructor(track: Track) {
        const material = new MeshBasicMaterial({color: 0xb0b8bd});

        for (const { start, end } of track.walls) {
            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const length = Math.hypot(dx, dz);

            // La boîte est allongée sur son axe Z local, comme l'avant de la voiture.
            const wall = new Mesh(new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, length), material);
            wall.position.set((start.x + end.x) / 2, WALL_HEIGHT / 2, (start.z + end.z) / 2);
            wall.rotation.y = Math.atan2(dx, dz);
            this.group.add(wall);
        }
    }
}
