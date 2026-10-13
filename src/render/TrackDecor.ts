import {
    BoxGeometry,
    BufferGeometry,
    CanvasTexture,
    Color,
    DoubleSide,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneGeometry,
    SRGBColorSpace,
} from "three";
import { detectCorners, type Corner } from "../analysis/trackProfile";
import type { Track } from "../simulation/Track";

const BOARD_DISTANCES = [150, 100, 50];
// Les panneaux et le portique sont plantés derrière le mur, à cette distance du bord de piste.
const ROADSIDE = 2.5;
const KERB_WIDTH = 1.2;
const KERB_Y = 0.07;
const KERB_COLORS = [new Color(0xd8333a), new Color(0xeceff1)];

// Habillage du circuit : panneaux de freinage avant chaque virage, vibreurs à la corde et portique de départ.
export function createTrackDecor(track: Track): Group {
    const group = new Group();
    const corners = detectCorners(track);
    const post = new MeshStandardMaterial({color: 0x8b9499, roughness: 0.6});
    const boards = BOARD_DISTANCES.map(distance => new MeshBasicMaterial({map: labelTexture(String(distance))}));

    group.add(createStartGantry(track, post));
    const spacing = track.length / track.centerline.length;
    corners.forEach((corner, k) => {
        group.add(createApexKerb(track, corner));
        // Un panneau n'a de sens que sur la ligne droite qui mène au virage, après la sortie du précédent.
        const previous = corners[(k - 1 + corners.length) % corners.length];
        const straight = track.wrapIndex(corner.start - previous.end);
        BOARD_DISTANCES.forEach((distance, i) => {
            const offset = Math.round(distance / spacing);
            if (offset < straight) group.add(createBoard(track, corner.start - offset, corner, post, boards[i]));
        });
    });
    return group;
}

// Panneau de distance, sur le poteau, côté extérieur du virage, tourné vers les voitures qui arrivent.
function createBoard(track: Track, index: number, corner: Corner, post: MeshStandardMaterial, face: MeshBasicMaterial): Group {
    const outside = corner.direction === "gauche" ? -1 : 1;
    const {x, z} = track.pointAt(index, outside * (1 + ROADSIDE / (track.width / 2)));
    const board = new Group();
    board.position.set(x, 0, z);
    board.rotation.y = track.headingAt(index) + Math.PI;

    const pole = new Mesh(new BoxGeometry(0.2, 2, 0.2), post);
    pole.position.y = 1;
    const panel = new Mesh(new PlaneGeometry(2.4, 1.5), face);
    panel.position.y = 2.6;
    board.add(pole, panel);
    return board;
}

// Vibreur rouge et blanc le long du bord intérieur du virage : il montre où passer.
function createApexKerb(track: Track, corner: Corner): Mesh {
    const inside = corner.direction === "gauche" ? 1 : -1;
    const inner = 1 - KERB_WIDTH / (track.width / 2);
    const positions: number[] = [];
    const colors: number[] = [];

    for (let i = corner.start, stripe = 0; i !== track.wrapIndex(corner.end); i = track.wrapIndex(i + 1), stripe++) {
        // Deux triangles par tronçon ; chaque tronçon a ses propres sommets pour garder une couleur franche.
        const a = track.pointAt(i, inside);
        const b = track.pointAt(i, inside * inner);
        const c = track.pointAt(i + 1, inside);
        const d = track.pointAt(i + 1, inside * inner);
        for (const p of [a, b, c, b, d, c]) positions.push(p.x, KERB_Y, p.z);
        const {r, g, b: blue} = KERB_COLORS[stripe % 2];
        for (let k = 0; k < 6; k++) colors.push(r, g, blue);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return new Mesh(geometry, new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.7,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    }));
}

// Portique au-dessus de la ligne de départ : deux piliers, une poutre et une bannière à damier.
function createStartGantry(track: Track, steel: MeshStandardMaterial): Group {
    const height = 6;
    const span = track.width + 2 * ROADSIDE;
    const gantry = new Group();
    const start = track.centerline[0];
    gantry.position.set(start.x, 0, start.z);
    gantry.rotation.y = track.headingAt(0);

    for (const side of [-1, 1]) {
        const pillar = new Mesh(new BoxGeometry(0.4, height, 0.4), steel);
        pillar.position.set((side * span) / 2, height / 2, 0);
        gantry.add(pillar);
    }
    const beam = new Mesh(new BoxGeometry(span, 0.5, 0.5), steel);
    beam.position.y = height;
    const banner = new Mesh(new PlaneGeometry(span - 1, 1.2), new MeshBasicMaterial({map: checkerTexture(), side: DoubleSide}));
    banner.position.y = height - 0.9;
    gantry.add(beam, banner);
    return gantry;
}

function labelTexture(text: string): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 120;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#f5f7fa";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#14181d";
    context.lineWidth = 8;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    context.fillStyle = "#14181d";
    context.font = "bold 72px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
    return toTexture(canvas);
}

function checkerTexture(): CanvasTexture {
    const cell = 16;
    const canvas = document.createElement("canvas");
    canvas.width = cell * 32;
    canvas.height = cell * 3;
    const context = canvas.getContext("2d")!;
    for (let x = 0; x < 32; x++) {
        for (let y = 0; y < 3; y++) {
            context.fillStyle = (x + y) % 2 === 0 ? "#f5f7fa" : "#14181d";
            context.fillRect(x * cell, y * cell, cell, cell);
        }
    }
    return toTexture(canvas);
}

function toTexture(canvas: HTMLCanvasElement): CanvasTexture {
    const texture = new CanvasTexture(canvas);
    // Les couleurs du canvas sont en sRGB : sans ça, three.js les affiche délavées.
    texture.colorSpace = SRGBColorSpace;
    return texture;
}
