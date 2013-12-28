
module.exports = StepStateInterpolator;

/**
 * Given a target constant delta time, call `logicalStep` enough times
 * to consume a larger, irregular delta time, while also providing
 * an interpolation ratio to `graphicsStep`, which will be called as
 * often as `StepStateInterpolator#update`.
 */

function StepStateInterpolator(targetDT, logicalStep, graphicsStep) {
  this.accumulator = 0;
  this.accumulatorRatio = 0;
  this.logicalStep = logicalStep;
  this.graphicsStep = graphicsStep;
  this.targetDT = targetDT || 33.3333;
}

StepStateInterpolator.prototype.update = function(dt) {

  this.accumulator += dt;

  // take the current delta, plus what remains from last time,
  // and determine how many logical steps fit.
  var steps = Math.floor(this.accumulator / this.targetDT);

  // Remove what will be consumed this tick.
  if (steps > 0) this.accumulator -= steps * this.targetDT;

  this.accumulatorRatio = this.accumulator / this.targetDT;

  while(steps > 0) {
    this.logicalStep(this.targetDT);
    steps--;
  }

  this.graphicsStep(this.targetDT, this.accumulatorRatio);
}
