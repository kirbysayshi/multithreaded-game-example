
Rather than define an entity with readFromSnapshot/writeToSnapshot, perhaps a component system would. Since data could be stored homogenously by type [1][] instead of as a mixed object, you could transfer data between threads faster via pooling.


[1]: http://www.gamedev.net/page/resources/_/technical/game-programming/implementing-component-entity-systems-r3382