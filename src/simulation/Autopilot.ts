import type { Car } from "./Car";
import type { CarControls } from "./CarControls";
import { headingTo, normalizeAngle } from "./geometry";
import type { Progress } from "./Progress";
import type { Track } from "./Track";

const STEER_DEADZONE = 0.04;
const MIN_SPEED_RATIO = 0.45;
const BRAKE_MARGIN = 2;

export interface AutopilotSettings {
    topSpeed: number;
    lookahead: number;   // nombre de points de la ligne centrale visés en avant
    line: number;        // trajectoire : -1 bord droit, 0 centre, 1 bord gauche
}

// Pilote scripté qui suit la ligne centrale. Il produit des CarControls, exactement comme le clavier :
// c'est la place que prendra l'IA plus tard.
export class Autopilot implements CarControls {
    forward = false;
    backward = false;
    left = false;
    right = false;

    private readonly track: Track;
    private readonly progress: Progress;
    private readonly settings: AutopilotSettings;

    constructor(track: Track, progress: Progress, settings: AutopilotSettings) {
        this.track = track;
        this.progress = progress;
        this.settings = settings;
    }

    drive(car: Car) {
        const {topSpeed, lookahead, line} = this.settings;

        const target = this.track.pointAt(this.progress.index + lookahead, line);
        const steerError = normalizeAngle(headingTo(car, target) - car.rotation);
        this.left = steerError > STEER_DEADZONE;
        this.right = steerError < -STEER_DEADZONE;

        // Plus la piste tourne loin devant, plus on lève le pied.
        const farTarget = this.track.pointAt(this.progress.index + lookahead * 3, line);
        const turn = Math.abs(normalizeAngle(headingTo(car, farTarget) - car.rotation));
        const speedLimit = topSpeed * Math.max(1 - turn, MIN_SPEED_RATIO);
        this.forward = car.currentSpeed < speedLimit;
        this.backward = car.currentSpeed > speedLimit + BRAKE_MARGIN;
    }
}
