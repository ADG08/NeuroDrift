import {
    BoxGeometry,
    Color,
    CylinderGeometry,
    Group,
    Mesh,
    MeshStandardMaterial,
    type Material,
} from "three";
import type { Pose } from "../simulation/geometry";

// Coupé de drift, propulsion à moteur avant. Dimensions en mètres : 4,4 m de long pour 1,9 m de large,
// ce qui colle au cercle de collision de 2 m de rayon.
const WHEEL_RADIUS = 0.36;
const WHEEL_WIDTH = 0.28;
// Position des roues dans le repère de la voiture (même empattement que Car.axleDistance).
export const AXLE_OFFSET = 1.3;
export const HALF_TRACK = 0.82;

export class CarView {
    readonly object = new Group();
    private readonly materials = new Set<Material>();
    // Pivots des roues avant : ils tournent avec l'angle de braquage.
    private readonly frontWheels: Group[] = [];

    constructor(color = 0x087f9f) {
        const paint = new MeshStandardMaterial({color, roughness: 0.3, metalness: 0.4});
        const darkPaint = new MeshStandardMaterial({color: new Color(color).multiplyScalar(0.6), roughness: 0.4, metalness: 0.4});
        const glass = new MeshStandardMaterial({color: 0x10161d, roughness: 0.1, metalness: 0.6});
        const trim = new MeshStandardMaterial({color: 0x14181d, roughness: 0.8});
        const tire = new MeshStandardMaterial({color: 0x15171a, roughness: 0.9});
        const rim = new MeshStandardMaterial({color: 0xb8c0c8, roughness: 0.3, metalness: 0.8});
        const headlight = new MeshStandardMaterial({color: 0xfff4d6, emissive: 0xfff4d6, emissiveIntensity: 0.6});
        const taillight = new MeshStandardMaterial({color: 0xd8333a, emissive: 0xd8333a, emissiveIntensity: 0.5});

        // Caisse basse, capot long et cabine reculée : la silhouette d'une propulsion.
        this.add(new BoxGeometry(1.9, 0.5, 4.4), paint, 0, 0.55, 0);
        this.add(new BoxGeometry(1.86, 0.12, 1.5), darkPaint, 0, 0.86, 1.25);               // capot
        this.add(new BoxGeometry(1.6, 0.48, 1.9), glass, 0, 1.04, -0.35);                  // cabine vitrée
        this.add(new BoxGeometry(1.5, 0.08, 1.4), paint, 0, 1.3, -0.4);                    // toit
        this.add(new BoxGeometry(1.94, 0.22, 4.5), trim, 0, 0.32, 0);                      // bas de caisse et pare-chocs
        this.add(new BoxGeometry(1.7, 0.06, 0.4), trim, 0, 1.2, -2.05);                     // aileron
        for (const x of [-0.6, 0.6]) {
            this.add(new BoxGeometry(0.06, 0.32, 0.12), trim, x, 1.0, -2.0);               // pieds d'aileron
            this.add(new BoxGeometry(0.42, 0.12, 0.05), headlight, x, 0.62, 2.2);
            this.add(new BoxGeometry(0.46, 0.12, 0.05), taillight, x, 0.66, -2.2);
        }

        const wheelGeometry = new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 16).rotateZ(Math.PI / 2);
        const rimGeometry = new CylinderGeometry(WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, WHEEL_WIDTH + 0.02, 10).rotateZ(Math.PI / 2);
        for (const z of [AXLE_OFFSET, -AXLE_OFFSET]) {
            for (const x of [-HALF_TRACK, HALF_TRACK]) {
                const wheel = new Group();
                wheel.position.set(x, WHEEL_RADIUS, z);
                wheel.add(new Mesh(wheelGeometry, tire), new Mesh(rimGeometry, rim));
                this.object.add(wheel);
                if (z > 0) this.frontWheels.push(wheel);
            }
        }

        this.object.traverse(object => {
            if (object instanceof Mesh) this.materials.add(object.material);
        });
    }

    // Voiture éliminée : affichée en transparence. Changer transparent impose de recompiler le matériau (needsUpdate).
    setRetired(retired: boolean) {
        for (const material of this.materials) {
            material.transparent = retired;
            material.opacity = retired ? 0.2 : 1;
            material.needsUpdate = true;
        }
    }

    // La vue affiche la pose interpolée fournie par la Simulation, et braque les roues avant.
    sync(pose: Pose, steerAngle: number) {
        this.object.position.set(pose.x, 0, pose.z);
        this.object.rotation.y = pose.rotation;
        for (const wheel of this.frontWheels) wheel.rotation.y = steerAngle;
    }

    private add(geometry: BoxGeometry, material: Material, x: number, y: number, z: number) {
        const mesh = new Mesh(geometry, material);
        mesh.position.set(x, y, z);
        this.object.add(mesh);
    }
}
