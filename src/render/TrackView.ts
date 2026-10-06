import {
    BoxGeometry,
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    Group,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    PlaneGeometry,
    Quaternion,
    Vector3,
} from "three";
import type { Track } from "../simulation/Track";

const WALL_HEIGHT = 1;
const WALL_THICKNESS = 0.5;
// Assez haut au-dessus du sol pour que le tampon de profondeur les distingue, même de loin.
const ASPHALT_Y = 0.05;
const START_LINE_Y = 0.1;
const KERB_COLORS = [new Color(0xd8333a), new Color(0xeceff1)];

export class TrackView {
    readonly group = new Group();

    constructor(track: Track) {
        this.group.add(createAsphalt(track), createStartLine(track), createWalls(track));
    }
}

// Un seul InstancedMesh pour tous les murs : une boîte de longueur 1, dessinée une fois par mur
// avec sa propre matrice (position, rotation, longueur) et sa couleur. Un seul appel de dessin au lieu d'un par mur.
function createWalls(track: Track): InstancedMesh {
    const walls = new InstancedMesh(
        new BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, 1),
        new MeshStandardMaterial({roughness: 0.6}),
        track.walls.length,
    );

    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);

    track.walls.forEach(({start, end}, i) => {
        const dx = end.x - start.x;
        const dz = end.z - start.z;

        position.set((start.x + end.x) / 2, WALL_HEIGHT / 2, (start.z + end.z) / 2);
        // La boîte est allongée sur son axe Z local, comme l'avant de la voiture.
        rotation.setFromAxisAngle(up, Math.atan2(dx, dz));
        scale.set(1, 1, Math.hypot(dx, dz));
        walls.setMatrixAt(i, matrix.compose(position, rotation, scale));
        walls.setColorAt(i, KERB_COLORS[i % 2]);
    });
    return walls;
}

// Ruban de bitume : deux triangles entre chaque paire de points des bords gauche et droit.
function createAsphalt(track: Track): Mesh {
    const {leftBorder, rightBorder} = track;
    const positions = leftBorder.flatMap((left, i) => {
        const right = rightBorder[i];
        return [left.x, ASPHALT_Y, left.z, right.x, ASPHALT_Y, right.z];
    });

    // Sommets : gauche i = 2i, droite i = 2i + 1. L'ordre des sommets donne des faces tournées vers le haut.
    const n = leftBorder.length;
    const indices: number[] = [];
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        indices.push(2 * i, 2 * i + 1, 2 * j, 2 * i + 1, 2 * j + 1, 2 * j);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return new Mesh(geometry, groundLayer(0x30353d, 1));
}

function createStartLine(track: Track): Mesh {
    const start = track.centerline[0];
    const line = new Mesh(new PlaneGeometry(track.width, 1.5), groundLayer(0xf5f7fa, 2));
    // Ordre YXZ : on couche le plan au sol (X), puis on l'oriente perpendiculairement à la piste (Y).
    line.rotation.set(-Math.PI / 2, track.headingAt(0), 0, "YXZ");
    line.position.set(start.x, START_LINE_Y, start.z);
    return line;
}

// Matériau d'une couche posée au sol. polygonOffset décale sa profondeur vers la caméra :
// la couche gagne toujours contre celle du dessous, au lieu de clignoter (z-fighting).
function groundLayer(color: number, layer: number): MeshStandardMaterial {
    return new MeshStandardMaterial({
        color,
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -layer,
        polygonOffsetUnits: -layer,
    });
}
