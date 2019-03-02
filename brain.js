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
	({eh, s, nearestHead}) => eh && (eh.length > s.body.length) && eh,
	({eh, isDangerous}) => eh && !isDangerous(eh) && eh,
	({sh, s, isDangerous}) => sh && !isDangerous(sh) && (sh.length > s.body.length) && sh,
	({eh, snh}) => eh && snh && eh.length > snh.length && eh, // Prefer escapes to saves with a chance to survive.
	({sh, snh}) => sh && snh && sh.length > snh.length && sh, // Prefer space saves with a chance to survive.
	({snh, eh, sh}) => snh || eh || sh
];

/**
*	Compute whether we can escape from the given cell with the given path. 
*/
const canEscape = (walls, path, state) => {
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
const conserveSpaceMoveInner = (state, snk) => {
	/** Managed return. */
	const finish = rv => {
		if (best) {
			console.log('selected', rv.path[0]);
			return directionTo(snk.head, rv.path[0], state);
		}
		else {
			console.log('failed');
			return null;
		}
	}
	let cells = [];
	//	Find all possible cells.
	cells = state.safeNeighbors(snk.head, state.dangerousOccupationMx).map(pt => (
		state.cellAt(pt, state.dangerousOccupationMx)
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

	let best = null;
	return finish(options[0]);
	

	//	Finish.
	return finish(null);
};

/**
*	Compute a move to a point with safety checks. 
*
*	XXX: Isn't consistant for prediction because behaviour depends on snake mode.
*/
const safeMove = (snk, to, state, stops=null, attackToHead=false) => {
	console.log('\t\t-- sm h / t / sl / ath', snk.head, to, stops, attackToHead)
	//	Compute a path to that food.
	let path = state.aStarTo(snk.head, to, stops && stops.map(({pt}) => pt));
	if (!path) return null;

	//	Check if trap and try to avoid.
	let cell = state.cellAt(path[1]), cellSize = cell.length;
	if (cellSize < snk.body.length && !attackToHead) {
		console.log('\ta* wants to trap me | would move', directionTo(snk.head, path[1], state));
		console.log('\tsl / stps', snk.body.length, stops);

		//	Add stop so we can recompute.
		stops = stops || [];
		stops.push({pt: path[1], p: path, cs: cellSize});
		//	Try again.
		return safeMove(snk, to, state, stops, attackToHead);
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
		console.log('a* wants to get sticky | would move', directionTo(snk.head, path[1], state));
		
		//	Add to stops so we can recompute.
		stops = stops || [];
		stops.push({pt: path[1]});
		//	Try again, prefering result.
		let retry = safeMove(snk, to, state, stops, attackToHead);
		if (retry) return retry;
		console.log('\tno way around it!');
	}
	
	//	It's cool.
	return directionTo(snk.head, path[1], state);
};

/** Move to the nearest food in a currently size-safe cell. */
const foodMoveAggressive = (state, urgent=false) => {
	console.log('food agro get? u:', urgent);
	let found = null, toCheck = state.food;

	//	Avoid walls if we're not urgent.
	if (!urgent) toCheck = toCheck.filter(f => {
		if (!state.allEdgesMap[keyable(f)]) return true;

		//	Make sure we're significantly closer.
		let okayDist = true, myDist = rectilinearDistance(state.self.head, f);
		state.opponents.forEach(({head}) => {
			if (!okayDist) return;

			if (rectilinearDistance(head, f) < (myDist - 5)) okayDist = false;
		});

		return okayDist;
	});
	console.log('\tcheck set', toCheck);

	//	Collect snakes that can kill us.
	let killers = state.opponents.filter(({body}) => (
		body.length >= state.self.body.length
	)), further = null;
	toCheck.forEach(f => {
		if (found) return;

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
			isFurther = false;
		state.opponents.forEach(({head}) => {
			if (isFurther) return;

			if (rectilinearDistance(head, f) < distance) {
				console.log('\tagro get', f, 'is disadvantaged');
				isFurther = true;
			}
		});

		let move = safeMove(state.self, f, state);
		if (!move) return;
		if (isFurther) further = move;
		else found = move;
	});
	
	if (found) return found;
	return urgent && further;
};

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

			move = safeMove(snk, targetable[0], state, null, true);
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
	/*if (state.allEdgesMap[keyable(state.self.head)]) {
		console.log('eek, im near the edge');
		
		//	Try to get off, prefering to move away from opponents.
		const nearestOpponent = o => (
			Math.min(...state.opponents.map(({head}) => rectilinearDistance(o, head)))
		);
		//	Sort by distance from enemy heads (nearest to furthest).
		//	XXX: Try chokemap maxes.
		let options = state.safeNeighbors(state.self.head).sort((a, b) => {
			
		}), stops = [...options];
		while (stops.length) {
			stops.pop();
			console.log('\ttry to centeralize w/ stops', stops);
		
			move = safeMove(state.self, state.center, state, stops.map(pt => ({pt})));
			if (move) return wrap(move, 'center here i come');
		}

		//	Move to the nearest cell if that's okay.
		//	Sort cells in order of size.
		options.forEach(o => {
			if (state.cellAt(o).length > state.self.body.length) 
			return wrap(directionTo(state.self.head, o, state), 'over here looks cool');
		});
	}*/

	//	Check if we want to prioritize eating.
	let needsToCatchUp = false;
	if (state.opponents.length) {
		let opsBySize = state.opponents.sort((a, b) => b.body.length - a.body.length);
		needsToCatchUp = opsBySize[0].body.length > (state.self.body.length - 2);
		console.log('needs to catch up / to', needsToCatchUp, opsBySize[0] && opsBySize[0].i);
	}
	let lowHP = state.self.health < 25;
	if (needsToCatchUp || lowHP) {
		move = foodMoveAggressive(state, lowHP);
		if (move) return wrap(move, 'chow time to catch up');
	}
	else {
		//	Maybe attack.
		move = computeAttackMove(state.self, state);
		if (move) return wrap(move, 'sick em');

		//	Maybe eat.
		move = foodMoveAggressive(state);
		if (move) return wrap(move, 'chow time');
	}

	//	Maybe escape.
	//move = backoffMove(state);
	//if (move) return wrap(move, 'backing off');

	//	Try to conserve space.
	move = conserveSpaceMove(state, state.self);
	if (move) return wrap(move, 'sticky situation!');

	let open = state.safeNeighbors(state.self.head, state.dangerousOccupationMx)[0];
	if (open) {
		console.log('buying time at', open);
		return wrap(directionTo(state.self.head, open, state), '*worried slither*');
	}

	console.log('sorry, i suck');
	return wrap('left', 'gg wp');
};

module.exports = { conserveSpaceMove, computeMove };