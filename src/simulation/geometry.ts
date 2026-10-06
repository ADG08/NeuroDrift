export interface Point {
    x: number;
    z: number;
}

export interface Pose extends Point {
    rotation: number;
}

export interface Segment {
    start: Point;
    end: Point;
}

export function closestPointOnSegment(p: Point, { start, end }: Segment): Point {
    const abX = end.x - start.x;
    const abZ = end.z - start.z;
    const lengthSq = abX * abX + abZ * abZ;
    if (lengthSq === 0) return start;

    // Projection de p sur la droite (AB), en fraction de AB : 0 = start, 1 = end.
    const t = ((p.x - start.x) * abX + (p.z - start.z) * abZ) / lengthSq;
    const clamped = Math.min(Math.max(t, 0), 1);

    return {
        x: start.x + clamped * abX,
        z: start.z + clamped * abZ,
    };
}

export function distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.z - a.z);
}

// Même convention que Car : un cap de 0 regarde vers +z, et x avance avec sin(cap).
export function headingTo(from: Point, to: Point): number {
    return Math.atan2(to.x - from.x, to.z - from.z);
}

// Ramène un angle dans ]-π, π] pour savoir de quel côté tourner.
export function normalizeAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

// Contour fermé : le dernier point est relié au premier.
export function closedPolyline(points: Point[]): Segment[] {
    return points.map((start, i) => ({
        start,
        end: points[(i + 1) % points.length],
    }));
}
