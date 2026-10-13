import { Vector3, type Camera } from "three";
import { NETWORK_LAYERS } from "../ai/NeuralDriver";
import type { NeuralNetwork } from "../ai/NeuralNetwork";
import type { Pose } from "../simulation/geometry";
import { formatLapTime } from "./format";
import { NetworkDiagram } from "./NetworkDiagram";

// Hauteur au-dessus de la voiture où la bulle est accrochée.
const ANCHOR_HEIGHT = 2.5;
const MS_TO_KMH = 3.6;
const gapFormat = new Intl.NumberFormat("fr-FR", {minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always"});

export interface CarStats {
    speed: number;              // unités par seconde
    position: number;           // 1 = premier
    throttle: number;           // 0 à 1
    brake: number;              // 0 à 1
    gapToNext: number | null;   // secondes d'avance sur la voiture suivante
    currentLap: number;         // secondes
    bestLap: number | null;     // secondes
    network: NeuralNetwork | null;   // cerveau de la voiture, s'il s'agit d'une IA
}

// Bulle façon télémétrie F1 accrochée à une voiture : la position 3D est projetée sur l'écran à chaque image.
export class CarTooltip {
    private readonly root: HTMLElement;
    private readonly speed: HTMLElement;
    private readonly position: HTMLElement;
    private readonly throttleBar: HTMLElement;
    private readonly throttleValue: HTMLElement;
    private readonly brakeBar: HTMLElement;
    private readonly brakeValue: HTMLElement;
    private readonly gapLabel: HTMLElement;
    private readonly gap: HTMLElement;
    private readonly laps: HTMLElement;
    private readonly anchor = new Vector3();
    private readonly diagram = new NetworkDiagram(NETWORK_LAYERS);
    private readonly networkSection: HTMLElement;

    constructor(container: HTMLElement) {
        this.root = document.createElement("div");
        this.root.className = "car-tooltip";
        this.root.hidden = true;
        this.root.innerHTML = `
            <div class="car-tooltip__bubble">
                <p class="car-tooltip__head"><span><strong data-speed></strong> km/h</span><strong data-position></strong></p>
                <p class="car-tooltip__pedal car-tooltip__pedal--throttle">
                    <span>Gaz</span><span class="car-tooltip__bar"><span data-throttle-bar></span></span><span data-throttle></span>
                </p>
                <p class="car-tooltip__pedal car-tooltip__pedal--brake">
                    <span>Frein</span><span class="car-tooltip__bar"><span data-brake-bar></span></span><span data-brake></span>
                </p>
                <p class="car-tooltip__row"><span data-gap-label></span><span data-gap></span></p>
                <p class="car-tooltip__row car-tooltip__laps" data-laps></p>
                <div class="car-tooltip__network">
                    <p class="car-tooltip__legend">Poids : <span class="network__positive">positif</span> · <span class="network__negative">négatif</span> · épaisseur = force</p>
                </div>
            </div>`;
        container.appendChild(this.root);

        const find = (selector: string) => this.root.querySelector<HTMLElement>(selector)!;
        this.speed = find("[data-speed]");
        this.position = find("[data-position]");
        this.throttleBar = find("[data-throttle-bar]");
        this.throttleValue = find("[data-throttle]");
        this.brakeBar = find("[data-brake-bar]");
        this.brakeValue = find("[data-brake]");
        this.gapLabel = find("[data-gap-label]");
        this.gap = find("[data-gap]");
        this.laps = find("[data-laps]");
        this.networkSection = find(".car-tooltip__network");
        this.networkSection.prepend(this.diagram.element);
    }

    hide() {
        this.root.hidden = true;
    }

    update(pose: Pose, camera: Camera, stats: CarStats) {
        // project() ramène le point dans l'espace écran normalisé : x et y entre -1 et 1, z > 1 = derrière la caméra.
        const screen = this.anchor.set(pose.x, ANCHOR_HEIGHT, pose.z).project(camera);
        if (screen.z > 1 || Math.abs(screen.x) > 1 || Math.abs(screen.y) > 1) {
            this.root.hidden = true;
            return;
        }
        const x = ((screen.x + 1) / 2) * window.innerWidth;
        const y = ((1 - screen.y) / 2) * window.innerHeight;
        this.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        this.root.hidden = false;

        this.speed.textContent = String(Math.round(Math.abs(stats.speed) * MS_TO_KMH));
        this.position.textContent = `P${stats.position}`;
        setPedal(this.throttleBar, this.throttleValue, stats.throttle);
        setPedal(this.brakeBar, this.brakeValue, stats.brake);
        this.gapLabel.textContent = `Écart P${stats.position + 1}`;
        this.gap.textContent = stats.gapToNext === null ? "—" : `${gapFormat.format(stats.gapToNext)} s`;
        this.laps.textContent = `Tour ${formatLapTime(stats.currentLap)} · Meilleur ${formatLapTime(stats.bestLap)}`;

        this.networkSection.hidden = stats.network === null;
        if (stats.network !== null) this.diagram.update(stats.network);
    }
}

function setPedal(bar: HTMLElement, value: HTMLElement, amount: number) {
    bar.style.transform = `scaleX(${amount.toFixed(3)})`;
    value.textContent = `${Math.round(amount * 100)} %`;
}
