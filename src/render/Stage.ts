import {
    Color,
    DirectionalLight,
    Fog,
    HemisphereLight,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    Scene,
    WebGLRenderer,
} from "three";
import { CameraRig } from "./CameraRig";

const BACKGROUND = 0x0b0f14;
// La précision du tampon de profondeur dépend du rapport far / near : near trop petit = sol qui clignote au loin.
const NEAR = 1;
const FAR = 1500;

// Tout ce qui est commun à l'affichage : moteur de rendu, scène, lumières, sol et caméra.
export class Stage {
    readonly scene = new Scene();
    readonly camera = new PerspectiveCamera(70, window.innerWidth / window.innerHeight, NEAR, FAR);
    readonly cameraRig = new CameraRig(this.camera);
    readonly renderer = new WebGLRenderer({antialias: true});

    constructor(container: HTMLElement) {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);
        logGpu(this.renderer);

        // Le sol se fond dans le brouillard, de la même couleur que le fond : pas d'horizon visible.
        this.scene.background = new Color(BACKGROUND);
        this.scene.fog = new Fog(BACKGROUND, 250, 900);

        this.scene.add(new HemisphereLight(0xcfe3ff, 0x1a2230, 2));
        const sun = new DirectionalLight(0xffffff, 2.5);
        sun.position.set(40, 80, 30);
        this.scene.add(sun);

        const ground = new Mesh(new PlaneGeometry(4000, 4000), new MeshStandardMaterial({color: 0x161c22, roughness: 1}));
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        window.addEventListener("resize", () => this.renderer.setSize(window.innerWidth, window.innerHeight));
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

// Indique dans la console quelle carte graphique le navigateur utilise réellement.
// « SwiftShader » ou « Microsoft Basic Render » = rendu logiciel, l'accélération matérielle est désactivée.
function logGpu(renderer: WebGLRenderer) {
    const gl = renderer.getContext();
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    console.info("GPU :", debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
}
