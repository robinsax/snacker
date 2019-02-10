/** High level thinking. */
const {
	GameState, directionTo, rectilinearDistance
} = require('./utils.js');

/** 
*	Compute a safe move for the given snake to the given point.
*/
const safeMoveTo = (pt, snk, state) => {
	//	Setup.
	let path = state.aStarTo(snk.head, pt);
	//	Maybe fail.
	if (!path) return null;

	return directionTo(snk.head, path[1]);
}

/** Compute the move for the given request. */
const computeMove = ({body}) => {
	let state = new GameState(body), move = null;
	state.food.forEach(f => {
		if (move) return;

		move = safeMoveTo(f, state.self, state);
	});
	console.log(move);

	return move || 'left';
};

module.exports = { computeMove };