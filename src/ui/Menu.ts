import type { RaceEvent } from "../game/Race";
import { distance } from "../simulation/geometry";
import type { TrackDefinition } from "../simulation/tracks";
import { formatClock, formatLapTime } from "./format";

const FEED_SIZE = 6;

export interface MenuHandlers {
    select(track: TrackDefinition): void;
    start(track: TrackDefinition): void;
}

export class Menu {
    private readonly root: HTMLElement;
    private readonly tracks: TrackDefinition[];
    private readonly handlers: MenuHandlers;
    private readonly cards: HTMLButtonElement[];
    private readonly feed: HTMLOListElement;
    private readonly feedTrack: HTMLElement;
    private readonly record: HTMLElement;
    private selected = 0;

    constructor(container: HTMLElement, tracks: TrackDefinition[], handlers: MenuHandlers) {
        this.tracks = tracks;
        this.handlers = handlers;

        this.root = document.createElement("div");
        this.root.className = "menu";
        this.root.innerHTML = `
            <section class="menu__panel">
                <header class="brand">
                    <h1 class="brand__title">NeuroDrift</h1>
                    <p class="brand__subtitle">Choisis ton circuit, observe les pilotes, puis prends le volant.</p>
                </header>
                <div class="tracks" role="radiogroup" aria-label="Circuits">
                    ${tracks.map((track, i) => trackCard(track, i)).join("")}
                </div>
                <button class="cta" type="button">Lancer la course <kbd>Entrée</kbd></button>
                <p class="hints"><kbd>Z Q S D</kbd> / <kbd>W A S D</kbd> conduire · <kbd>V</kbd> caméra · <kbd>C</kbd> colliders · <kbd>Échap</kbd> menu</p>
            </section>
            <aside class="feed" aria-live="polite">
                <h2 class="feed__title">En direct · <span data-track></span></h2>
                <ol class="feed__list"></ol>
                <p class="feed__record">Record du circuit <strong data-record>—</strong></p>
            </aside>`;
        container.appendChild(this.root);

        this.cards = [...this.root.querySelectorAll<HTMLButtonElement>(".track-card")];
        this.feed = this.root.querySelector(".feed__list")!;
        this.feedTrack = this.root.querySelector("[data-track]")!;
        this.record = this.root.querySelector("[data-record]")!;

        this.cards.forEach((card, i) => card.addEventListener("click", () => this.select(i)));
        this.root.querySelector(".cta")!.addEventListener("click", () => this.start());
        window.addEventListener("keydown", event => this.onKey(event));
    }

    get visible(): boolean {
        return !this.root.hidden;
    }

    show() {
        this.root.hidden = false;
    }

    hide() {
        this.root.hidden = true;
    }

    // Repart d'un fil vide pour le circuit sélectionné.
    reset(track: TrackDefinition) {
        this.selected = this.tracks.indexOf(track);
        this.cards.forEach((card, i) => card.setAttribute("aria-checked", String(i === this.selected)));
        this.feedTrack.textContent = track.name;
        this.record.textContent = formatLapTime(null);
        this.feed.replaceChildren();
    }

    addEvent(event: RaceEvent, raceTime: number) {
        const {entrant} = event;
        const item = document.createElement("li");
        item.className = "feed__item";

        const text = document.createElement("span");
        if (event.type === "lap") {
            text.textContent = `${entrant.name} : tour en ${formatLapTime(event.time)}${event.isRecord ? ", record" : ""}`;
            if (event.isRecord) this.record.textContent = `${formatLapTime(event.time)} · ${entrant.name}`;
        } else {
            text.textContent = `${entrant.name} touche le mur`;
            item.classList.add("feed__item--wall");
        }

        const time = document.createElement("time");
        time.textContent = formatClock(raceTime);
        item.append(text, time);

        this.feed.prepend(item);
        while (this.feed.children.length > FEED_SIZE) this.feed.lastElementChild!.remove();
    }

    private select(index: number) {
        if (index === this.selected) return;
        this.handlers.select(this.tracks[index]);
    }

    private start() {
        this.handlers.start(this.tracks[this.selected]);
    }

    private onKey(event: KeyboardEvent) {
        if (!this.visible) return;
        const digit = /^(Digit|Numpad)([1-9])$/.exec(event.code);
        if (digit && Number(digit[2]) <= this.tracks.length) this.select(Number(digit[2]) - 1);
        else if (event.code === "ArrowDown") this.select((this.selected + 1) % this.tracks.length);
        else if (event.code === "ArrowUp") this.select((this.selected - 1 + this.tracks.length) % this.tracks.length);
        else if (event.code === "Enter" || event.code === "NumpadEnter") this.start();
    }
}

function trackCard(track: TrackDefinition, index: number): string {
    const points = track.centerline;
    const length = points.reduce((sum, p, i) => sum + distance(p, points[(i + 1) % points.length]), 0);
    return `
        <button class="track-card" type="button" role="radio" aria-checked="false">
            ${trackMap(track)}
            <span class="track-card__body">
                <span class="track-card__name">${track.name}</span>
                <span class="track-card__tagline">${track.tagline}</span>
                <span class="track-card__meta">${Math.round(length)} m · ${track.width} m de large</span>
            </span>
            <kbd>${index + 1}</kbd>
        </button>`;
}

// Tracé du circuit vu de dessus : x vers la droite, z vers le bas, comme la caméra de course.
function trackMap({centerline, width}: TrackDefinition): string {
    const xs = centerline.map(p => p.x);
    const zs = centerline.map(p => p.z);
    const minX = Math.min(...xs) - width;
    const minZ = Math.min(...zs) - width;
    const sizeX = Math.max(...xs) + width - minX;
    const sizeZ = Math.max(...zs) + width - minZ;
    const path = centerline.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.z.toFixed(1)}`).join(" ") + " Z";
    const start = centerline[0];
    // non-scaling-stroke : l'épaisseur est en pixels écran, quelle que soit la taille du circuit.
    return `
        <svg class="track-card__map" viewBox="${minX} ${minZ} ${sizeX} ${sizeZ}" aria-hidden="true">
            <path d="${path}" stroke-width="2" vector-effect="non-scaling-stroke" />
            <circle cx="${start.x}" cy="${start.z}" r="${Math.max(sizeX, sizeZ) * 0.04}" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        </svg>`;
}
