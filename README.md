# Robin's "snacker" snake

*WIP, I'm mostly building out utilities at the moment*.

## Packaging

* `brain.js` does high level strategy
* `utils.js` contains game state comprehension, algorithms, helpers, etc.
	Also performs some rudimentary intellegence in comprehension.

## Data structures

There are common data structures around here:
* Point lists - rarely used cause they're O(n)
* Point maps - used for constant time lookup of point inclusion in sets
* Matricies - board-size 2+d arrays. These are indexed with y, x to make
	debug outputs make sense.

The utilities module has helpers for creating and manipulating these.

## Algorithms

Non-trivial algorithms included so far:
* A* - go-to for pathfinding, I just wrapped the `a-star` npm package for now
* Cell detection - DFS "cell" detection. Cells are areas of the board enclosed 
	by snake bodies
* Future position probabilility - A naive algorithm for predicting future 
	opponent snake position. For now, it assumes the probability of move direction
	is evenly distributed, but that the snake won't move into walls
* "Choke matrix" generation - Generates a board matrix where each cells value is
	it's distance from a tile containing a snake body. Will be used for local choke
	point search to detect opponent trapping opportunies.

These algorithms are packed in the utilities module.

## Triage

Triage is my term for when the snake knows it can't safely do what it ideally would,
so it tries to get/stay out of trouble.
