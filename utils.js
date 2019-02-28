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

/** Basic range to list function. */
const range = (min, max) => {
	let arr = [];
	for (let k = min; k < max; k++) arr.push(k);
	return arr;
};
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
/** Return a string representation of a matrix. */
const matToStr = mx => mx.map(r => r.join(' ')).join('\n');

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
const isBeside = (a, b) => ((Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) < 2);
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

//	Squiggling utils.

//	Squiggle options.
const SQUIGGLE_OPTS = [
	[north, west, south, east],
	[north, east, south, west],
	[south, west, north, east],
	[south, east, north, west],
	[west, north, east, south],
	[west, south, east, north],
	[east, north, west, south],
	[east, south, west, north]
];

/**
*	Create and return the paths for each possible squiggle in the given cell.  
*/
const createSquigglesIn = (pt, cell) => {
	//	Setup.
	let cellMap = mapify(cell), paths = [];
	/** Curry a function that will return a point if a move to it is possible.  */
	const createStepFn = dFn => (pt, pathMap) => {
		let chk = dFn(pt), k = keyable(chk);
		if (cellMap[k] && !pathMap[k]) return chk;
		return null;
	};

	shuffle(SQUIGGLE_OPTS).map(opt => opt.map(createStepFn)).map(stepSeq => {
		let path = [], pathMap = {}, cur = pt;
		while (cur) {
			let next = null;
			stepSeq.forEach(stepFn => {
				if (next) return;
				next = stepFn(cur, pathMap);
			});
			if (next) {
				path.push(next);
				pathMap[keyable(next)] = true;
			};
			cur = next;
		}
		paths.push(path);
	});

	return paths;
};

/** 
*	Return whether or not the given cell (list or map) contains one of the 
*	given points. 
*/
const cellContainsOneOf = (cell, pts) => {
	if (cell instanceof Array) cell = mapify(cell);

	for (let i = 0; i < pts.length; i++) {
		if (cell[keyable(pts[i])]) return true;
	}
	return false;
};

//	Objects.

/** Snake comprehension with utilities. */
class Snake {
	constructor({body, health, id}, i, self) {
		this.body = body;
		this.health = health;
		this.self = self;
		this.id = id;
		this.i = i;

		//	Create body point, index in segments map.
		this.bodyMap = {};
		this.body.forEach((pt, i) => this.bodyMap[keyable(pt)] = i);
	}

	/**
	*	Calculate position of this snake after it takes the given number 
	*	set moves. Doesn't assert those moves are valid.
	*/
	positionAfterMoves(moves) {
		let trim = this.body.length - moves.length;
		return [...moves, ...this.body.filter((p, i) => i < trim)];
	}

	get head() { return this.body[0]; }
}

/** The base game state class. */
class GameState {
	constructor({board: {width, height, snakes, food}, you: {id}}, {turn}) {
		this.size = {width, height};
		this.snakes = snakes.map((s, i) => new Snake(s, i + 1, s.id == id));
		this.opponents = this.snakes.filter(s => !s.self);
		this.self = this.snakes.filter(s => s.self)[0];
		this.turn = turn;

		//	Construct index, snake map for constant lookup.
		this.snakeMap = {};
		this.snakes.forEach(s => this.snakeMap[s.i] = s);
		
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
			let nearFood = this.allNeighbors(s.head).filter(a => this.foodMap[keyable(a)]).length > 0;
			console.log('\tsnake-nalysis k / f / s', s.i, nearFood);
			s.body.forEach(({x, y}, i) => {
				if (nearFood || (i < s.body.length - 1)) this.occupationMx[y][x] = s.i;
			});
		});
		//	Save "dangerous" version to be used in triage.
		this.dangerousOccupationMx = this.occupationMx.map(a => [...a]);
		//	Add opponent next-move avoidance for larger snakes.
		this.opponents.filter(o => o.body.length >= this.self.body.length).forEach(o => (
			this.safeNeighbors(o.head).forEach(({x, y}) => this.occupationMx[y][x] = o.i)
		));
		console.log(this.show());

		//	Ref center.
		this.center = {x: Math.floor(width/2), y: Math.floor(height/2)}

		//	Compute edge set.
		this.allEdges = this.computeEdges();
		this.allEdgesMap = mapify(this.allEdges);

		//	Compute choke map.
		let {matrix, valueMap} = this.computeChokeMap();
		this.chokeMap = matrix;
		this.chokeValueMap = valueMap;
	}
	
	/** Return the to-be-saved representation of this state. */
	save() {
		return {};
	}
	
	/** Return all on-board neighboring points to the given point. */
	allNeighbors({x, y}, trimToBoard=true) {
		let {width, height} = this.size; 
		return [
			(!trimToBoard || (x < (width - 1))) && {x: x + 1, y},
			(!trimToBoard || (x > 0)) && {x: x - 1, y},
			(!trimToBoard || (y < (height - 1))) && {x, y: y + 1},
			(!trimToBoard || (y > 0)) && {x, y: y - 1}
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

		//	Populate defaults.
		//	XXX: Modified to include initial... does this fuck things up?
		ar = ar || [pt];
		lkup = lkup || {[keyable(pt)]: true};
	
		//	Find neighbors not already visited.
		let neighbors = this.safeNeighbors(pt, mx).filter(a => !lkup[keyable(a)]);
	
		//	Add neighbors.
		ar = ar.concat(neighbors);
		neighbors.forEach(n => lkup[keyable(n)] = true);
		
		//	Recurse.
		neighbors.forEach(n => ar = this.cellAt(n, mx, ar, lkup));
	
		return ar;
	}

	/**
	*	Compute the cell walls for the given cell, returning a map where values are
	*	the snake indicies or `true` for the board edge. 
	*
	*	XXX: Naive.
	*/
	cellWallsFor(cell) {
		let wallMap = {}, cellMap = mapify(cell),
			{width, height} = this.size;

		cell.forEach(pt => {
			this.allNeighbors(pt, false).forEach(n => {
				let k = keyable(n);
				if (cellMap[k] || wallMap[k]) return;

				if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) wallMap[k] = true;
				else wallMap[k] = this.dangerousOccupationMx[n.y][n.x];
			});
		});

		return wallMap;
	}

	/** Run A* pathfinding between two points. */
	aStarTo(from, to, ext=null, heur=null, mx=null) {
		heur = heur || rectilinearDistance;
		//	Setup helpers.
		const xyToNode = ({ x, y }) => [x, y],
			nodeToXY = ([x, y]) => { return {x, y}; };

		//	Build board mx.
		mx = mx || this.occupationMx;
		if (ext) {
			mx = mx.map(a => [...a]);
			ext.forEach(({x, y}) => mx[y][x] = true);
		}

		//	Run.
		//	XXX: timeout?
		let { status, path } = aStar({
			start: xyToNode(from),
			isEnd: ([x, y]) => equal(to, {x, y}),
			distance: (a, b) => rectilinearDistance(nodeToXY(a), nodeToXY(b)),
			heuristic: a => heur(nodeToXY(a), to),
			neighbor: a => this.safeNeighbors(nodeToXY(a), mx).map(xyToNode)
		});

		if (status != 'success') return null;
		return path.map(nodeToXY);
	}

	/** Compute the wall boundary cell set. */
	computeEdges() {
		let {width, height} = this.size;
 		return flatten([
			range(0, width).map(x => ([{x, y: 0}, {x, y: height - 1}])),
			range(0, height).map(y => ([{y, x: 0}, {y, x: width}]))
		]);
	}
	
	/** Compute the choke matrix for this state. */
	computeChokeMap() {
		let mx = createMat(this.size, () => 0), vMap = {};
	
		//	Boundary expansion.
		const pushFront = (s, k=0, lkup=null) => {
			//	Base case.
			if (s.length == 0) return;
			lkup = lkup || {};
			vMap[k] = s;
	
			//	Propagate out.
			let next = [], nextMap = {};
			s.forEach(pt => {
				mx[pt.y][pt.x] = mx[pt.y][pt.x] || k;

				lkup[keyable(pt)] = true;

				let set = this.safeNeighbors(pt).filter(a => !nextMap[keyable(a)]);
				nextMap = {...nextMap, ...mapify(set)};
				next = next.concat(set);
			});
			//	Reduce to unvisited.
			next = next.filter(a => !lkup[keyable(a)]);
	
			pushFront(next, k + 1, lkup);
		};
		let all = flatten([
			this.allEdges,
			this.snakes.map(({body}) => body)
		]);
		//	Propagate matrix updates.
		pushFront(all);
	
		return {matrix: mx, valueMap: vMap};
	}

	/** Return a string representation of this state. TODO: Unfinished. */
	show(overlayList=null, overlayMap=null) {
		let mx = createMat(this.size, () => '.');
		this.snakes.forEach(s => {
			s.body.forEach(({x, y}) => mx[y][x] = s.i);
		});
		this.food.forEach(({x, y}) => mx[y][x] = 'f');
		if (overlayList) overlayList.forEach(({x, y}) => mx[y][x] = 'a');
		if (overlayMap) Object.keys(overlayMap).map(k => (
			[overlayMap[k], unkey(k)]
		)).forEach(([v, {x, y}]) => mx[y][x] = v);

		return '--- turn ' + this.turn + ' ---\n' + matToStr(mx);
	}
}

//	Exports.
module.exports = { 
	directionTo, rectilinearDistance,
	isBeside, equal, keyable, unkey, mapify, listify,
	deepEqual, uniques, createMat, south, north, east, west, 
	createSquigglesIn, showMat, cellContainsOneOf, matToStr,
	GameState, Snake
};