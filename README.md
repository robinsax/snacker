# snacker

*WIP*

## Usage

```bash
git clone https://github.com/robinsax/snacker.git
cd snacker
npm i
npm start
```

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
* Squiggle-powered spacial optimization - Heuristically optimizes the presence of a snake in
	a given cell by trying a variety of squiggle patterns. Also considers whether the
	snake segments at each potential end position will be gone upon being reached. True
	optimization has too high a time-space complexity, even when using eager DFS.
* "Choke matrix" generation - Generates a board matrix where each cells value is
	it's distance from a tile containing a snake body. Will be used for local choke
	point search to detect opponent trapping opportunies.

These algorithms are packed in the utilities module.

## Triage

Triage is my term for when the snake knows it can't safely do what it ideally would,
so it tries to get/stay out of trouble.
