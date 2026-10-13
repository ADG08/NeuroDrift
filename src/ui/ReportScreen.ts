import type { CornerReport, RaceReport } from "../analysis/coach";
import type { Point } from "../simulation/geometry";
import type { RaceEntry } from "../storage";
import { formatLapTime } from "./format";

const MS_TO_KMH = 3.6;
const TOP_TIPS = 3;
// En dessous de cette perte, un virage est considéré comme propre.
const MINOR_LOSS = 0.1;
const MAJOR_LOSS = 0.4;
const CHART_WIDTH = 520;
const CHART_HEIGHT = 140;

const seconds = new Intl.NumberFormat("fr-FR", {minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always"});
const dateFormat = new Intl.DateTimeFormat("fr-FR", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});

export interface ReportHandlers {
    replay(): void;
    menu(): void;
}

export interface ReportContext {
    trackName: string;
    centerline: Point[];
    history: RaceEntry[];          // courses précédentes sur ce circuit
    previousBest: number | null;   // record personnel avant cette course
}

// Écran de fin de course : le récap du pilotage, virage par virage, comparé à la référence.
export class ReportScreen {
    private readonly root: HTMLElement;

    constructor(container: HTMLElement, handlers: ReportHandlers) {
        this.root = document.createElement("div");
        this.root.className = "report";
        this.root.hidden = true;
        container.appendChild(this.root);
        this.root.addEventListener("click", event => {
            const action = (event.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
            if (action === "replay") handlers.replay();
            if (action === "menu") handlers.menu();
        });
    }

    hide() {
        this.root.hidden = true;
    }

    show(report: RaceReport, context: ReportContext) {
        const tips = report.corners
            .filter(corner => corner.timeLost > MINOR_LOSS)
            .sort((a, b) => b.timeLost - a.timeLost)
            .slice(0, TOP_TIPS);
        const isRecord = context.previousBest === null || report.bestLap < context.previousBest;

        this.root.innerHTML = `
            <section class="report__panel">
                <header>
                    <h2>Analyse de course · ${context.trackName}</h2>
                    <dl class="report__summary">
                        <div><dt>Meilleur tour</dt><dd>${formatLapTime(report.bestLap)}</dd></div>
                        <div><dt>Référence</dt><dd>${formatLapTime(report.idealLap)}</dd></div>
                        <div><dt>Écart</dt><dd>${seconds.format(report.bestLap - report.idealLap)} s</dd></div>
                        <div><dt>Record perso</dt><dd>${isRecord ? "Nouveau record" : formatLapTime(context.previousBest)}</dd></div>
                    </dl>
                    <p class="report__note">Tours : ${report.lapTimes.map(formatLapTime).join(" · ")}. La référence est le tour théorique
                    d'une voiture parfaite sur la ligne médiane : freinage au dernier moment, vitesse maximale que tiennent les pneus.</p>
                </header>

                <section>
                    <h3>Où gagner du temps</h3>
                    ${tips.length === 0 ? `<p class="report__note">Aucun virage ne coûte plus de ${MINOR_LOSS.toFixed(1).replace(".", ",")} s : le temps restant se joue en ligne droite.</p>` : `
                    <ol class="report__tips">${tips.map(tip => `
                        <li><p><strong>${cornerName(tip)}</strong><span>${seconds.format(tip.timeLost)} s</span></p><p>${tip.advice}</p></li>`).join("")}
                    </ol>`}
                </section>

                <div class="report__visuals">
                    ${trackMap(context.centerline, report.corners)}
                    ${speedChart(report)}
                </div>

                <section>
                    <h3>Virage par virage</h3>
                    <table class="report__table">
                        <thead><tr><th>Virage</th><th>Entrée</th><th>Mini</th><th>Perte</th><th>Conseil</th></tr></thead>
                        <tbody>${report.corners.map(corner => `
                            <tr class="${lossClass(corner)}">
                                <td>${cornerName(corner)}</td>
                                <td>${kmh(corner.entrySpeed)} <small>/ ${kmh(corner.idealEntry)}</small></td>
                                <td>${kmh(corner.minSpeed)} <small>/ ${kmh(corner.idealMin)}</small></td>
                                <td>${seconds.format(corner.timeLost)} s</td>
                                <td>${corner.advice}</td>
                            </tr>`).join("")}
                        </tbody>
                    </table>
                    <p class="report__note">Vitesses : toi / référence, en km/h. La perte compte du point de freinage idéal à la sortie du virage.</p>
                </section>

                <div class="report__columns">
                    <section>
                        <h3>Ton pilotage</h3>
                        <dl class="report__summary">
                            <div><dt>Plein gaz</dt><dd>${percent(report.throttleShare)}</dd></div>
                            <div><dt>Au frein</dt><dd>${percent(report.brakeShare)}</dd></div>
                            <div><dt>En glisse</dt><dd>${report.driftTime.toFixed(1).replace(".", ",")} s</dd></div>
                            <div><dt>Contacts mur</dt><dd>${report.contacts}</dd></div>
                        </dl>
                    </section>
                    <section>
                        <h3>Progression</h3>
                        <ol class="report__history">${[...context.history].reverse().slice(0, 5).map(race => `
                            <li><span>${dateFormat.format(new Date(race.date))}</span><span>${formatLapTime(race.bestLap)}</span></li>`).join("")}
                        </ol>
                    </section>
                </div>

                <footer class="report__actions">
                    <button class="cta" type="button" data-action="replay">Rejouer <kbd>Entrée</kbd></button>
                    <button class="cta cta--secondary" type="button" data-action="menu">Menu <kbd>Échap</kbd></button>
                </footer>
            </section>`;
        this.root.hidden = false;
        this.root.scrollTop = 0;
    }
}

function kmh(speed: number): string {
    return String(Math.round(speed * MS_TO_KMH));
}

function percent(share: number): string {
    return `${Math.round(share * 100)} %`;
}

function cornerName({corner}: CornerReport): string {
    return `Virage ${corner.number} · ${corner.direction}`;
}

function lossClass({timeLost}: CornerReport): string {
    if (timeLost > MAJOR_LOSS) return "loss--major";
    if (timeLost > MINOR_LOSS) return "loss--minor";
    return "";
}

// Carte du circuit vu de dessus, avec chaque virage numéroté au point de corde et coloré selon le temps perdu.
function trackMap(centerline: Point[], corners: CornerReport[]): string {
    const xs = centerline.map(p => p.x);
    const zs = centerline.map(p => p.z);
    const margin = 20;
    const minX = Math.min(...xs) - margin;
    const minZ = Math.min(...zs) - margin;
    const width = Math.max(...xs) + margin - minX;
    const height = Math.max(...zs) + margin - minZ;
    const path = centerline.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.z.toFixed(1)}`).join(" ") + " Z";
    const radius = Math.max(width, height) * 0.025;

    return `
        <svg class="report__map" viewBox="${minX} ${minZ} ${width} ${height}" aria-label="Carte du circuit">
            <path d="${path}" vector-effect="non-scaling-stroke" />
            ${corners.map(report => {
                const apex = centerline[report.corner.apex];
                return `<g class="${lossClass(report)}">
                    <circle cx="${apex.x}" cy="${apex.z}" r="${radius}" />
                    <text x="${apex.x}" y="${apex.z}" font-size="${radius * 1.1}" text-anchor="middle" dominant-baseline="central">${report.corner.number}</text>
                </g>`;
            }).join("")}
        </svg>`;
}

// Vitesse le long du tour : ton meilleur tour contre la référence. Les creux sont les virages.
function speedChart(report: RaceReport): string {
    const n = report.speedTrace.length;
    const top = Math.max(...report.speedTrace.filter(Number.isFinite), ...report.idealTrace) * 1.05;
    const x = (i: number) => ((i / (n - 1)) * CHART_WIDTH).toFixed(1);
    const y = (speed: number) => (CHART_HEIGHT - (speed / top) * CHART_HEIGHT).toFixed(1);
    const line = (values: number[]) => values
        .map((value, i) => (Number.isFinite(value) ? `${Number.isFinite(values[i - 1]) ? "L" : "M"}${x(i)} ${y(value)}` : ""))
        .join(" ");

    return `
        <svg class="report__chart" viewBox="0 -4 ${CHART_WIDTH} ${CHART_HEIGHT + 22}" aria-label="Vitesse le long du tour">
            <path class="report__reference" d="${line(report.idealTrace)}" />
            <path class="report__player" d="${line(report.speedTrace)}" />
            ${report.corners.map(({corner}) => `<text x="${x(corner.apex)}" y="${CHART_HEIGHT + 14}" text-anchor="middle">${corner.number}</text>`).join("")}
        </svg>
        <p class="report__note report__legend"><span class="report__player-key">Ton meilleur tour</span> · <span>référence</span> · numéros = virages</p>`;
}
