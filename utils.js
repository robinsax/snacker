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

/** Create a key-ready representation of a point of O(1) lookups. */
const keyable = ({x, y}) => x + ',' + y;
/** Recreate a point from a keyed representation. */
const unkey = s => (([x, y]) => { return {x, y}; })(s.split(',').map(n => parseInt(n)));
/** Convert a list of points to a map. */
const mapify = l => {
	let map = {};
	l.forEach(pt => map[keyable(pt)] = true);
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
	constructor({body, health, id}, i, self) {
		this.body = body;
		this.health = health;
		this.self = self;
		this.id = id;
		this.i = i;
	}

	/**
	*	Calculate position of this snake after it takes the given number 
	*	set moves. Doesn't assert those moves are valid.
	*/
	positionAfterMoves(moves) {
		let trim = this.body.length - moves.length;
		return [...moves, ...this.body.filter((p, i) => i < trim)];
	}

	/**
	*	Create a board-matrix where each cell is the probabilty this snakes
	*	head will occupy it after n moves.
	*
	*	XXX: Naive.
	*/
	headPositionPsAfterTurns(game, n, rootP=1.0) {
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
	}

	get head() { return this.body[0]; }
}

/** The game state comprehension with utilies. */
class GameState {
	constructor({board: {width, height, snakes, food}, you: {id}}) {
		this.size = {width, height};
		this.snakes = snakes.map((s, i) => new Snake(s, i + 1, s.id == id));
		this.opponents = this.snakes.filter(s => !s.self);
		this.self = this.snakes.filter(s => s.self)[0];

		//	Sort food.
		this.food = food.sort((a, b) => (
			rectilinearDistance(a, this.self.head) - rectilinearDistance(b, this.self.head)
		));

		//	Build occupation matrix.
		this.occupationMx = createMat(this.size, () => 0);
		this.snakes.forEach(s => s.body.forEach(({x, y}) => this.occupationMx[y][x] = s.i));
		//	Add opponent next-move avoidance.
		this.opponents.forEach(o => (
			this.safeNeighbors(o.head).forEach(({x, y}) => this.occupationMx[y][x] = o.i)
		));
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
	safeNeighbors(pt) {
		return this.allNeighbors(pt).filter(({x, y}) => !this.occupationMx[y][x]);
	}

	/**
	*	Compute the "cell" at a given point.
	*
	*	XXX: Naive. 
	*/
	cellAt(pt, avoid, size, ar=null, lkup=null) {
		//	Populate defaults.
		ar = ar || [];
		lkup = lkup || {};
	
		//	Find neighbors not already visited.
		let neighbors = this.safeNeighbors(pt).filter(a => !lkup[keyable(a)]);
	
		//	Add neighbors.
		ar = ar.concat(neighbors);
		neighbors.forEach(n => lkup[keyable(n)] = true);
		
		//	Recurse.
		neighbors.forEach(n => ar = this.cellAt(n, ar, lkup));
	
		return ar;
	}

	/** Run A* pathfinding between two points. */
	aStarTo(from, to) {
		const xyToNode = ({ x, y }) => [x, y],
			nodeToXY = ([x, y]) => { return {x, y}; };

		let { status, path } = aStar({
			start: xyToNode(from),
			isEnd: ([x, y]) => equal(to, {x, y}),
			distance: (a, b) => rectilinearDistance(nodeToXY(a), nodeToXY(b)),
			heuristic: a => rectilinearDistance(nodeToXY(a), to),
			neighbor: a => this.allNeighbors(nodeToXY(a)).filter(b => (
				!this.occupationMx[b.y][b.x]
			)).map(xyToNode)
		});

		if (status != 'success') return null;
		return path.map(nodeToXY);
	}

	/** Compute the choke matrix for the current turn. */
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
}

//	Exports.
module.exports = { 
	directionTo, rectilinearDistance,
	isBeside, equal, keyable, unkey, mapify, listify,
	deepEqual, uniques, createMat, GameState, Snake
};