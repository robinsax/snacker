const {
	directionTo, nearestFood, aStarTo, safeNeighbors, allNeighbors, equal,
	cellAt, rectilinearDistance, unkey
} = require('./utils.js');

const safeMoveToFood = (face, food, body, size, occupied, cellOpts) => {
	//	Setup, finding nearest food that's safe to go for.
	let path = aStarTo(face, food, size, occupied), move;

	//	Maybe fail.
	if (!path) return null;

	//	Try and create move from path.
	let cellSize = cellAt(path[1], occupied, size).length,
		willTrap = cellSize <= body.length;

	//	Succeed if not a trap.
	if (!willTrap) return directionTo(face, path[1]);

	console.log('\ta* wants to trap me: ', cellSize, '<', body.length);

	//	Store opportunity in case we get stuck.
	cellOpts.push({dest: path[1], size: cellSize});
	
	//	XXX: Not nuanced.
	//	Try one more time without that option.
	path = aStarTo(face, food, size, occupied.concat(path[1]));
	if (path) {
		//	Found a new path.
		//	XXX: No safety check here.
		return directionTo(face, path[1]);
	}
	else {
		console.log('\tno other path');
		return null;
	}
};

const computeMove = req => {
	//	Comprehend state.
	let { board: {height, width, food, snakes}, you: {id, body} } = req.body,
		face = body[0], size = {width, height}, opponent = snakes.filter(s => s.id != id)[0],
		occupied = snakes.map(({ body }) => body).reduce((ag, b) => ag.concat(b)), move,
		maybeOccupied = occupied.concat(allNeighbors(opponent.body[0], size)), cellOpts = [];

	//	Inspect food moves in order of distance.
	food = food.sort((a, b) => rectilinearDistance(a, face) - rectilinearDistance(b, face));
	console.log('p', face, 'f', food.map(f => rectilinearDistance(f, face)));
	food.forEach(f => {
		if (move) return;

		move = safeMoveToFood(face, f, body, size, maybeOccupied, cellOpts);
	});

	//	Succeed if we found a nice move.
	if (move) return move;

	//	We are in triage.

	//	Hopefully find largest cell.
	console.log('triage inspects', cellOpts);
	let bestCell = cellOpts.sort((a, b) => b.size - a.size)[0];
	if (bestCell) {
		console.log('triage: |best cell| =', bestCell.size);
		return directionTo(face, bestCell.dest)
	}

	//	Do shit triage.
	let triage = safeNeighbors(face, maybeOccupied, size);
	console.log('triage: first of', triage);
	if (triage.length > 0) {
		return directionTo(face, triage[0]);
	}
	else {
		console.log('extreme failure!');
		return 'down';
	}
}

module.exports = {
	computeMove
};