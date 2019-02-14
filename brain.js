/** High level thinking. */
const {
	GameState, directionTo, rectilinearDistance,
	keyable, mapify, createSquigglesIn, cellContainsOneOf
} = require('./utils.js');

//	Mode constants.
const AGRO = 1;
const SAFE = 2;

/**
*	Compute a triage move to conserve space.
*
*	XXX: Won't work properly if snk isn't self because of occupation matrix lookahead and
*		oppenent check hardcoding.
*/
const conserveSpaceMove = (state, snk) => {
	let cells = [];
	//	Find cells with safe access.
	cells = state.safeNeighbors(snk.head).map(pt => (
		state.cellAt(pt)
	)).filter(c => c.length > snk.body.length);
	console.log('conserving space | noc: ', cells.length, 'vs len', snk.body.length);
	//	As a fallback find cells without safe access.
	if (cells.length == 0) {
		cells = state.safeNeighbors(snk.head, state.dangerousOccupationMx).map(pt => (
			state.cellAt(pt, state.dangerousOccupationMx)
		)).filter(c => c.length > 0);
		console.log('\tno safe options, getting dangerous | noc: ' + cells.length);
	}

	//	Collect optimizations in the found cells.
	let options = [];
	cells.sort((a, b) => b.length - a.length).forEach(cell => {	
		console.log('\tsquiggle in cell with', cell[0]);
		options = options.concat(createSquigglesIn(snk.head, cell).filter(p => p.length > 0).map(path => {
			let last = path[path.length - 1],
				//	XXX: I N S A N E L Y unoptimized.
				wallsMap = state.cellWallsFor(cell);

			let walls = state.allNeighbors(last, false).map(n => {
				return {tid: wallsMap[keyable(n)], pt: n};
			}).filter(n => n.tid),
				hasFood = cellContainsOneOf(cell, state.food);

			return {cell, path, walls, hasFood};
		}));
	});

	//	Discover best option.
	let bestEscape = null, bestEscFactors = null, bestSpace = null, bestSpcFactors = null;
	options.forEach(opt => {
		let {cell, path, walls, hasFood} = opt;
		//	Check for opponent heads.
		let hasOpponentHeads = cellContainsOneOf(cell, state.opponents.map(({body: [head, ...x]}) => head));
		//	Collect factors.
		let factors = [hasFood, path.length, !hasOpponentHeads];

		//	Check for space.
		if (!bestSpace || factors.filter((a, i) => a > bestSpcFactors[i]).length > 2) {
			bestSpcFactors = factors;
			bestSpace = opt;
		}

		//	Check for escape.
		let isEscape = false;
		walls.forEach(({tid, pt}) => {
			//	That's the board edge or we already figured this out.
			if ((tid === true) || isEscape) return;

			let snake = state.snakeMap[tid],
				segI = snake.bodyMap[keyable(pt)];
			//	Check if this will be gone after running this path. Subtract an extra 1
			//	Since we can travel through tail segments.
			//	XXX: No margin of error.
			if ((snake.body.length - segI - 1) < path.length) isEscape = true;
		});
		if (!isEscape) return;
		if (!bestEscape) {
			console.log('\t\tfound first escape');
			bestEscape = opt;
			bestEscFactors = factors;
		}
		else {
			//	Check for improvements across > half of the factors.
			console.log('\t\tesc factors / vs', factors, bestEscFactors);
			if (factors.filter((a, i) => a > bestEscFactors[i]).length > 2) {
				bestEscFactors = factors;
				bestEscape = opt;
			}
		}
	});
	console.log('\tescape is', bestEscape && bestEscape.path);
	console.log('\tpacking opt is', bestSpace && bestSpace.path);
	//	Select our best bet, prefering escape.
	let best = bestEscape || bestSpace;
	
	//	Finish.
	if (best) {
		console.log('selected escape / len / cell sz', !!bestEscape, best.path.length, best.cell.length);
		return directionTo(snk.head, best.path[0]);
	}
	else {
		console.log('failed');
		return null;
	}
};

/** Compute a move to a point with safety checks. */
const safeMove = (snk, to, state, cells=null, stops=null, heur=null) => {
	//	Compute a path to that food.
	let path = state.aStarTo(snk.head, to, stops && stops.map(({pt}) => pt), heur);
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
		//	Collect list of food in cell in ascending order of distance.
		let foodHere = state.food.filter(f => c[keyable(f)]).sort((a, b) => (
			(rectilinearDistance(a, state.self.head) - rectilinearDistance(b, state.self.head))
			/
			state.chokeMap[a.y][a.x]
		));
		console.log('fd here', foodHere);

		foodHere.forEach(f => {
			if (move) return null;

			move = safeMove(state.self, f, state);
		});
	});

	return move;
};

/** Compute the move for the given request. */
const computeMove = (data, lastState, mode) => {
	let state = new GameState(data, lastState), move = null;
	const wrap = m => { return {move: m, state: state.save()}; };

	//	Maybe chill.
	if (mode == SAFE && state.self.health > 60) {
		console.log('finna chill?');
		//	Find the points of minimum choke and try to move toward one.
		let minChokeV = Object.keys(state.chokeValueMap).sort((a, b) => b - a)[0];
		
		state.chokeValueMap[minChokeV].sort((a, b) => (
			rectilinearDistance(a, state.self.head) - rectilinearDistance(b, state.self.head)
		)).forEach(pt => {
			if (move) return;

			move = safeMove(state.self, pt, state);
		});

		if (move) {
			console.log('\tconfirmed chill');
			return wrap(move);
		}
		else console.log('\twoah, nvm');
	}

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