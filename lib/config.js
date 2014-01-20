
module.exports = {

    // How often should the physics be calculated?
    PHYSICS_HZ: 1000 / 30

    /**
     * How many boids should we generate?
     */
  , BOID_COUNT: 700

    /**
     * How much energy should be lost when colliding? This is fairly low
     * so the boids coalesce quickly.
     */
  , BOID_DAMPING: 0.95

    /**
     * How far away should the boids be generated from the attraction point?
     */
  , BOID_INITIAL_DISTANCE: 600

    /**
     * Where boids be attracting.
     */
  , BOID_ATTRACTION_POINT_X: 400
  , BOID_ATTRACTION_POINT_Y: 100

    /**
     * Boid raidus is randomly generated using a seedable generator. Meaning
     * while the generation is random, it's reproducible between runs if the
     * same seed is used.
     */
  , BOID_MIN_RADIUS: 4
  , BOID_MAX_RADIUS: 8

    /**
     * How potent is the attraction?
     */
  , CENTER_ATTRACTION: 0.1
}