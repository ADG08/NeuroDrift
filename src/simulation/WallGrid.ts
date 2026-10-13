import type { Segment } from "./geometry";

const CELL_SIZE = 10;
// Clé numérique unique par case, exacte tant que |indice de case| < KEY_OFFSET.
const KEY_OFFSET = 32768;

// Partitionnement spatial : chaque mur est rangé dans les cases de la grille que couvre son rectangle englobant.
// Pour trouver les murs proches d'une zone, on ne parcourt que les cases qu'elle touche au lieu de tous les murs.
export class WallGrid {
    private readonly walls: Segment[];
    private readonly cells = new Map<number, number[]>();
    // Un mur peut être dans plusieurs cases : le tampon évite de le renvoyer deux fois dans la même requête.
    private readonly stamps: Uint32Array;
    private stamp = 0;
    private readonly result: Segment[] = [];

    constructor(walls: Segment[]) {
        this.walls = walls;
        this.stamps = new Uint32Array(walls.length);

        walls.forEach(({start, end}, i) => {
            this.forEachCell(
                Math.min(start.x, end.x), Math.min(start.z, end.z),
                Math.max(start.x, end.x), Math.max(start.z, end.z),
                key => {
                    const cell = this.cells.get(key);
                    if (cell) cell.push(i);
                    else this.cells.set(key, [i]);
                },
            );
        });
    }

    // Murs rangés dans les cases qui chevauchent le rectangle. Le tableau renvoyé est réutilisé à chaque appel.
    query(minX: number, minZ: number, maxX: number, maxZ: number): readonly Segment[] {
        this.stamp++;
        this.result.length = 0;
        this.forEachCell(minX, minZ, maxX, maxZ, key => {
            const cell = this.cells.get(key);
            if (!cell) return;
            for (const i of cell) {
                if (this.stamps[i] === this.stamp) continue;
                this.stamps[i] = this.stamp;
                this.result.push(this.walls[i]);
            }
        });
        return this.result;
    }

    private forEachCell(minX: number, minZ: number, maxX: number, maxZ: number, visit: (key: number) => void) {
        const fromX = Math.floor(minX / CELL_SIZE);
        const toX = Math.floor(maxX / CELL_SIZE);
        const fromZ = Math.floor(minZ / CELL_SIZE);
        const toZ = Math.floor(maxZ / CELL_SIZE);
        for (let cx = fromX; cx <= toX; cx++) {
            for (let cz = fromZ; cz <= toZ; cz++) {
                visit((cx + KEY_OFFSET) * 2 * KEY_OFFSET + (cz + KEY_OFFSET));
            }
        }
    }
}
