/** Snake smarts. */
const aStar = require('a-star');

//	Move options.
const MOVE_OPS = [
	[(a, b) => a.x < b.x, 'right'],	
	[(a, b) => a.x > b.x, 'left'],
	[(a, b) => a.y < b.y, 'down'],
	[(a, b) => a.y > b.y, 'up']
];

//	Debug fn i/o helper.
const tell = (lbl, fn, idt=true) => (...args) => {
	let rv = fn(...args);
	console.log((idt ? '\t' : '') + lbl, '(', args, ') = ', rv);
	return rv;
};

//	Flatten an array of any depth.
const flatten = a => {
	let result = [];
	
	a.forEach(b => {
		if (b instanceof Array) result = result.concat(flatten(b));
		else result.push(b);
	});

	return result;
}
//	Fisher-Yates shuffle an array. Doesn't mutate original.
const shuffle = a => {
	a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

//	Create a key-ready representation of a point of O(1) lookups.
const keyable = ({x, y}) => x + ',' + y;
//	Recreate a point from a keyed representation.
const unkey = s => (([x, y]) => { return {x, y}; })(s.split(',').map(n => parseInt(n)));
//	Convert a list of points to a map.
const mapify = l => {
	let map = {};
	l.forEach(pt => map[keyable(pt)] = true);
	return map;
}
//	Convert a map of points into an unordered list.
const listify = m => Object.keys(m).map(k => unkey(k));

//	Remove duplicates from a list of points.
const uniques = l => {
	let m = {};
	return l.filter(a => {
		let k = keyable(a);
		if (!m[k]) return true;
		m[k] = true;
		return false;
	});
};

//	Cartesian distance in N between points.
const rectilinearDistance = (from, to) => Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
//	Point adjacency check.
const isBeside = (a, b) => ((Math.abs(a.x - b.x) < 2) && (Math.abs(a.y - b.y) < 2));
//	Point equality check.
const equal = (a, b) => ((a.x == b.x) && (a.y == b.y));
//	Point set equality.
const deepEqual = (a, b) => {
	let aMap = mapify(a);
	return b.filter(c => !aMap[keyable(c)]).length == 0;
};

//	Return all neighboring cells on the board.
const allNeighbors = ({x, y}, {width, height}) => [
	(x < (width - 1)) && {x: x + 1, y},
	(x > 0) && {x: x - 1, y},
	(y < (height - 1)) && {x, y: y + 1},
	(y > 0) && {x, y: y - 1}
].filter(a => a !== false);
//	Return all neighboring cells not occupied by a point in the avoid list.
const safeNeighbors = (pt, avoid, size) => allNeighbors(pt, size).filter(a => (
	avoid.filter(b => equal(a, b))
).length == 0);

//	Return a random direction of the first move toward the given location. Don't
//	hardcode direction preference to avoid it being inferred. Asking to noop move
//	will result in null return.
const directionTo = (from, to) => shuffle(MOVE_OPS).filter(([cond, ...t]) => (
	cond(from, to)
)).map(([t, res]) => res)[0] || null;

//	Return the nearest food from the given list.
const nearestFood = (snk, fd) => {
	let min = null, minI;
	fd.forEach((f, i) => {
		let d = rectilinearDistance(snk, f);
		if ((min === null) || (min > d)) {
			minI = i;
			min = d;
		};
	});

	return fd[minI];
};

//	Return the size of the cell of which the given point is a part, given
//	an array of boundaries.
const cellAt = (pt, avoid, size, ar=null, lkup=null) => {
	ar = ar || [];
	lkup = lkup || {};

	//	Find neighbors not already visited.
	let neighbors = safeNeighbors(pt, avoid, size).filter(a => !lkup[keyable(a)]);

	//	Add neighbors.
	ar = ar.concat(neighbors);
	neighbors.forEach(n => lkup[keyable(n)] = true);
	
	//	Recurse.
	neighbors.forEach(n => ar = cellAt(n, avoid, size, ar, lkup));

	return ar;
}

//	Compute the path between the given points on a board of the given size,
//	optionally avoiding a set of points.
const aStarTo = (from, to, size, toAvoid=[]) => {
	const xyToNode = ({ x, y }) => [x, y],
		nodeToXY = ([x, y]) => { return {x, y}; };

	let { status, path } = aStar({
		start: xyToNode(from),
		isEnd: ([x, y]) => equal(to, {x, y}),
		distance: (a, b) => rectilinearDistance(nodeToXY(a), nodeToXY(b)),
		heuristic: a => rectilinearDistance(nodeToXY(a), to),
		neighbor: a => allNeighbors(nodeToXY(a), size).filter(b => (
			toAvoid.filter(c => equal(b, c)).length == 0
		)).map(xyToNode)
	});

	if (status != 'success') return null;
	return path.map(nodeToXY);
};

//	Compute the position of a snake later given its set of moves. Doesn't
//	assert the moved-to positions are valid.
const positionAfterMoves = (snk, mvs) => [...mvs, ...snk.filter((p, i) => (
	i < (snk.length - mvs.length)
))];

//	Compute the probabilistic positions of a snake after n moves given it won't
//	hit barriers. Assumes randomly distributed movement selection. Don't pass large 
//	n in prod.
//	XXX: Top notch shit would weight result with a heuristic.
const positionPsAfterMoves = (snk, avoid, size, n, rp=1.0) => {
	if (n == 0) return [];
	let ar = [];
	
	//	Compute neighbors.
	let neighbors = safeNeighbors(snk, avoid, size), pHere = rp/neighbors.length;
	//	Maybe done. Note there's never repeats here.
	if (n == 1) return neighbors.map(ne => { return {tile: ne, p: pHere}; });

	//	Step out. Note this could create duplicates.
	let nearby = neighbors.map(ne => (
			positionPsAfterMoves(ne, avoid, size, n - 1, pHere, ar
		))), flat = flatten(nearby);
	//	Collate repeats.
	let map = {};
	flat.forEach(({tile, p}) => {
		let nk = keyable(tile);
		map[nk] = map[nk] || 0;
		map[nk] += p;
	});
	//	Return result.
	//	XXX: This is the dumbest thing ever.
	return listify(map).map(pt => { return {tile: pt, p: map[keyable(pt)]}; });	
};

//	Calculate the set of chokepoints.
const chokeMat = (walls, size) => {
	let mx = [];
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
			next = next.concat(safeNeighbors(pt, walls, size));
		});
		//	Reduce to unvisited.
		next = next.filter(a => !lkup[keyable(a)]);

		pushFront(next, k + 1, lkup);
	};

	//	Create matrix.
	let {width, height} = size;
	for (let i = 0; i < width; i++) {
		let row = [];
		for (let j = 0; j < height; j++) row.push(0);
		mx.push(row);
	}
	//	Propagate matrix updates.
	pushFront(walls);

	return {matrix: mx};
};

//	Exports.
module.exports = { 
	directionTo, rectilinearDistance, nearestFood,
	isBeside, aStarTo, safeNeighbors, allNeighbors, equal,
	cellAt, keyable, unkey, positionAfterMoves, mapify,
	positionPsAfterMoves, listify, chokeMat,
	deepEqual, uniques
};