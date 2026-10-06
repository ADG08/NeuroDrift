import { Game } from './src/game/Game';
import { Stage } from './src/render/Stage';
import { FpsCounter } from './src/ui/FpsCounter';

let dt = 0;
let lastTime: number | null = null;

const ui = document.getElementById('ui')!;
const stage = new Stage(document.body);
const game = new Game(stage, ui);
const fps = new FpsCounter(ui);

stage.renderer.setAnimationLoop(animate);

function animate( time: number ) {
  const workStart = performance.now()
  if (lastTime === null) {
    lastTime = time
  } else {
    dt = (time - lastTime) / 1000
    dt = Math.min(dt, 0.1)
  }

  lastTime = time
  game.update(dt)
  stage.render()
  fps.tick(time, performance.now() - workStart)
}
