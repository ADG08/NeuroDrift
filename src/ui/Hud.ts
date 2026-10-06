import type { Entrant, RaceEvent } from "../game/Race";
import { formatLapTime } from "./format";

const TOAST_DURATION = 2500;
// La simulation n'a pas d'unité : on considère qu'une unité de vitesse vaut 1 m/s.
const MS_TO_KMH = 3.6;

export class Hud {
    private readonly root: HTMLElement;
    private readonly trackName: HTMLElement;
    private readonly lap: HTMLElement;
    private readonly current: HTMLElement;
    private readonly best: HTMLElement;
    private readonly speed: HTMLElement;
    private readonly toast: HTMLElement;
    private toastTimer = 0;

    constructor(container: HTMLElement) {
        this.root = document.createElement("div");
        this.root.className = "hud";
        this.root.hidden = true;
        this.root.innerHTML = `
            <div class="hud__card">
                <p class="hud__track"></p>
                <dl class="hud__stats">
                    <div><dt>Tour</dt><dd data-lap></dd></div>
                    <div><dt>Chrono</dt><dd data-current></dd></div>
                    <div><dt>Meilleur</dt><dd data-best></dd></div>
                </dl>
            </div>
            <div class="hud__speed"><span data-speed>0</span><small>km/h</small></div>
            <p class="hud__toast" role="status"></p>
            <p class="hints hud__hints"><kbd>V</kbd> caméra · <kbd>C</kbd> colliders · <kbd>Échap</kbd> menu</p>`;
        container.appendChild(this.root);

        this.trackName = this.root.querySelector(".hud__track")!;
        this.lap = this.root.querySelector("[data-lap]")!;
        this.current = this.root.querySelector("[data-current]")!;
        this.best = this.root.querySelector("[data-best]")!;
        this.speed = this.root.querySelector("[data-speed]")!;
        this.toast = this.root.querySelector(".hud__toast")!;
    }

    show(trackName: string) {
        this.trackName.textContent = trackName;
        this.toast.classList.remove("hud__toast--visible");
        this.root.hidden = false;
    }

    hide() {
        this.root.hidden = true;
    }

    update(player: Entrant, raceTime: number) {
        this.lap.textContent = String(player.laps + 1);
        this.current.textContent = formatLapTime(player.lapStartedAt === null ? null : raceTime - player.lapStartedAt);
        this.best.textContent = formatLapTime(player.bestLap);
        this.speed.textContent = String(Math.round(Math.abs(player.car.currentSpeed) * MS_TO_KMH));
    }

    announce(event: RaceEvent) {
        if (event.type !== "lap") return;
        this.toast.textContent = `Tour ${event.entrant.laps} : ${formatLapTime(event.time)}${event.isRecord ? ", record" : ""}`;
        this.toast.classList.add("hud__toast--visible");
        clearTimeout(this.toastTimer);
        this.toastTimer = window.setTimeout(() => this.toast.classList.remove("hud__toast--visible"), TOAST_DURATION);
    }
}
