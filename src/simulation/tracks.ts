import type { Point } from "./geometry";

export interface TrackDefinition {
    id: string;
    name: string;
    tagline: string;
    width: number;
    centerline: Point[];
}

// Distance entre deux points consécutifs de la ligne centrale : Progress et Autopilot comptent en points.
const SPACING = 2.5;
const SPLINE_SAMPLES = 24;

// Courbe de Catmull-Rom fermée : passe par chaque point de contrôle avec des tangentes lisses.
// La tangente en p1 est (p2 - p0) / 2 : elle dépend des deux voisins, d'où l'absence de cassure.
function spline(controls: Point[]): Point[] {
    const n = controls.length;
    const points: Point[] = [];
    for (let i = 0; i < n; i++) {
        const p0 = controls[(i - 1 + n) % n];
        const p1 = controls[i];
        const p2 = controls[(i + 1) % n];
        const p3 = controls[(i + 2) % n];
        for (let s = 0; s < SPLINE_SAMPLES; s++) {
            const t = s / SPLINE_SAMPLES;
            const t2 = t * t;
            const t3 = t2 * t;
            const blend = (a: number, b: number, c: number, d: number) =>
                0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
            points.push({x: blend(p0.x, p1.x, p2.x, p3.x), z: blend(p0.z, p1.z, p2.z, p3.z)});
        }
    }
    return points;
}

// Redistribue les points d'une boucle à intervalle constant, mesuré le long de la courbe.
function resample(points: Point[], spacing: number): Point[] {
    const n = points.length;
    const lengths = points.map((p, i) => Math.hypot(points[(i + 1) % n].x - p.x, points[(i + 1) % n].z - p.z));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const count = Math.round(total / spacing);
    const step = total / count;

    const result: Point[] = [];
    let segment = 0;
    let segmentStart = 0;
    for (let k = 0; k < count; k++) {
        const target = k * step;
        while (segmentStart + lengths[segment] < target) segmentStart += lengths[segment++];
        const t = (target - segmentStart) / lengths[segment];
        const a = points[segment];
        const b = points[(segment + 1) % n];
        result.push({x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t});
    }
    return result;
}

function circuit(controls: [number, number][]): Point[] {
    return resample(spline(controls.map(([x, z]) => ({x, z}))), SPACING);
}

function clover(): [number, number][] {
    return Array.from({length: 30}, (_, i) => {
        const t = (i / 30) * Math.PI * 2;
        const radius = 150 + 50 * Math.cos(3 * t);
        return [radius * Math.cos(t), radius * Math.sin(t)];
    });
}

export const TRACKS: TrackDefinition[] = [
    {
        id: "clover",
        name: "Trèfle",
        tagline: "Trois grandes courbes rapides, idéal pour débuter",
        width: 14,
        centerline: circuit(clover()),
    },
    {
        id: "grand-prix",
        name: "Grand Prix",
        tagline: "Longues lignes droites et gros freinages",
        width: 14,
        centerline: circuit([
            [0, -160], [120, -160], [240, -160], [320, -130], [340, -60], [300, 0], [230, 20],
            [190, 70], [210, 140], [170, 200], [80, 210], [0, 180], [-60, 130], [-130, 150],
            [-210, 190], [-290, 160], [-320, 80], [-300, 0], [-240, -60], [-200, -130], [-120, -160],
        ]),
    },
    {
        id: "serpent",
        name: "Serpentin",
        tagline: "Technique, avec une épingle serrée",
        width: 14,
        centerline: circuit([
            [0, -120], [80, -140], [150, -110], [200, -150], [270, -140], [310, -80], [280, -20],
            [220, 0], [240, 60], [300, 90], [300, 160], [230, 190], [150, 160], [90, 190],
            [20, 180], [-40, 140], [-90, 180], [-170, 190], [-230, 140], [-220, 70], [-160, 40],
            [-200, -20], [-260, -50], [-260, -120], [-190, -160], [-110, -140], [-60, -100],
        ]),
    },
];
