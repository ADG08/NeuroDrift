import { closedPolyline, distance, headingTo, type Point, type Segment } from "./geometry";
import { WallGrid } from "./WallGrid";

// Un circuit est décrit par sa ligne centrale (boucle fermée) et sa largeur.
// Les deux bords sont obtenus en décalant chaque point perpendiculairement à la piste.
export class Track {
    readonly centerline: Point[];
    readonly width: number;
    readonly leftBorder: Point[] = [];
    readonly rightBorder: Point[] = [];
    readonly walls: Segment[];
    // Longueur de la ligne centrale, pour convertir une avancée en points en mètres.
    readonly length: number;
    private readonly grid: WallGrid;

    constructor(centerline: Point[], width: number) {
        this.centerline = centerline;
        this.width = width;

        const halfWidth = width / 2;
        centerline.forEach((p, i) => {
            const prev = centerline[this.wrapIndex(i - 1)];
            const next = centerline[this.wrapIndex(i + 1)];
            const tangentX = next.x - prev.x;
            const tangentZ = next.z - prev.z;
            const length = Math.hypot(tangentX, tangentZ);
            // Perpendiculaire à la tangente, côté gauche du sens de course.
            const normalX = tangentZ / length;
            const normalZ = -tangentX / length;

            this.leftBorder.push({x: p.x + normalX * halfWidth, z: p.z + normalZ * halfWidth});
            this.rightBorder.push({x: p.x - normalX * halfWidth, z: p.z - normalZ * halfWidth});
        });

        this.walls = [...closedPolyline(this.leftBorder), ...closedPolyline(this.rightBorder)];
        this.grid = new WallGrid(this.walls);
        this.length = centerline.reduce((sum, p, i) => sum + distance(p, centerline[this.wrapIndex(i + 1)]), 0);
    }

    // Murs proches d'une zone rectangulaire (tableau réutilisé à chaque appel).
    wallsInBox(minX: number, minZ: number, maxX: number, maxZ: number): readonly Segment[] {
        return this.grid.query(minX, minZ, maxX, maxZ);
    }

    wrapIndex(i: number): number {
        const n = this.centerline.length;
        return ((i % n) + n) % n;
    }

    // lateral : -1 = bord droit, 0 = centre, 1 = bord gauche.
    pointAt(index: number, lateral = 0): Point {
        const i = this.wrapIndex(index);
        const center = this.centerline[i];
        const left = this.leftBorder[i];
        return {
            x: center.x + (left.x - center.x) * lateral,
            z: center.z + (left.z - center.z) * lateral,
        };
    }

    headingAt(index: number): number {
        return headingTo(this.pointAt(index - 1), this.pointAt(index + 1));
    }
}
