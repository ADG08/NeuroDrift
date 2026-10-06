import { Game } from './src/game/Game';
import { Stage } from './src/render/Stage';

let dt = 0;
let lastTime: number | null = null;

const stage = new Stage(document.body);
const game = new Game(stage, document.getElementById('ui')!);

stage.renderer.setAnimationLoop(animate);

function animate( time: number ) {
  if (lastTime === null) {
    lastTime = time
  } else {
    dt = (time - lastTime) / 1000
    dt = Math.min(dt, 0.1)
  }

  lastTime = time
  game.update(dt)
  stage.render()
}
