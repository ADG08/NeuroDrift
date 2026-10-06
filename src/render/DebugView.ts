import {
    AxesHelper,
    BufferGeometry,
    Float32BufferAttribute,
    Group,
    LineBasicMaterial,
    LineLoop,
    LineSegments,
    Vector3,
} from "three";
import type { Simulation } from "../simulation/Simulation";
import type { Track } from "../simulation/Track";

// Au-dessus des murs, pour que les lignes restent visibles.
const LINE_Y = 1.2;
const CIRCLE_SEGMENTS = 48;
const WALL_COLOR = 0x39ff88;
const PATH_COLOR = 0x4da3ff;
const FREE_COLOR = 0xffd23f;
const CONTACT_COLOR = 0xff3b3b;

interface Collider {
    simulation: Simulation;
    circle: LineLoop<BufferGeometry, LineBasicMaterial>;
}

// Montre ce que voit la simulation : les segments des murs, le cercle de chaque voiture, la ligne centrale.
export class DebugView {
    readonly group = new Group();
    private readonly colliders: Collider[] = [];

    constructor(track: Track) {
        this.group.visible = false;

        const wallPositions = track.walls.flatMap(({start, end}) => [start.x, LINE_Y, start.z, end.x, LINE_Y, end.z]);
        const wallGeometry = new BufferGeometry();
        wallGeometry.setAttribute("position", new Float32BufferAttribute(wallPositions, 3));
        this.group.add(new LineSegments(wallGeometry, new LineBasicMaterial({color: WALL_COLOR})));

        const path = new BufferGeometry().setFromPoints(track.centerline.map(p => new Vector3(p.x, LINE_Y, p.z)));
        this.group.add(new LineLoop(path, new LineBasicMaterial({color: PATH_COLOR, transparent: true, opacity: 0.5})));

        this.group.add(new AxesHelper(20));
    }

    addCar(simulation: Simulation) {
        const {radius} = simulation.car;
        const points = Array.from({length: CIRCLE_SEGMENTS}, (_, i) => {
            const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
            return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        });
        const circle = new LineLoop(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({color: FREE_COLOR}));
        this.group.add(circle);
        this.colliders.push({simulation, circle});
    }

    sync() {
        for (const {simulation, circle} of this.colliders) {
            const {x, z} = simulation.renderPose();
            circle.position.set(x, LINE_Y, z);
            circle.material.color.set(simulation.inContact ? CONTACT_COLOR : FREE_COLOR);
        }
    }
}
