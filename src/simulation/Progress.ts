import { distance, type Point } from "./geometry";
import type { Track } from "./Track";

const SEARCH_BEHIND = 2;
const SEARCH_AHEAD = 8;

// Suit la position d'une voiture le long de la ligne centrale.
export class Progress {
    index: number;
    // Points parcourus depuis le départ, avec leur signe : reculer fait baisser le total.
    traveled = 0;
    private readonly track: Track;

    constructor(track: Track, startIndex = 0) {
        this.track = track;
        this.index = startIndex;
    }

    reset(startIndex: number) {
        this.index = startIndex;
        this.traveled = 0;
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

        // Un saut de plus d'un demi-tour, c'est le passage de la ligne : on ramène le pas dans ]-n/2, n/2].
        const n = this.track.centerline.length;
        const half = n / 2;
        let step = best - this.index;
        if (step < -half) step += n;
        else if (step > half) step -= n;
        this.traveled += step;

        const crossing = best < this.index - half ? 1 : best > this.index + half ? -1 : 0;
        this.index = best;
        return crossing;
    }
}
