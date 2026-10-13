import type { NeuralNetwork } from "../ai/NeuralNetwork";

const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 196;
const HEIGHT = 124;
const NODE_RADIUS = 4;
// Abscisse de chaque colonne de neurones (entrées, couche cachée, sorties).
const COLUMN_X = [34, 98, 150];
const INPUT_LABELS = ["−90°", "−45°", "−20°", "0°", "20°", "45°", "90°", "vit."];
const OUTPUT_LABELS = ["Gaz", "Frein", "Gauche", "Droite"];
const POSITIVE = "#4cbb6c";
const NEGATIVE = "#e05252";

// Schéma d'un réseau de neurones : les liens montrent les poids (couleur = signe, épaisseur = force),
// les neurones s'allument selon leur activation au dernier calcul.
export class NetworkDiagram {
    readonly element: SVGSVGElement;
    // edges[couche][neurone * nombreEntrées + entrée] : un trait par poids (les biais ne sont pas des liens).
    private readonly edges: SVGLineElement[][] = [];
    private readonly nodes: SVGCircleElement[][] = [];
    private readonly layerSizes: number[];
    private shown: NeuralNetwork | null = null;

    constructor(layerSizes: number[]) {
        this.layerSizes = layerSizes;
        this.element = createSvg("svg", {class: "network", viewBox: `0 0 ${WIDTH} ${HEIGHT}`});
        const positions = layerSizes.map((size, layer) =>
            Array.from({length: size}, (_, i) => ({x: COLUMN_X[layer], y: nodeY(i, size)})));

        // Les liens d'abord, pour que les neurones soient dessinés par-dessus.
        for (let layer = 1; layer < layerSizes.length; layer++) {
            const lines: SVGLineElement[] = [];
            for (const to of positions[layer]) {
                for (const from of positions[layer - 1]) {
                    const line = createSvg("line", {x1: from.x, y1: from.y, x2: to.x, y2: to.y});
                    this.element.appendChild(line);
                    lines.push(line);
                }
            }
            this.edges.push(lines);
        }

        positions.forEach(column => {
            this.nodes.push(column.map(({x, y}) => {
                const circle = createSvg("circle", {cx: x, cy: y, r: NODE_RADIUS, class: "network__node"});
                this.element.appendChild(circle);
                return circle;
            }));
        });

        const last = positions.length - 1;
        positions[0].forEach(({y}, i) => this.label(INPUT_LABELS[i], 0, y, "start"));
        positions[last].forEach(({y}, i) => this.label(OUTPUT_LABELS[i], COLUMN_X[last] + 9, y, "start"));
    }

    update(network: NeuralNetwork) {
        // Les poids ne changent qu'avec le réseau : on ne redessine les liens que s'il est différent.
        if (network !== this.shown) {
            this.drawWeights(network);
            this.shown = network;
        }
        network.activations.forEach((values, layer) => {
            values.forEach((value, i) => {
                const node = this.nodes[layer][i];
                node.setAttribute("fill", value >= 0 ? POSITIVE : NEGATIVE);
                node.setAttribute("fill-opacity", (0.1 + 0.9 * Math.min(Math.abs(value), 1)).toFixed(2));
            });
        });
    }

    private drawWeights({weights}: NeuralNetwork) {
        // Même ordre que NeuralNetwork.predict : pour chaque neurone, ses poids d'entrée puis son biais.
        let maxAbs = 0;
        for (const weight of weights) maxAbs = Math.max(maxAbs, Math.abs(weight));

        let w = 0;
        for (let layer = 1; layer < this.layerSizes.length; layer++) {
            const inputs = this.layerSizes[layer - 1];
            for (let neuron = 0; neuron < this.layerSizes[layer]; neuron++) {
                for (let input = 0; input < inputs; input++) {
                    const weight = weights[w++];
                    const strength = Math.abs(weight) / maxAbs;
                    const line = this.edges[layer - 1][neuron * inputs + input];
                    line.setAttribute("stroke", weight >= 0 ? POSITIVE : NEGATIVE);
                    line.setAttribute("stroke-opacity", (0.08 + 0.8 * strength).toFixed(2));
                    line.setAttribute("stroke-width", (0.3 + 1.7 * strength).toFixed(2));
                }
                w++; // biais
            }
        }
    }

    private label(text: string, x: number, y: number, anchor: string) {
        const label = createSvg("text", {x, y: y + 3, "text-anchor": anchor, class: "network__label"});
        label.textContent = text;
        this.element.appendChild(label);
    }
}

function nodeY(index: number, count: number): number {
    const margin = 8;
    return margin + (index * (HEIGHT - 2 * margin)) / (count - 1);
}

function createSvg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
    return element;
}
