/** Utilities and algorithms. */
const aStar = require('a-star');

//	Constants.

//	Move options.
const MOVE_OPS = [
	[(a, b) => a.x < b.x, 'right'],	
	[(a, b) => a.x > b.x, 'left'],
	[(a, b) => a.y < b.y, 'down'],
	[(a, b) => a.y > b.y, 'up']
];

//	Helpers.

/** Print a matrix. */
const showMat = mx => mx.map(r => r.join('')).join('\n');

/** Flatten an array of any depth. */
const flatten = a => {
	let result = [];
	
	a.forEach(b => {
		if (b instanceof Array) result = result.concat(flatten(b));
		else result.push(b);
	});

	return result;
}
/** Fisher-Yates shuffle an array. Doesn't mutate original. */
const shuffle = a => {
	a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Create a matrix of the given size. */
const createMat = ({width, height}, initCellVal) => {
	let mx = [];
	for (let i = 0; i < width; i++) {
		let row = [];
		for (let j = 0; j < height; j++) row.push(initCellVal());
		mx.push(row);
	}

	return mx;
};

/** Move point north once. */
const north = ({x, y}) => { return {x, y: y - 1}; };
/** Move point south once. */
const south = ({x, y}) => { return {x, y: y + 1}; };
/** Move point east once. */
const east = ({x, y}) => { return {x: x + 1, y}; };
/** Move point west once. */
const west = ({x, y}) => { return {x: x - 1, y}; };

/** Create a key-ready representation of a point of O(1) lookups. */
const keyable = ({x, y}) => x + ',' + y;
/** Recreate a point from a keyed representation. */
const unkey = s => (([x, y]) => { return {x, y}; })(s.split(',').map(n => parseInt(n)));
/** Convert a list of points to a map. */
const mapify = l => {
	let map = {};
	l.forEach(pt => {
		map[keyable(pt)] = true
	});
	return map;
}
/** Convert a map of points into an unordered list. */
const listify = m => Object.keys(m).map(k => unkey(k));

/** Remove duplicates from a list of points. */
const uniques = l => {
	let m = {};
	return l.filter(a => {
		let k = keyable(a);
		if (!m[k]) return true;
		m[k] = true;
		return false;
	});
};

/** Distance in N between points.  */
const rectilinearDistance = (from, to) => Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
/** Point adjacency check. */
const isBeside = (a, b) => ((Math.abs(a.x - b.x) < 2) && (Math.abs(a.y - b.y) < 2));
/** Point equality check. */
const equal = (a, b) => ((a.x == b.x) && (a.y == b.y));
/** Point set equality. */
const deepEqual = (a, b) => {
	let aMap = mapify(a);
	return b.filter(c => !aMap[keyable(c)]).length == 0;
};

/**
*	Return a random direction of the first move toward the given location. Don't
*	hardcode direction preference to avoid it being inferred. Asking to noop move
*	will result in null return.
*/
const directionTo = (from, to) => shuffle(MOVE_OPS).filter(([cond, ...t]) => (
	cond(from, to)
)).map(([t, res]) => res)[0] || null;

//	Objects.

/** Snake comprehension with utilities. */
class Snake {
	constructor({body, health, id}, i, self, future=false) {
		this.body = body;
		this.health = health;
		this.self = self;
		this.id = id;
		this.i = i;
		this.future = future;
	}

	/**
	*	Create a future version of this snake after it takes the given move. 
	*/
	createFuture(move) {
		let {health, id, i, self} = this;
		return new Snake({body: this.positionAfterMoves([move]), health, id}, i, self, true);
	}

	/**
	*	Calculate position of this snake after it takes the given number 
	*	set moves. Doesn't assert those moves are valid.
	*/
	positionAfterMoves(moves) {
		let trim = this.body.length - moves.length;
		return [...moves, ...this.body.filter((p, i) => i < trim)];
	}
	
	/*headPositionPsAfterTurns(game, n, rootP=1.0) {
		//	Point-visit logic. Returns an array.
		const visit = (pt, m, rp) => {
			if (m == 0) return [];

			//	Compute neighbors.
			let neighbors = game.safeNeighbors(pt), pHere = rp/neighbors.length;
			//	Maybe done. Note there's never repeats here.
			if (m == 1) return neighbors.map(ne => { return {tile: ne, p: pHere}; });

			//	Step out then collate repeats since this could create duplicates.
			let map = {};
			flatten(neighbors.map(ne => visit(ne, m - 1, pHere))).forEach(({tile, p}) => {
				let nk = keyable(tile);
				map[nk] = map[nk] || 0;
				map[nk] += p;
			});

			//	Return result.
			return listify(map).map(pt => { return {tile: pt, p: map[keyable(pt)]}; });	
		}

		//	Compute and phrase as a matrix.
		let mx = createMat(game.size, () => 0);
		visit(this.head, n, rootP).forEach(({tile: {x, y}, p}) => mx[y][x] += p);

		return mx;
	}*/

	get head() { return this.body[0]; }
}

/** The base game state class. */
class BaseGameState {
	constructor({size, snakes, self, opponents, food, turn}) {
		this.size = size;
		this.snakes = snakes;
		this.opponents = opponents;
		this.self = self;
		this.turn = turn;
		
		//	Sort food.
		this.food = food.sort((a, b) => (
			rectilinearDistance(a, this.self.head) - rectilinearDistance(b, this.self.head)
		));
		//	Mapify for constant time lookup.
		this.foodMap = mapify(this.food);

		//	Build occupation matrix.
		this.occupationMx = createMat(this.size, () => 0);
		this.snakes.forEach(s => {
			//	Add snake to occupation matrix, excluding it's tail segment if it
			//	definitely can't expand on the next move.
			let nearFood = this.allNeighbors(s.head).filter(a => this.foodMap[keyable(a)]).length == 0;
			s.body.forEach(({x, y}, i) => {
				if (nearFood || (i < s.body.length - 1)) this.occupationMx[y][x] = s.i;
			});
		});
		//	Save "dangerous" version to be used in triage.
		this.dangerousOccupationMx = this.occupationMx.map(a => [...a]);
		//	Add opponent next-move avoidance.
		this.opponents.forEach(o => (
			this.safeNeighbors(o.head).forEach(({x, y}) => this.occupationMx[y][x] = o.i)
		));

		//	Optimization data structures.
		this.o_cellAtMap = {};
	}

	/**  
	*	Create all top-probability 1-future states from this game state for the 
	*	given self move.
	*
	*	TODO: Unfinished (opponents).
	*/
	createFutures(mv) {
		let nextOpponentSets = this.opponents.map(s => (
				this.safeNeighbors(s.head, this.dangerousOccupationMx).map(n => (
					s.createFuture(n)
				))
			)), 
			nextSelf = this.self.createFuture(mv),
			nextSnakes = [nextSelf].sort((a, b) => a.i - b.i);

		let {size, food, turn} = this;
		return new FutureGameState({
			size, snakes: nextSnakes,
			self: nextSelf, opponents: [], food, turn
		});
	}
	
	/** Return all on-board neighboring points to the given point. */
	allNeighbors({x, y}) {
		let {width, height} = this.size; 
		return [
			(x < (width - 1)) && {x: x + 1, y},
			(x > 0) && {x: x - 1, y},
			(y < (height - 1)) && {x, y: y + 1},
			(y > 0) && {x, y: y - 1}
		].filter(a => a !== false); 
	}

	/** 
	*	Return all on-board neighbors to the given point that aren't considered 
	*	occupied. 
	*/
	safeNeighbors(pt, mx=null) {
		mx = mx || this.occupationMx;
		return this.allNeighbors(pt).filter(({x, y}) => !mx[y][x]);
	}

	/**
	*	Compute the "cell" at a given point. Optional arguments used for recursion.
	*
	*	XXX: Naive. 
	*/
	cellAt(pt, mx=null, ar=null, lkup=null) {
		mx = mx || this.occupationMx;
		//	Check map.
		let ptK = keyable(pt);
		if (this.o_cellAtMap[ptK]) return this.o_cellAtMap[ptK];

		//	Populate defaults.
		ar = ar || [];
		lkup = lkup || {};
	
		//	Find neighbors not already visited.
		let neighbors = this.safeNeighbors(pt, mx).filter(a => !lkup[keyable(a)]);
	
		//	Add neighbors.
		ar = ar.concat(neighbors);
		neighbors.forEach(n => lkup[keyable(n)] = true);
		
		//	Recurse.
		neighbors.forEach(n => ar = this.cellAt(n, mx, ar, lkup));
	
		this.o_cellAtMap[ptK] = ar;
		return ar;
	}

	/** Run A* pathfinding between two points. */
	aStarTo(from, to, ext=null) {
		const xyToNode = ({ x, y }) => [x, y],
			nodeToXY = ([x, y]) => { return {x, y}; };
		let mx = this.occupationMx;
		if (ext) {
			mx = mx.map(a => [...a]);
			ext.forEach(({x, y}) => mx[y][x] = true);
		}

		let { status, path } = aStar({
			start: xyToNode(from),
			isEnd: ([x, y]) => equal(to, {x, y}),
			distance: (a, b) => rectilinearDistance(nodeToXY(a), nodeToXY(b)),
			heuristic: a => rectilinearDistance(nodeToXY(a), to),
			neighbor: a => this.safeNeighbors(nodeToXY(a), mx).map(xyToNode)
		});

		if (status != 'success') return null;
		return path.map(nodeToXY);
	}
	
	/** Compute the choke matrix for this state. */
	computeChokeMap() {
		let mx = createMat(this.size, () => 0);
		//	Boundary expansion.
		const pushFront = (s, k=0, lkup=null) => {
			//	Base case.
			if (s.length == 0) return;
			lkup = lkup || {};
	
			//	Propagate out.
			let next = [];
			s.forEach(pt => {
				mx[pt.y][pt.x] = mx[pt.y][pt.x] || k;
				lkup[keyable(pt)] = true;
				next = next.concat(this.safeNeighbors(pt));
			});
			//	Reduce to unvisited.
			next = next.filter(a => !lkup[keyable(a)]);
	
			pushFront(next, k + 1, lkup);
		};
		//	Propagate matrix updates.
		pushFront(walls);
	
		return mx;
	}

	/** Return a string representation of this state. TODO: Unfinished. */
	repr() {
		let lines = ['--- turn ' + this.turn + (this instanceof FutureGameState ? ' (future)' : '') + ' ---'];
	
		return lines.join('\n');
	}
}

/** Current game state comprehension with utilies. */
class TrueGameState extends BaseGameState {
	constructor({board: {width, height, snakes, food}, you: {id}}, {turn}) {
		let snakeOs = snakes.map((s, i) => new Snake(s, i + 1, s.id == id));
		super({
			size: {width, height}, snakes: snakeOs, food, turn,
			self: snakeOs.filter(s => s.self)[0],
			opponents: snakeOs.filter(s => !s.self)
		});
	}

	/** Return the to-be-saved representation of this state. */
	save() {
		return {};
	}
}

/** A future game state. */
class FutureGameState extends BaseGameState {
	constructor(stateData, probability=0.0) {
		super(stateData);
		this.probability = probability;
	}
}

//	Exports.
module.exports = { 
	directionTo, rectilinearDistance,
	isBeside, equal, keyable, unkey, mapify, listify,
	deepEqual, uniques, createMat, south, north, east, west, 
	showMat,
	TrueGameState, FutureGameState, Snake
};