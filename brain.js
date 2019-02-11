/** High level thinking. */
const {
	TrueGameState, directionTo, rectilinearDistance,
	north, west, east, south, keyable, mapify
} = require('./utils.js');

/** Compute a triage move to compute space. */
const conserveSpaceMove = (snk, cell) => {
	let cellMap = mapify(cell);

	if (cellMap[keyable(north(snk.head))]) return 'up';
	if (cellMap[keyable(south(snk.head))]) return 'down';
	if (cellMap[keyable(west(snk.head))]) return 'left';
	if (cellMap[keyable(east(snk.head))]) return 'right';
	
	console.log("i can't conserve in that cell");
	return null;
};

/** Compute a move to a point with safety checks. */
const safeMove = (snk, to, state, cells=null, stops=null) => {
	//	Compute a path to that food.
	let path = state.aStarTo(snk.head, to, stops && stops.map(({pt}) => pt));
	if (!path) return null;

	//	Check if trap and try to avoid.
	let cell = state.cellAt(path[1]), cellSize = cell.length;
	if (cellSize < snk.body.length) {
		console.log('a* wants to trap me | would move', directionTo(snk.head, path[1]));
		console.log('\tsl / stps', snk.body.length, stops);

		//	Add stop so we can recompute.
		stops = stops || [];
		stops.push({pt: path[1], p: path, cs: cellSize});
		//	Try again.
		return safeMove(snk, to, state, cells, stops);
	}
	
	//	It's cool.
	return directionTo(snk.head, path[1]);
};

/** Compute the move for the given request. */
const computeMove = (data, lastState, mode) => {
	let state = new TrueGameState(data, lastState), move = null;
	const wrap = m => { return {move: m, state: state.save()}; };

	console.log(state.dangerousOccupationMx);

	//	Maybe get some food.
	state.food.forEach(f => {
		if (move) return;

		move = safeMove(state.self, f, state);
	});
	if (move) return wrap(move);

	//	Try to conserve space.
	let cells = [];
	cells = state.safeNeighbors(state.self.head).map(pt => (
		state.cellAt(pt)
	)).filter(c => c.length > state.self.head);
	console.log('conserving space | naive option count: ', cells.length, 'vs len', state.self.body.length);
	if (cells.length == 0) {
		cells = state.safeNeighbors(state.self.head, state.dangerousOccupationMx).map(pt => (
			state.cellAt(pt, state.dangerousOccupationMx)
		));
		console.log('\tno options, getting dangerous | naive option count: ' + cells.length);
		console.log('\t', cells);
	}
	cells.sort((a, b) => b.length - a.length).forEach(cell => {
		if (move) return;

		console.log('try cell', cell);
		move = conserveSpaceMove(state.self, cell);
	});
	if (move) return wrap(move);

	let open = state.safeNeighbors(state.self.head, state.dangerousOccupationMx)[0];
	if (open) {
		console.log('buying time at', open);
		return wrap(directionTo(state.self.head, open));
	}

	console.log('sorry, i suck');
	return wrap('left');
};

module.exports = { computeMove };