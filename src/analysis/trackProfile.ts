import type { Car } from "../simulation/Car";
import { distance, normalizeAngle } from "../simulation/geometry";
import type { Track } from "../simulation/Track";

// Un virage est une zone où le rayon de courbure passe sous ce seuil.
const CORNER_RADIUS = 90;
// Demi-fenêtre (en points) pour mesurer la courbure : assez large pour lisser le tracé.
const CURVATURE_WINDOW = 3;
// Deux zones de même sens séparées de moins de points que ça forment un seul virage.
const MERGE_GAP = 6;
const MIN_CORNER_POINTS = 4;

export interface Corner {
    number: number;
    start: number;       // index de la ligne centrale
    apex: number;        // point le plus serré
    end: number;
    direction: "gauche" | "droite";
    radius: number;      // rayon au point le plus serré
}

// Référence pour juger un pilote : les virages du circuit et la vitesse idéale en chaque point.
export interface TrackProfile {
    corners: Corner[];
    idealSpeed: number[];     // vitesse idéale à chaque point de la ligne centrale
    segmentLength: number[];  // distance du point i au point i + 1
    idealLapTime: number;
}

export function buildTrackProfile(track: Track, car: Car): TrackProfile {
    const n = track.centerline.length;
    const segmentLength = segmentLengths(track);
    const curvature = trackCurvature(track);
    const idealSpeed = speedProfile(curvature, segmentLength, car);
    let idealLapTime = 0;
    for (let i = 0; i < n; i++) idealLapTime += segmentLength[i] / ((idealSpeed[i] + idealSpeed[(i + 1) % n]) / 2);

    return {corners: findCorners(curvature), idealSpeed, segmentLength, idealLapTime};
}

// Les virages seuls, sans calcul de vitesse : utile pour habiller le circuit (panneaux, vibreurs).
export function detectCorners(track: Track): Corner[] {
    return findCorners(trackCurvature(track));
}

function segmentLengths(track: Track): number[] {
    return track.centerline.map((p, i) => distance(p, track.centerline[track.wrapIndex(i + 1)]));
}

// Courbure signée : variation du cap divisée par la distance parcourue. Positive = virage à gauche.
function trackCurvature(track: Track): number[] {
    const segmentLength = segmentLengths(track);
    return track.centerline.map((_, i) => {
        const turn = normalizeAngle(track.headingAt(i + CURVATURE_WINDOW) - track.headingAt(i - CURVATURE_WINDOW));
        return turn / (2 * CURVATURE_WINDOW * segmentLength[i]);
    });
}

// Simulation de tour « point-masse », la méthode classique des ingénieurs en sport auto :
// 1. dans chaque virage, la vitesse max que tiennent les pneus ;
// 2. passe avant : on ne peut pas accélérer plus vite que le moteur ;
// 3. passe arrière : on ne peut pas freiner plus fort que les freins (c'est ce qui place les points de freinage).
function speedProfile(curvature: number[], segmentLength: number[], car: Car): number[] {
    const n = curvature.length;
    const speed = curvature.map(k => cornerSpeedLimit(Math.abs(k), car));

    // Deux tours de boucle : le circuit est fermé, la fin influence le début.
    for (let step = 0; step < 2 * n; step++) {
        const i = step % n;
        const next = (i + 1) % n;
        speed[next] = Math.min(speed[next], Math.sqrt(speed[i] ** 2 + 2 * car.acceleration * segmentLength[i]));
    }
    for (let step = 2 * n - 1; step >= 0; step--) {
        const i = step % n;
        const next = (i + 1) % n;
        speed[i] = Math.min(speed[i], Math.sqrt(speed[next] ** 2 + 2 * car.braking * segmentLength[i]));
    }
    return speed;
}

function cornerSpeedLimit(curvature: number, car: Car): number {
    if (curvature < 1e-6) return car.maxSpeed;
    // Pneus : l'accélération latérale v² / R ne doit pas dépasser l'adhérence.
    return Math.min(car.maxSpeed, Math.sqrt(Math.min(car.frontGrip, car.rearGrip) / curvature));
}

function findCorners(curvature: number[]): Corner[] {
    const n = curvature.length;
    const sign = curvature.map(k => (Math.abs(k) > 1 / CORNER_RADIUS ? Math.sign(k) : 0));

    // On démarre le parcours sur un point hors virage, pour ne pas couper un virage en deux à la ligne de départ.
    const origin = Math.max(0, sign.findIndex(s => s === 0));
    const runs: {start: number; length: number; sign: number}[] = [];
    for (let k = 0; k < n; k++) {
        const i = (origin + k) % n;
        if (sign[i] === 0) continue;
        const last = runs.at(-1);
        const gap = last ? k - (last.start + last.length) : Infinity;
        if (last && last.sign === sign[i] && gap <= MERGE_GAP) last.length = k - last.start + 1;
        else runs.push({start: k, length: 1, sign: sign[i]});
    }

    return runs
        .filter(run => run.length >= MIN_CORNER_POINTS)
        .map((run, number) => {
            let apex = run.start;
            for (let k = run.start; k < run.start + run.length; k++) {
                if (Math.abs(curvature[(origin + k) % n]) > Math.abs(curvature[(origin + apex) % n])) apex = k;
            }
            return {
                number: number + 1,
                start: (origin + run.start) % n,
                apex: (origin + apex) % n,
                end: (origin + run.start + run.length - 1) % n,
                direction: run.sign > 0 ? "gauche" : "droite",
                radius: 1 / Math.abs(curvature[(origin + apex) % n]),
            };
        });
}
