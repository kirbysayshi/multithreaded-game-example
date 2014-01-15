
module.exports = FixedStep;

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

  // Remove what will be consumed this tick.
  if (steps > 0) this.accumulator -= steps * this.targetDT;

  this.accumulatorRatio = this.accumulator / this.targetDT;

  //console.log('steps this update', steps);

  while(steps > 0) {
    this.onStep(this.targetDT);
    steps--;
  }
}
