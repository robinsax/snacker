/** High level thinking. */
const {
	GameState, directionTo, rectilinearDistance,
	keyable, mapify, createSquigglesIn, cellContainsOneOf, isBeside,
	listify, flatten
} = require('./utils.js');

//	Mode constants.
const ALPHA = 1; // XXX: Agro.
const OMEGA = 2; // XXX: Cautious.

//	The stack of space conservation selectors.
const SPACE_CONSERVE_SELECT_STAGES = [
	({enh}) => enh,
	({snh, s}) => snh && (snh.length > s.body.length) && snh,
	({eh, isDangerous}) => eh && !isDangerous(eh) && eh,
	({sh, s, isDangerous}) => sh && !isDangerous(sh) && (sh.length > s.body.length) && sh,
	({snh, eh, sh}) => snh || eh || sh
];

/**
*	Compute whether we can escape from the given cell. 
*/
const canEscape = (walls, state) => {
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

	return isEscape;
};

/**
*	Compute a triage move to conserve space (inner fn).
*
*	XXX: Won't work properly if snk isn't self because of occupation matrix lookahead and
*		oppenent check hardcoding.
*/
const conserveSpaceMoveInner = (state, snk, dangerous=false) => {
	let cells = [];
	//	Find all possible cells.
	cells = state.safeNeighbors(snk.head, dangerous && state.dangerousOccupationMx).map(pt => (
		state.cellAt(pt, dangerous && state.dangerousOccupationMx)
	)).filter(c => c.length > 0);
	console.log('conserve space option count:', cells.length, 'vs len', snk.body.length);

	//	Collect optimizations in the found cells.
	let options = [];
	cells.sort((a, b) => b.length - a.length).forEach(cell => {	
		console.log('\tsquiggle in cell with', cell[0]);
		options = options.concat(createSquigglesIn(snk.head, cell).filter(p => (
			p.length > 0
		)).map(path => {
			let wallsMap = state.cellWallsFor(cell); //	XXX: I N S A N E L Y unoptimized.

			let walls = listify(wallsMap).map(n => {
				return {tid: wallsMap[keyable(n)], pt: n};
			}).filter(n => n.tid),
				hasFood = cellContainsOneOf(cell, state.food);

			return {cell, path, walls, hasFood};
		}));
	});

	//	Gather opponent heads.
	let opHeads = state.opponents.map(({head}) => head);
	if (!dangerous) {
		//	Expand head set with lookaheads.
		opHeads = opHeads.concat(flatten(state.opponents.map(({head}) => (
			state.safeNeighbors(head, state.dangerousOccupationMx)
		))));
	} 

	let opHeadsMap = mapify(opHeads);

	//	Discover best option.
	let escapeNoHeads = null, spaceNoHeads = null, spaceHeads = null, escapeHeads = null;
	options.forEach(opt => {
		//	XXX: not using hasFood?
		let {cell, path, walls, hasFood} = opt;
		//	Check for opponent heads.
		let hasOpponentHeads = cellContainsOneOf(cell, opHeads) || 
			(walls.filter(({pt}) => opHeadsMap[keyable(pt)]).length > 0);

		//	Check for escape.
		let isEscape = canEscape(walls, state);
		
		//	Maybe assign to maxes.
		console.log('\trun maxes for', opt.path[0]);
		if (!hasOpponentHeads) {
			if (isEscape) {
				if (!escapeNoHeads || (escapeNoHeads.length < path.length)) {
					console.log('\t\tesc no heads');
					escapeNoHeads = path;
				}
			}
			else {
				if (!spaceNoHeads || (spaceNoHeads.length < path.length)) {
					console.log('\t\tspace no heads');
					spaceNoHeads = path;
				}
			}
		}
		else {
			if (isEscape) {
				if (!escapeHeads || (escapeHeads.length < path.length)) {
					console.log('\t\tescape w/ heads');
					escapeHeads = path;
				}
			}
			else {
				if (!spaceHeads || (spaceHeads.length < path.length)) {
					console.log('\t\tspace w/ heads');
					escapeHeads = path;
				}
			}
		}
	});
	console.log('--- begin selection');
	/** Whether a given path is dangerous. XXX: simplistic. */
	const isDangerous = path => {
		let dangerous = false;
		path.forEach(pt => {
			if (dangerous) return;
			
			opHeads.forEach(h => {
				if (isBeside(pt, h)) dangerous = true;
			});
		});

		return dangerous;
	};

	//	Select our best bet using the preference stack.
	let best = null, payload = {
		enh: escapeNoHeads, eh: escapeHeads, snh: spaceNoHeads, sh: spaceHeads,
		s: snk, isDangerous
	};

	SPACE_CONSERVE_SELECT_STAGES.forEach((fn, k) => {
		if (best) return;

		best = fn(payload);
		console.log('\tstage k', k, !!best);
	});
	
	//	Finish.
	if (best) {
		console.log('selected', best[0]);
		return directionTo(snk.head, best[0]);
	}
	else {
		console.log('failed');
		return null;
	}
};

/**
*	Compute a space conservation move. 
*/
const conserveSpaceMove = (state, snk) => {
	return conserveSpaceMoveInner(state, snk) || conserveSpaceMoveInner(state, snk, true);
}

/**
*	Compute a move to a point with safety checks. 
*
*	XXX: Isn't consistant for prediction because behaviour depends on snake mode.
*/
const safeMove = (snk, to, state, stops=null) => {
	//	Compute a path to that food.
	let path = state.aStarTo(snk.head, to, stops && stops.map(({pt}) => pt), (a, b) => (
		rectilinearDistance(a, b)/state.chokeMap[b.y][b.x]
	));
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
		return safeMove(snk, to, state, stops);
	}

	//	Check if sticky and try to avoid.
	let isSticky = false;
	state.opponents.forEach(({head}) => {
		if (isSticky) return;
		state.allNeighbors(head).forEach(pt => {
			if (isBeside(pt, path[1])) isSticky = true;
		});
	});
	if (isSticky) {
		console.log('a* wants to get sticky | would move', directionTo(snk.head, path[1]));
		
		//	Add to stops so we can recompute.
		stops = stops || [];
		stops.push({pt: path[1]});
		//	Try again, prefering result.
		let retry = safeMove(snk, to, state, stops);
		if (retry) return retry;
		console.log('\tno way around it!');
	}
	
	//	It's cool.
	return directionTo(snk.head, path[1]);
};

/** Move to the nearest food in a currently size-safe cell. */
const foodMoveAggressive = (state, urgent=false) => {
	console.log('\tfood agro get?');
	let found = null, toCheck = state.food;

	//	Avoid walls if we're not super hungry.
	if (!urgent) toCheck = toCheck.filter(f => {
		if (!state.allEdgesMap[keyable(f)]) return true;

		//	Make sure we're significantly closer.
		let okayDist = true, myDist = rectilinearDistance(state.self.head, f);
		state.opponents.forEach(({head}) => {
			if (!okayDist) return;

			if (rectilinearDistance(head, f) < (myDist - 2)) okayDist = false;
		});

		return okayDist;
	});

	//	Collect snakes that can kill us.
	let killers = state.opponents.filter(({body}) => (
		body.length >= state.self.body.length
	));

	toCheck.forEach(f => {
		if (found && !found.further) return;

		//	Skip moves to food that might put us near another, larger snake.
		let getsSticky = false;
		killers.forEach(({head}) => {
			if (getsSticky) return;

			state.allNeighbors(head).forEach(pt => {
				if (isBeside(pt, f)) getsSticky = true;
			});
		});
		if (getsSticky) console.log('\tagro get', f, 'is sticky');
		if (getsSticky) return;

		//	Check if we're further than someone else.
		let distance = rectilinearDistance(state.self.head, f),
			further = false;
		state.opponents.forEach(({head}) => {
			if (further) return;

			if (rectilinearDistance(head, f) < distance) {
				console.log('\tagro get', f, 'is disadvantaged');
				further = true;
			}
		});

		let move = safeMove(state.self, f, state);
		if (move) found = {move, further};
	});
	
	return found && !found.further && found.move;
};

/** Move to the food with the highest choke map value. */
const foodMoveAvoidance = state => {
	//	Order from greatest choke map value to least.
	let ordered = state.food.map(pt => (
		{pt, chk: state.chokeMap[pt.y][pt.x]}
	)).sort((a, b) => (
		b.chk - a.chk
	));

	return safeMove(state.self, ordered[0].pt, state);
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

/** Move into open space. Pre-triage. */
const backoffMove = state => {
	console.log('backoff?');
	//	First, if there's snakes nearby we want to move directly away.
	let near = [];
	state.opponents.forEach(({head}) => {
		if (state.safeNeighbors(head, state.dangerousOccupationMx).filter(pt => (
			isBeside(pt, state.self.head)
		)).length > 0) near.push(head);
	});
	console.log('\tnear heads', near);

	if (near.length) {
		//	XXX: naive.
		//	Compute avoid options.
		let avoidOpts = state.safeNeighbors(state.self.head, state.dangerousOccupationMx),
			bestAvoid = null;
		avoidOpts.forEach(pt => {
			let d = Math.min(...near.map(a => rectilinearDistance(a, pt)));
			console.log('\t\tpt / dist', pt, d);

			if (!bestAvoid || bestAvoid.d < d) bestAvoid = {pt, d}
		});
		console.log('\tbest avoid is', bestAvoid);
		if (bestAvoid) return directionTo(state.self.head, bestAvoid.pt);
	}

	//	Maybe we can chase tail?
	let move;
	console.log('chase tail?');
	state.safeNeighbors(state.self.head).forEach(pt => {
		if (move) return;

		let cell = state.cellAt(pt);
		if (cell.length == 0) return;
		let wallMap = state.cellWallsFor(cell),
			walls = listify(wallMap);

		//	If this cell has other snakes as edges ignore.
		//	XXX: reduce to check for head.
		if (walls.filter(({tid}) => (
			tid !== true && tid !== state.self.i).length > 0
		)) move = directionTo(state.self.head, pt);
	});

	//	Find the points of minimum choke and try to move toward one.
	console.log('maximize choke?');
	let minChokeV = Object.keys(state.chokeValueMap).sort((a, b) => b - a)[0];
	state.chokeValueMap[minChokeV].sort((a, b) => (
		rectilinearDistance(a, state.self.head) - rectilinearDistance(b, state.self.head)
	)).forEach(pt => {
		if (move) return;

		move = safeMove(state.self, pt, state);
	});

	if (move) {
		console.log('\tconfirmed chill');
		return move;
	}
	else console.log('\twoah, nvm');
}

/** 
*	Compute a probably successful attack move.
*
* 	XXX: snk must be self because of opponent hardcoding and occupation mx lookahead.
*/
const computeAttackMove = (snk, state) => {
	let move = null;
	console.log('attack check', state.opponents.length);

	state.opponents.forEach(op => {
		if (move) return;

		if (snk.body.length > op.body.length) {
			//	Try and head over to a possible next move, favoring moving in.
			let targetable = state.safeNeighbors(op.head).sort((a, b) => (
				rectilinearDistance(a, state.center) - rectilinearDistance(b, state.center)
			));
			console.log('\tchk snk / targ', op.i, targetable);
			if (!targetable.length) return;

			move = safeMove(snk, targetable[0], state);
			console.log('\tattack to snake / move fnd', op.i, move);
		}
	});

	if (move) console.log('\tconfirmed');
	return move;
}

/** Compute the move for the given request. */
const computeMove = (data, lastState) => {
	let state = new GameState(data, lastState), move = null;
	const wrap = (move, taunt=null) => { 
		return {
			move, taunt, 
			state: state.save()
		};
	};

	//	Prioritize safety when against walls.
	if (state.allEdgesMap[keyable(state.self.head)]) {
		console.log('eek, im near the edge');
		//	Try to conserve space.
		move = backoffMove(state);
		if (move) return wrap(move, 'i hate edges');
	}

	let needsToCatchUp = false;
	if (state.opponents.length) {
		let opsBySize = state.opponents.sort((a, b) => b.body.length - a.body.length);
		needsToCatchUp = opsBySize[0].body.length > state.self.body.length;
		console.log('needs to catch up / to', needsToCatchUp, opsBySize[0]);
	}
	if (needsToCatchUp || state.self.health < 25) {
		move = foodMoveAggressive(state, true);
		if (move) return wrap(move, 'chow time to catch up');
	} 

	//	Maybe attack.
	move = computeAttackMove(state.self, state);
	if (move) return wrap(move, 'sick em');

	//	Maybe eat.
	move = foodMoveAggressive(state);
	if (move) return wrap(move, 'chow time');

	//	Maybe escape.
	move = backoffMove(state);
	if (move) return wrap(move, 'backing off');

	//	Try to conserve space.
	move = conserveSpaceMove(state, state.self);
	if (move) return wrap(move, 'sticky situation!');

	let open = state.safeNeighbors(state.self.head, state.dangerousOccupationMx)[0];
	if (open) {
		console.log('buying time at', open);
		return wrap(directionTo(state.self.head, open), '*worried slither*');
	}

	console.log('sorry, i suck');
	return wrap('left', 'gg wp');
};

module.exports = { conserveSpaceMove, computeMove };