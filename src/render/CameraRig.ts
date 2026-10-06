import { PerspectiveCamera, Vector3 } from "three";
import { normalizeAngle, type Pose } from "../simulation/geometry";

const BASE_FOV = 70;

const CHASE_DISTANCE = 13;
const CHASE_HEIGHT = 8;
const CHASE_LOOK_AHEAD = 12;
// Vitesse à laquelle la caméra rattrape l'orientation de la voiture dans les virages.
const CHASE_TURN_STIFFNESS = 6;

const OVERHEAD_HEIGHT = 90;
const OVERHEAD_STIFFNESS = 5;

const SHOWCASE_RADIUS = 26;
const SHOWCASE_HEIGHT = 10;
const SHOWCASE_SPIN = 0.12;
const SHOWCASE_STIFFNESS = 1.5;
// En menu, le centre de l'image est décalé vers la droite pour ne pas cacher la voiture derrière le panneau.
const SHOWCASE_SHIFT = 0.18;
const WIDE_SCREEN = 820;

// Place la caméra selon un plan (poursuite, dessus, diffusion), en glissant en douceur vers la position voulue.
export class CameraRig {
    private readonly camera: PerspectiveCamera;
    private readonly position = new Vector3();
    private readonly target = new Vector3();
    private readonly desiredPosition = new Vector3();
    private readonly desiredTarget = new Vector3();
    private snapNext = true;
    // Orientation lissée de la vue poursuite.
    private chaseHeading = 0;

    constructor(camera: PerspectiveCamera) {
        this.camera = camera;
    }

    // Changement de plan franc : la prochaine image place la caméra directement, sans glisser depuis l'ancien plan.
    cut() {
        this.snapNext = true;
    }

    // Vue poursuite à la Trackmania : derrière et au-dessus de la voiture, le regard porté devant elle.
    // Seul l'angle est lissé : la distance reste fixe, donc la caméra ne recule pas quand la voiture accélère.
    chase(pose: Pose, dt: number) {
        if (this.snapNext) {
            this.chaseHeading = pose.rotation;
        } else {
            this.chaseHeading += normalizeAngle(pose.rotation - this.chaseHeading) * (1 - Math.exp(-CHASE_TURN_STIFFNESS * dt));
        }

        const forwardX = Math.sin(this.chaseHeading);
        const forwardZ = Math.cos(this.chaseHeading);
        this.desiredPosition.set(pose.x - forwardX * CHASE_DISTANCE, CHASE_HEIGHT, pose.z - forwardZ * CHASE_DISTANCE);
        this.desiredTarget.set(pose.x + forwardX * CHASE_LOOK_AHEAD, 1, pose.z + forwardZ * CHASE_LOOK_AHEAD);
        this.camera.up.set(0, 1, 0);
        // Raideur infinie : 1 - e^(-∞) = 1, la caméra est placée exactement à sa position, sans retard.
        this.apply(Infinity, dt, BASE_FOV, 0);
    }

    // Vue de dessus qui suit la voiture, -z en haut de l'écran.
    overhead(pose: Pose, dt: number) {
        this.desiredPosition.set(pose.x, OVERHEAD_HEIGHT, pose.z);
        this.desiredTarget.set(pose.x, 0, pose.z);
        this.camera.up.set(0, 0, -1);
        this.apply(OVERHEAD_STIFFNESS, dt, BASE_FOV, 0);
    }

    // Plan de diffusion pour le menu : tourne lentement autour d'une voiture.
    showcase(pose: Pose, time: number, dt: number) {
        const angle = time * SHOWCASE_SPIN;
        this.desiredPosition.set(
            pose.x + Math.cos(angle) * SHOWCASE_RADIUS,
            SHOWCASE_HEIGHT,
            pose.z + Math.sin(angle) * SHOWCASE_RADIUS,
        );
        this.desiredTarget.set(pose.x, 1, pose.z);
        this.camera.up.set(0, 1, 0);
        this.apply(SHOWCASE_STIFFNESS, dt, BASE_FOV, window.innerWidth > WIDE_SCREEN ? SHOWCASE_SHIFT : 0);
    }

    private apply(stiffness: number, dt: number, fov: number, shift: number) {
        if (this.snapNext) {
            this.position.copy(this.desiredPosition);
            this.target.copy(this.desiredTarget);
            this.snapNext = false;
        } else {
            // Lissage exponentiel : on parcourt la même fraction du chemin restant par seconde, quel que soit le framerate.
            const t = 1 - Math.exp(-stiffness * dt);
            this.position.lerp(this.desiredPosition, t);
            this.target.lerp(this.desiredTarget, t);
        }
        this.camera.position.copy(this.position);
        this.camera.lookAt(this.target);

        this.camera.fov = fov;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        if (shift === 0) {
            this.camera.clearViewOffset();
        } else {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera.setViewOffset(width, height, -width * shift, 0, width, height);
        }
        this.camera.updateProjectionMatrix();
    }
}
