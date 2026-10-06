import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { Car } from "../simulation/car";

export class CarView {
    readonly car: Car;
    readonly mesh: Mesh;

    constructor(car: Car) {
        this.car = car
        const geo = new BoxGeometry(2,1,5);
        const material = new MeshBasicMaterial({color: 0x00ff00});
        this.mesh = new Mesh(geo, material);
    }

    sync() {
        //surement faire des calculs de la positions vis a vis de la currentSpeed aussi afin de calculer ou le x et z devrait etre
        //ah non je crois que le calcul sera plutot du cote Car.ts

        this.mesh.position.setX(this.car.x)
        this.mesh.position.setZ(this.car.z)
        this.mesh.rotation.y = this.car.rotation
    }
}