
module.exports = {

    // How often should the physics be calculated?
    PHYSICS_HZ: 30

    /**
     * What timestep should be used to compute the physics?
     * A smaller value yields more accurate collisions, but will require
     * more iterations per second (above).
     */
  , PHYSICS_DT: 16

    /**
     * How many boids should we generate?
     */
  , BOID_COUNT: 1000

    /**
     * How much energy should be lost when colliding? This is fairly low
     * so the boids coalesce quickly.
     */
  , BOID_DAMPING: 0.5

    /**
     * How far away should the boids be generated from the attraction point?
     */
  , BOID_INITIAL_DISTANCE: 600

    /**
     * Where boids be attracting.
     */
  , BOID_ATTRACTION_POINT_X: 400
  , BOID_ATTRACTION_POINT_Y: 200

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