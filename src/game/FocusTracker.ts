import { normalizeAngle, type Pose } from "../simulation/geometry";
import type { Entrant } from "./Race";

// La voiture suivie doit avoir perdu la tête depuis au moins ce temps (réel, en secondes) pour qu'on change.
const SWITCH_DELAY = 1.5;
// Durée du glissement de la caméra et de la bulle d'une voiture à l'autre.
const BLEND_DURATION = 0.6;

// Choisit la voiture suivie par la caméra. Sans délai, deux voitures au coude à coude
// se « volent » la première place plusieurs fois par seconde et la vue saute sans arrêt :
// on attend que la perte de la tête soit confirmée (hystérésis), puis on glisse en douceur.
export class FocusTracker {
    private focused: Entrant | null = null;
    private previous: Entrant | null = null;
    // Moment où la voiture suivie a cessé d'être en tête (null tant qu'elle l'est).
    private lostLeadAt: number | null = null;
    private switchedAt = -Infinity;

    reset() {
        this.focused = null;
        this.previous = null;
        this.lostLeadAt = null;
        this.switchedAt = -Infinity;
    }

    // leader : la voiture en tête à cet instant. Renvoie la voiture suivie.
    update(leader: Entrant, now: number): Entrant {
        if (this.focused === null || leader === this.focused) {
            this.focused = leader;
            this.lostLeadAt = null;
            return leader;
        }
        // La voiture suivie ne roule plus (éliminée ou arrivée) : rien à attendre.
        if (this.focused.retired) return this.switchTo(leader, now);

        // Peu importe qui est devant (la tête peut tourner entre plusieurs voitures) :
        // ce qui compte, c'est depuis combien de temps la voiture suivie n'est plus première.
        if (this.lostLeadAt === null) this.lostLeadAt = now;
        else if (now - this.lostLeadAt >= SWITCH_DELAY) this.switchTo(leader, now);
        return this.focused;
    }

    // Pose à suivre : pendant un changement, elle glisse de l'ancienne voiture vers la nouvelle.
    pose(now: number): Pose {
        const target = this.focused!.simulation.renderPose();
        const t = (now - this.switchedAt) / BLEND_DURATION;
        if (this.previous === null || t >= 1) return target;

        const from = this.previous.simulation.renderPose();
        // smoothstep : démarre et finit en douceur, sans à-coup.
        const k = t * t * (3 - 2 * t);
        return {
            x: from.x + (target.x - from.x) * k,
            z: from.z + (target.z - from.z) * k,
            rotation: from.rotation + normalizeAngle(target.rotation - from.rotation) * k,
        };
    }

    private switchTo(entrant: Entrant, now: number): Entrant {
        this.previous = this.focused;
        this.focused = entrant;
        this.lostLeadAt = null;
        this.switchedAt = now;
        return entrant;
    }
}
