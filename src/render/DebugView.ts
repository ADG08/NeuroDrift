import {
    AxesHelper,
    BufferAttribute,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    Group,
    LineBasicMaterial,
    LineLoop,
    LineSegments,
    Vector3,
} from "three";
import { SENSOR_ANGLES, SENSOR_RANGE, type Sensors } from "../simulation/Sensors";
import type { Simulation } from "../simulation/Simulation";
import type { Track } from "../simulation/Track";

// Au-dessus des murs, pour que les lignes restent visibles.
const LINE_Y = 1.2;
const CIRCLE_SEGMENTS = 48;
const WALL_COLOR = 0x39ff88;
const PATH_COLOR = 0x4da3ff;
const FREE_COLOR = 0xffd23f;
const CONTACT_COLOR = 0xff3b3b;
const RAY_NEAR = new Color(0xff3b3b);
const RAY_FAR = new Color(0x39ff88);

interface DebugCar {
    simulation: Simulation;
    sensors: Sensors;
    circle: LineLoop<BufferGeometry, LineBasicMaterial>;
    rays: LineSegments<BufferGeometry, LineBasicMaterial>;
}

// Montre ce que voit la simulation : les segments des murs, la ligne centrale,
// et pour chaque voiture son cercle de collision et ses capteurs.
export class DebugView {
    readonly group = new Group();
    private readonly cars: DebugCar[] = [];
    private readonly rayColor = new Color();

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

    addCar(simulation: Simulation, sensors: Sensors) {
        const {radius} = simulation.car;
        const points = Array.from({length: CIRCLE_SEGMENTS}, (_, i) => {
            const angle = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
            return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        });
        const circle = new LineLoop(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({color: FREE_COLOR}));

        // Deux sommets par rayon (origine, impact), réécrits à chaque image.
        const vertexCount = SENSOR_ANGLES.length * 2;
        const rayGeometry = new BufferGeometry();
        rayGeometry.setAttribute("position", new BufferAttribute(new Float32Array(vertexCount * 3), 3));
        rayGeometry.setAttribute("color", new BufferAttribute(new Float32Array(vertexCount * 3), 3));
        const rays = new LineSegments(rayGeometry, new LineBasicMaterial({vertexColors: true}));
        // La sphère englobante est calculée une seule fois ; comme les sommets bougent, three.js
        // croirait à tort les rayons hors champ et ne les dessinerait plus.
        rays.frustumCulled = false;

        this.group.add(circle, rays);
        this.cars.push({simulation, sensors, circle, rays});
    }

    sync() {
        for (const {simulation, sensors, circle, rays} of this.cars) {
            const pose = simulation.renderPose();
            circle.position.set(pose.x, LINE_Y, pose.z);
            circle.material.color.set(simulation.inContact ? CONTACT_COLOR : FREE_COLOR);

            const positions = rays.geometry.getAttribute("position");
            const colors = rays.geometry.getAttribute("color");
            sensors.distances.forEach((distance, i) => {
                const angle = pose.rotation + SENSOR_ANGLES[i];
                positions.setXYZ(2 * i, pose.x, LINE_Y, pose.z);
                positions.setXYZ(2 * i + 1, pose.x + Math.sin(angle) * distance, LINE_Y, pose.z + Math.cos(angle) * distance);

                const {r, g, b} = this.rayColor.lerpColors(RAY_NEAR, RAY_FAR, distance / SENSOR_RANGE);
                colors.setXYZ(2 * i, r, g, b);
                colors.setXYZ(2 * i + 1, r, g, b);
            });
            positions.needsUpdate = true;
            colors.needsUpdate = true;
        }
    }
}
