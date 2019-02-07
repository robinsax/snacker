/** Snake smarts. */
const aStar = require('a-star');

const tell = (lbl, fn, idt=true) => (...args) => {
	let rv = fn(...args);
	console.log((idt ? '\t' : '') + lbl, '(', args, ') = ', rv);
	return rv;
};

const rectilinearDistance = (from, to) => Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
const isBeside = (a, b) => ((Math.abs(a.x - b.x) < 2) && (Math.abs(a.y - b.y) < 2));

const equal = (a, b) => ((a.x == b.x) && (a.y == b.y));

const safeNeighbors = (pt, avoid, size) => allNeighbors(pt, size).filter(a => avoid.filter(b => equal(a, b)).length == 0);

const allNeighbors = ({x, y}, {width, height}) => [
	(x < (width - 1)) && {x: x + 1, y},
	(x > 0) && {x: x - 1, y},
	(y < (height - 1)) && {x, y: y + 1},
	(y > 0) && {x, y: y - 1}
].filter(a => a !== false);

const directionTo = (from, to) => {
	if (from.x < to.x) return 'right';
	else if (from.x > to.x) return 'left';
	else if (from.y < to.y) return 'down';
	else if (from.y > to.y) return 'up';
	else return null;
};

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

const aStarTo = (from, to, size, toAvoid=[]) => {
	const xyToNode = ({ x, y }) => [x, y],
		nodeToXY = ([x, y]) => { return {x, y}; };
	console.log('a*', from, to);

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

module.exports = { 
	directionTo, rectilinearDistance, nearestFood,
	isBeside, aStarTo, safeNeighbors
};