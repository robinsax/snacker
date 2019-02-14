/** High level thinking. */
const {
	GameState, directionTo, rectilinearDistance,
	keyable, mapify, createSquigglesIn
} = require('./utils.js');

//	Mode constants.
const AGRO = 1;
const SAFE = 2;

/**
*	Compute a triage move to conserve space.
*
*	XXX: Won't work properly if snk isn't self because of occupation matrix lookahead. 
*/
const conserveSpaceMove = (state, snk) => {
	let cells = [];
	//	Find cells with safe access.
	cells = state.safeNeighbors(snk.head).map(pt => (
		state.cellAt(pt)
	)).filter(c => c.length > snk.head);
	console.log('conserving space | noc: ', cells.length, 'vs len', snk.body.length);

	//	As a fallback find cells without safe access.
	if (cells.length == 0) {
		cells = state.safeNeighbors(snk.head, state.dangerousOccupationMx).map(pt => (
			state.cellAt(pt, state.dangerousOccupationMx)
		)).filter(c => c.length > 0);
		console.log('\tno safe options, getting dangerous | noc: ' + cells.length);
	}

	let options = [];
	cells.sort((a, b) => b.length - a.length).forEach(cell => {	
		console.log('\tsquiggle in cell with', cell[0]);
		options = options.concat(createSquigglesIn(snk.head, cell).filter(p => p.length > 0).map(path => {
			let last = path[path.length - 1],
				//	XXX: I N S A N E L Y unoptimized.
				wallsMap = state.cellWallsFor(cell);

			let walls = state.allNeighbors(last, false).map(n => {
				return {tid: wallsMap[keyable(n)], pt: n};
			}).filter(n => n.tid);
			return {cell, path, walls};
		}));
	});

	//	XXX: Look at walls.
	let best = options.sort((a, b) => b.path.length - a.path.length)[0] || null;
	if (best) {
		console.log('best save sz / cell sz', best.path.length, best.cell.length);
		return directionTo(snk.head, best.path[0]);
	}
	else {
		console.log('failed');
		return null;
	}
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

/** Move to the nearest food in a currently size-safe cell. */
const foodMoveAggressive = state => {
	let move = null;
	state.food.forEach(f => {
		if (move) return;

		move = safeMove(state.self, f, state);
	});
	
	return move;
};

/** Move to the nearest food in the safest cell. */
const foodMoveCareful = state => {
	//	Get nearby cells.
	let neighbors = state.safeNeighbors(state.self.head),
		cells = neighbors.map(n => state.cellAt(n)).filter(a => (
			a.length >= state.self.body.length
		)).sort((a, b) => (
			b.length - a.length
		)),
		cellMaps = cells.map(mapify);
	console.log('careful cell sizes', cells.map(c => c.length));

	//	Find nearest food with super-priority being cell quality.
	let move = null;
	cellMaps.forEach(c => {
		if (move) return;

		state.food.forEach(f => {
			if (move) return null;

			//	This food is in this cell.
			if (c[keyable(f)]) {
				console.log('carefully want food', f);
				//	Find nearest neighbor in this cell between self and food.
				let nearests = neighbors.filter(n => c[keyable(n)]).sort((a, b) => (
					rectilinearDistance(a, f) - rectilinearDistance(b, f)
				));
				move = directionTo(state.self.head, nearests[0]);
			}
		});
	});

	return move;
};

/** Compute the move for the given request. */
const computeMove = (data, lastState, mode) => {
	let state = new GameState(data, lastState), move = null;
	const wrap = m => { return {move: m, state: state.save()}; };

	//	Maybe get some food.
	move = (mode == AGRO ? foodMoveAggressive : foodMoveCareful)(state);
	if (move) return wrap(move);

	//	Try to conserve space.
	move = conserveSpaceMove(state, state.self);
	if (move) return wrap(move);

	let open = state.safeNeighbors(state.self.head, state.dangerousOccupationMx)[0];
	if (open) {
		console.log('buying time at', open);
		return wrap(directionTo(state.self.head, open));
	}

	console.log('sorry, i suck');
	return wrap('left');
};

module.exports = { conserveSpaceMove, computeMove };