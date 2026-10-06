import { distance, type Point } from "./geometry";
import type { Track } from "./Track";

const SEARCH_BEHIND = 2;
const SEARCH_AHEAD = 8;

// Suit la position d'une voiture le long de la ligne centrale.
export class Progress {
    index: number;
    private readonly track: Track;

    constructor(track: Track, startIndex = 0) {
        this.track = track;
        this.index = startIndex;
    }

    // Recherche locale autour du dernier index : la voiture ne peut pas sauter loin en une frame.
    // Renvoie 1 si la ligne de départ vient d'être franchie en avant, -1 en arrière, 0 sinon.
    update(p: Point): number {
        let best = this.index;
        let bestDistance = Infinity;
        for (let offset = -SEARCH_BEHIND; offset <= SEARCH_AHEAD; offset++) {
            const i = this.track.wrapIndex(this.index + offset);
            const d = distance(p, this.track.centerline[i]);
            if (d < bestDistance) {
                best = i;
                bestDistance = d;
            }
        }

        const half = this.track.centerline.length / 2;
        const crossing = best < this.index - half ? 1 : best > this.index + half ? -1 : 0;
        this.index = best;
        return crossing;
    }
}
