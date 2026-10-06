// Moyenne sur une fenêtre : une valeur recalculée à chaque image changerait trop vite pour être lisible.
const SAMPLE_WINDOW = 500;
const oneDecimal = new Intl.NumberFormat("fr-FR", {minimumFractionDigits: 1, maximumFractionDigits: 1});

// Affiche les images par seconde et le temps de travail moyen par image.
// Si le travail est très inférieur à 1000 / fps, ce n'est pas le jeu qui limite : il attend l'image suivante.
export class FpsCounter {
    private readonly root: HTMLElement;
    private frames = 0;
    private work = 0;
    private windowStart: number | null = null;

    constructor(container: HTMLElement) {
        this.root = document.createElement("p");
        this.root.className = "fps";
        this.root.textContent = "– fps";
        container.appendChild(this.root);
    }

    // time : l'horodatage en ms fourni par la boucle d'animation ; workMs : durée de update + render.
    tick(time: number, workMs: number) {
        if (this.windowStart === null) {
            this.windowStart = time;
            return;
        }
        this.frames++;
        this.work += workMs;
        const elapsed = time - this.windowStart;
        if (elapsed >= SAMPLE_WINDOW) {
            const fps = Math.round((this.frames * 1000) / elapsed);
            this.root.textContent = `${fps} fps · ${oneDecimal.format(this.work / this.frames)} ms`;
            this.frames = 0;
            this.work = 0;
            this.windowStart = time;
        }
    }
}
