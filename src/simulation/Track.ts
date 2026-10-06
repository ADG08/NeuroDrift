import type { Point, Segment } from "./geometry";

export class Track {
    readonly walls: Segment[];

    constructor(walls: Segment[]) {
        this.walls = walls;
    }

    // Chaque polygone est un contour fermé : le dernier point est relié au premier.
    static fromPolygons(...polygons: Point[][]): Track {
        const walls = polygons.flatMap(points =>
            points.map((start, i) => ({
                start,
                end: points[(i + 1) % points.length],
            }))
        );
        return new Track(walls);
    }
}
