import type { LapRecord, Sample, Telemetry } from "./Telemetry";
import type { Corner, TrackProfile } from "./trackProfile";

const MS_TO_KMH = 3.6;
// Nombre de points avant un virage où l'on cherche le freinage du pilote.
const BRAKING_SEARCH = 40;
// Points mesurés après la sortie : un virage raté se paie surtout en réaccélérant.
const EXIT_LENGTH = 15;

export interface CornerReport {
    corner: Corner;
    entrySpeed: number;
    idealEntry: number;
    minSpeed: number;
    idealMin: number;
    brakeOffset: number | null;   // mètres : positif = freinage plus tôt que l'idéal, null = pas de freinage
    driftTime: number;
    contacts: number;
    exitThrottle: number;         // part du temps à pleins gaz entre le point de corde et la sortie
    timeLost: number;             // secondes perdues par rapport à la référence (négatif = plus rapide)
    advice: string;
}

export interface RaceReport {
    lapTimes: number[];
    bestLap: number;
    idealLap: number;
    corners: CornerReport[];
    driftTime: number;
    contacts: number;
    throttleShare: number;
    brakeShare: number;
    speedTrace: number[];   // vitesse du meilleur tour en chaque point (NaN si non mesurée)
    idealTrace: number[];   // vitesse de référence en chaque point
}

// Compare le meilleur tour du pilote à la référence, virage par virage.
export function analyzeRace(telemetry: Telemetry, profile: TrackProfile): RaceReport | null {
    const best = telemetry.bestLap;
    if (best === null) return null;

    const {samples} = telemetry;
    return {
        lapTimes: telemetry.laps.map(lap => lap.time),
        bestLap: best.time,
        idealLap: profile.idealLapTime,
        corners: profile.corners.map(corner => analyzeCorner(corner, samples, best, profile)),
        driftTime: duration(samples, sample => sample.drifting),
        contacts: countContacts(samples),
        throttleShare: samples.filter(sample => sample.throttle).length / samples.length,
        brakeShare: samples.filter(sample => sample.brake).length / samples.length,
        speedTrace: speedTrace(samples.slice(best.from, best.to), profile.idealSpeed.length),
        idealTrace: profile.idealSpeed,
    };
}

function analyzeCorner(corner: Corner, samples: Sample[], lap: LapRecord, profile: TrackProfile): CornerReport {
    const n = profile.idealSpeed.length;
    const idealBrake = idealBrakingPoint(corner, profile);
    // Le passage du meilleur tour dans la zone, du point de freinage idéal à la sortie.
    const zoneEnd = corner.end + EXIT_LENGTH;
    const zone = pass(samples, lap, indices(corner.start - BRAKING_SEARCH, zoneEnd, n));
    const at = (from: number, to: number) => {
        const wanted = new Set(indices(from, to, n));
        return zone.filter(sample => wanted.has(sample.index));
    };
    const inCorner = at(corner.start, corner.end);
    const approach = at(corner.start - BRAKING_SEARCH, corner.start);
    const fromIdealBrake = at(idealBrake, zoneEnd);
    const exit = at(corner.apex, corner.end);

    const firstBrake = approach.find(sample => sample.brake);
    // On compare sur la portion réellement parcourue : le dernier passage peut être coupé par la fin de la course.
    const first = fromIdealBrake[0];
    const last = fromIdealBrake[fromIdealBrake.length - 1];
    const playerTime = first ? last.time - first.time : 0;
    const idealTime = first ? indices(first.index, last.index, n).slice(0, -1).reduce((sum, i) => sum + profile.segmentLength[i] / profile.idealSpeed[i], 0) : 0;

    const report: CornerReport = {
        corner,
        entrySpeed: inCorner[0]?.speed ?? 0,
        idealEntry: profile.idealSpeed[corner.start],
        minSpeed: inCorner.length === 0 ? 0 : Math.min(...inCorner.map(sample => sample.speed)),
        idealMin: Math.min(...indices(corner.start, corner.end, n).map(i => profile.idealSpeed[i])),
        brakeOffset: firstBrake ? forwardSteps(firstBrake.index, idealBrake, n) * meanSpacing(profile) : null,
        driftTime: duration(zone, sample => sample.drifting),
        contacts: countContacts(zone),
        exitThrottle: exit.length === 0 ? 1 : exit.filter(sample => sample.throttle).length / exit.length,
        timeLost: playerTime - idealTime,
        advice: "",
    };
    report.advice = advise(report);
    return report;
}

// Une remarque par virage : la cause principale, avec les chiffres qui la justifient.
function advise(r: CornerReport): string {
    const kmh = (speed: number) => `${Math.round(speed * MS_TO_KMH)} km/h`;
    const tooFast = r.entrySpeed > r.idealEntry * 1.1;
    if (r.contacts > 0 && tooFast) return `Tu arrives trop vite (${kmh(r.entrySpeed)} au lieu de ${kmh(r.idealEntry)}) et tu touches le mur : freine plus tôt.`;
    if (r.contacts > 0) return "Tu touches le mur à vitesse correcte : élargis ta trajectoire avant le virage.";
    if (tooFast && r.brakeOffset === null) return `Tu ne freines pas : tu entres à ${kmh(r.entrySpeed)}, la voiture tient ${kmh(r.idealEntry)}.`;
    if (tooFast) return `Tu freines trop tard : tu entres à ${kmh(r.entrySpeed)}, la voiture tient ${kmh(r.idealEntry)}.`;
    if (r.minSpeed < r.idealMin * 0.8) {
        const cause = r.brakeOffset === null ? "Tu passes trop lentement" : "Tu freines trop";
        return `${cause} : ${kmh(r.minSpeed)} au point le plus lent, la voiture tient ${kmh(r.idealMin)}.`;
    }
    if (r.brakeOffset !== null && r.brakeOffset > 20) return `Tu freines environ ${Math.round(r.brakeOffset)} m trop tôt.`;
    if (r.driftTime > 0.5) return `Tu glisses ${r.driftTime.toFixed(1).replace(".", ",")} s : une glisse longue coûte de la vitesse.`;
    if (r.exitThrottle < 0.6) return "Remets les gaz plus tôt après le point de corde.";
    return "Virage bien négocié.";
}

// Le passage dans une zone : la suite d'échantillons consécutifs dans la zone qui recouvre le plus le tour donné.
function pass(samples: Sample[], lap: LapRecord, zoneIndices: number[]): Sample[] {
    const zone = new Set(zoneIndices);
    let best: Sample[] = [];
    let bestOverlap = 0;
    let runStart = -1;
    for (let i = 0; i <= samples.length; i++) {
        const inside = i < samples.length && zone.has(samples[i].index);
        if (inside && runStart < 0) runStart = i;
        if (!inside && runStart >= 0) {
            const overlap = Math.min(i, lap.to) - Math.max(runStart, lap.from);
            if (overlap > bestOverlap) {
                bestOverlap = overlap;
                best = samples.slice(runStart, i);
            }
            runStart = -1;
        }
    }
    return best;
}

// Le point de freinage idéal : en remontant depuis l'entrée du virage, là où la vitesse idéale commence à baisser.
function idealBrakingPoint(corner: Corner, profile: TrackProfile): number {
    const n = profile.idealSpeed.length;
    let i = corner.start;
    for (let k = 0; k < BRAKING_SEARCH; k++) {
        const previous = (i - 1 + n) % n;
        if (profile.idealSpeed[previous] <= profile.idealSpeed[i]) break;
        i = previous;
    }
    return i;
}

// Nombre de points de `from` à `to` le long de la piste (positif si `from` est avant `to`).
function forwardSteps(from: number, to: number, n: number): number {
    let step = to - from;
    if (step > n / 2) step -= n;
    if (step < -n / 2) step += n;
    return step;
}

// Les points de la ligne centrale sont régulièrement espacés : la moyenne suffit pour convertir en mètres.
function meanSpacing(profile: TrackProfile): number {
    return profile.segmentLength.reduce((sum, length) => sum + length, 0) / profile.segmentLength.length;
}

// Points de `from` à `to` inclus, en faisant le tour si besoin.
function indices(from: number, to: number, n: number): number[] {
    const start = ((from % n) + n) % n;
    const length = ((to - start + n) % n) + 1;
    return Array.from({length}, (_, k) => (start + k) % n);
}

function duration(samples: Sample[], condition: (sample: Sample) => boolean): number {
    let total = 0;
    for (let i = 1; i < samples.length; i++) {
        if (condition(samples[i])) total += samples[i].time - samples[i - 1].time;
    }
    return total;
}

function countContacts(samples: Sample[]): number {
    return samples.filter((sample, i) => sample.contact && !samples[i - 1]?.contact).length;
}

function speedTrace(lap: Sample[], n: number): number[] {
    const trace = new Array<number>(n).fill(NaN);
    for (const sample of lap) trace[sample.index] = sample.speed;
    return trace;
}
