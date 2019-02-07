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

//	Fisher-Yates shuffle. Doesn't mutate original.
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

//	Cartesian distance in N between points.
const rectilinearDistance = (from, to) => Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
//	Point adjacency check.
const isBeside = (a, b) => ((Math.abs(a.x - b.x) < 2) && (Math.abs(a.y - b.y) < 2));
//	Point equality check,
const equal = (a, b) => ((a.x == b.x) && (a.y == b.y));

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

//	Exports.
module.exports = { 
	directionTo, rectilinearDistance, nearestFood,
	isBeside, aStarTo, safeNeighbors, allNeighbors, equal,
	cellAt, keyable
};