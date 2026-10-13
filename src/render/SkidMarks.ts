import { InstancedMesh, Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from "three";
import { distance, type Point, type Pose } from "../simulation/geometry";

const MAX_MARKS = 4000;
const MARK_SPACING = 0.6;
const MARK_WIDTH = 0.4;
const MARK_Y = 0.07;
// Position des roues arrière dans le repère de la voiture (voir CarView).
const REAR_AXLE = -2.65;
const HALF_TRACK = 1.25;

// Traces de pneus laissées au sol par les voitures qui glissent.
// Un seul InstancedMesh pour toutes les traces ; quand il est plein, les plus anciennes sont réutilisées.
export class SkidMarks {
    readonly mesh: InstancedMesh;
    private next = 0;
    // Dernière trace posée par chaque voiture, pour en poser une tous les MARK_SPACING.
    private readonly lastMark = new Map<object, Point>();
    private readonly matrix = new Matrix4();
    private readonly position = new Vector3();
    private readonly rotation = new Quaternion();
    private readonly scale = new Vector3(1, 1, 1);
    private readonly up = new Vector3(0, 1, 0);

    constructor() {
        const geometry = new PlaneGeometry(MARK_WIDTH, MARK_SPACING * 1.3).rotateX(-Math.PI / 2);
        const material = new MeshBasicMaterial({
            color: 0x0b0d10,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4,
        });
        this.mesh = new InstancedMesh(geometry, material, MAX_MARKS);
        this.mesh.count = 0;
        // Les traces couvrent tout le circuit : inutile de calculer si elles sont dans le champ.
        this.mesh.frustumCulled = false;
    }

    add(car: object, pose: Pose, drifting: boolean) {
        if (!drifting) {
            this.lastMark.delete(car);
            return;
        }
        const last = this.lastMark.get(car);
        if (last && distance(last, pose) < MARK_SPACING) return;
        this.lastMark.set(car, {x: pose.x, z: pose.z});

        const sin = Math.sin(pose.rotation);
        const cos = Math.cos(pose.rotation);
        this.rotation.setFromAxisAngle(this.up, pose.rotation);
        for (const side of [-1, 1]) {
            // Roue arrière : on recule sur l'axe avant (sin, cos) et on se décale sur l'axe gauche (cos, -sin).
            this.position.set(pose.x + sin * REAR_AXLE + cos * side * HALF_TRACK, MARK_Y, pose.z + cos * REAR_AXLE - sin * side * HALF_TRACK);
            this.mesh.setMatrixAt(this.next, this.matrix.compose(this.position, this.rotation, this.scale));
            this.next = (this.next + 1) % MAX_MARKS;
            this.mesh.count = Math.min(this.mesh.count + 1, MAX_MARKS);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    clear() {
        this.mesh.count = 0;
        this.next = 0;
        this.lastMark.clear();
    }
}
