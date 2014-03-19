
module.exports = FixedStep;

/**
 * Given a target delta time, execute a callback only when that target
 * delta time has been execeeded. If more time than the target delta
 * has elapsed since the last call to `update`, then execute the callback
 * multiple times synchronously to compensate.
 *
 * A common use for this is if you put a tab into the background. When focus
 * returns physics will still be up to date, even though they were not being
 * calculated in real time.
 *
 * This object does no time calculations itself, so it relies on accurate
 * elapsed times being passed into `update`.
 */

function FixedStep(targetDT, onStep) {
  this.accumulator = 0;
  this.accumulatorRatio = 0;
  this.onStep = onStep;
  this.targetDT = targetDT || 33.3333;
}

FixedStep.prototype.update = function(dt) {

  this.accumulator += dt;

  // take the current delta, plus what remains from last time,
  // and determine how many logical steps fit.
  var steps = Math.floor(this.accumulator / this.targetDT);
  var totalSteps = steps;

  // Remove what will be consumed this tick.
  if (steps > 0) this.accumulator -= steps * this.targetDT;

  this.accumulatorRatio = this.accumulator / this.targetDT;

  //console.log('steps this update: ' + steps + ', dt: ' + dt);

  while(steps > 0) {
    this.onStep(this.targetDT);
    steps--;
  }

  return totalSteps;
}
