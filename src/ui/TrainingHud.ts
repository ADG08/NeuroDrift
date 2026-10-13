import type { GenerationResult, Training } from "../game/Training";
import { formatLapTime } from "./format";

const CHART_WIDTH = 260;
const CHART_HEIGHT = 90;
const meters = new Intl.NumberFormat("fr-FR", {maximumFractionDigits: 0});

// Panneau de l'entraînement : état de la génération en cours et courbe des scores génération après génération.
export class TrainingHud {
    private readonly root: HTMLElement;
    private readonly title: HTMLElement;
    private readonly generation: HTMLElement;
    private readonly alive: HTMLElement;
    private readonly time: HTMLElement;
    private readonly currentBest: HTMLElement;
    private readonly currentLap: HTMLElement;
    private readonly recordLap: HTMLElement;
    private readonly speed: HTMLElement;
    private readonly distanceChart: SVGSVGElement;
    private readonly lapChart: SVGSVGElement;

    constructor(container: HTMLElement) {
        this.root = document.createElement("div");
        this.root.className = "hud";
        this.root.hidden = true;
        this.root.innerHTML = `
            <div class="hud__card training">
                <p class="hud__track"></p>
                <dl class="hud__stats">
                    <div><dt>Génération</dt><dd data-generation></dd></div>
                    <div><dt>En vie</dt><dd data-alive></dd></div>
                    <div><dt>Temps</dt><dd data-time></dd></div>
                </dl>
                <dl class="hud__stats">
                    <div><dt>Distance</dt><dd data-current></dd></div>
                    <div><dt>Tour</dt><dd data-lap></dd></div>
                    <div><dt>Record du tour</dt><dd data-record></dd></div>
                </dl>
                <svg class="training__chart" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" aria-label="Distance par génération" data-chart="distance"></svg>
                <p class="training__legend">Distance : <span class="training__best">meilleure</span> · moyenne · pointillés = un tour</p>
                <svg class="training__chart" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" aria-label="Meilleur tour par génération" data-chart="lap"></svg>
                <p class="training__legend">Meilleur tour par génération (plus bas = plus rapide)</p>
            </div>
            <div class="hud__speed"><span data-speed></span><small>vitesse</small></div>
            <p class="hints hud__hints"><kbd>1</kbd>–<kbd>4</kbd> vitesse · <kbd>N</kbd> génération suivante · <kbd>V</kbd> caméra · <kbd>C</kbd> capteurs · <kbd>Échap</kbd> menu</p>`;
        container.appendChild(this.root);

        this.title = this.root.querySelector(".hud__track")!;
        this.generation = this.root.querySelector("[data-generation]")!;
        this.alive = this.root.querySelector("[data-alive]")!;
        this.time = this.root.querySelector("[data-time]")!;
        this.currentBest = this.root.querySelector("[data-current]")!;
        this.currentLap = this.root.querySelector("[data-lap]")!;
        this.recordLap = this.root.querySelector("[data-record]")!;
        this.speed = this.root.querySelector("[data-speed]")!;
        this.distanceChart = this.root.querySelector("[data-chart=distance]")!;
        this.lapChart = this.root.querySelector("[data-chart=lap]")!;
    }

    show(trackName: string) {
        this.title.textContent = `Entraînement · ${trackName}`;
        this.distanceChart.replaceChildren();
        this.lapChart.replaceChildren();
        this.root.hidden = false;
    }

    hide() {
        this.root.hidden = true;
    }

    update(training: Training, speed: number) {
        this.generation.textContent = String(training.generation);
        this.alive.textContent = `${training.alive} / ${training.race.entrants.length}`;
        this.time.textContent = `${Math.floor(training.race.time)} s`;
        this.currentBest.textContent = `${meters.format(training.currentBest)} m`;
        this.currentLap.textContent = formatLapTime(training.currentBestLap);
        const laps = training.history.flatMap(result => (result.bestLap === null ? [] : [result.bestLap]));
        this.recordLap.textContent = formatLapTime(laps.length === 0 ? null : Math.min(...laps));
        this.speed.textContent = `×${speed}`;
    }

    // Redessine les courbes : une seule fois par génération, pas à chaque image.
    drawChart(history: GenerationResult[], lapLength: number) {
        const x = (i: number) => (history.length < 2 ? CHART_WIDTH : (i / (history.length - 1)) * CHART_WIDTH);

        // Distance : de 0 (bas) à un peu plus d'un tour (haut).
        const top = lapLength * 1.05;
        const yDistance = (value: number) => CHART_HEIGHT - (value / top) * CHART_HEIGHT;
        const distanceLine = (values: number[]) => values.map((value, i) => `${x(i).toFixed(1)},${yDistance(value).toFixed(1)}`).join(" ");
        this.distanceChart.innerHTML = `
            <line class="training__lap" x1="0" x2="${CHART_WIDTH}" y1="${yDistance(lapLength)}" y2="${yDistance(lapLength)}" />
            <polyline class="training__average-line" points="${distanceLine(history.map(result => result.average))}" />
            <polyline class="training__best-line" points="${distanceLine(history.map(result => result.best))}" />`;

        // Temps au tour : seulement les générations où une voiture a bouclé le tour, échelle entre le min et le max observés.
        const laps = history.flatMap((result, i) => (result.bestLap === null ? [] : [{i, time: result.bestLap}]));
        if (laps.length === 0) return;
        const fastest = Math.min(...laps.map(lap => lap.time));
        const slowest = Math.max(...laps.map(lap => lap.time));
        const span = Math.max(slowest - fastest, 1);
        // Le plus lent en haut, le plus rapide en bas : la courbe descend quand l'IA progresse.
        const yLap = (time: number) => 8 + ((slowest - time) / span) * (CHART_HEIGHT - 16);
        this.lapChart.innerHTML = `
            <polyline class="training__best-line" points="${laps.map(({i, time}) => `${x(i).toFixed(1)},${yLap(time).toFixed(1)}`).join(" ")}" />
            <text class="training__axis" x="${CHART_WIDTH}" y="${yLap(slowest) + 4}" text-anchor="end">${formatLapTime(slowest)}</text>
            <text class="training__axis" x="${CHART_WIDTH}" y="${yLap(fastest) + 4}" text-anchor="end">${formatLapTime(fastest)}</text>`;
    }
}
