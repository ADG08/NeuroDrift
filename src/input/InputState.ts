import type { CarControls } from "../simulation/CarControls";

export class InputState implements CarControls{
    forward: boolean = false;
    backward: boolean = false;
    left: boolean = false;
    right: boolean = false;

    constructor() {
        window.addEventListener('keydown', (event: KeyboardEvent) => {
            this.setKey(event.code, true)
        });
        window.addEventListener('keyup', (event: KeyboardEvent) => {
            this.setKey(event.code, false)
        });
    }

    private setKey(code: string, pressed: boolean) {
        switch (code) {
            case 'KeyW':
                this.forward = pressed
                break
            case 'KeyS':
                this.backward = pressed
                break
            case 'KeyA':
                this.left = pressed
                break
            case 'KeyD':
                this.right = pressed
                break
        }
    }
}