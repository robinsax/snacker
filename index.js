const bodyParser = require('body-parser');
const express = require('express');
const logger = require('morgan');
const app = express();
const {
	fallbackHandler, notFoundHandler, genericErrorHandler, poweredByHandler
} = require('./handlers.js');
const {
	directionTo, nearestFood, aStarTo, safeNeighbors, allNeighbors, equal,
	cellAt
} = require('./smart.js');

const errorLogged = fn => (...args) => {
	try {
		return fn(...args);
	}
	catch (ex) {
		console.error(ex);
		console.error(ex.stack);
		throw ex;
	}
};

app.set('port', (process.env.PORT || 9001));

app.enable('verbose errors');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(poweredByHandler);

app.post('/start', (req, resp) => {
	return req.json({
		color: '#DFFF00',
	});
});

app.post('/move', errorLogged((req, resp) => {
	//console.log(JSON.stringify(req.body, null, 4));
	//	Comprehend state.
	let { board: {height, width, food, snakes}, you: {id, body} } = req.body,
		face = body[0], size = {width, height}, opponent = snakes.filter(s => s.id != id)[0],
		occupied = snakes.map(({ body }) => body).reduce((ag, b) => ag.concat(b)),
		maybeOccupied = occupied.concat(allNeighbors(opponent.body[0], size));

	//	Setup, finding nearest food that's safe to go for.
	let dest = nearestFood(face, food.filter(f => (
		maybeOccupied.filter(a => equal(a, f)).length == 0
	))), path, move;

	//	Try to avoid places where the opponent snake might move, but fall back 
	//	if that isn't possible.
	if (!(path = aStarTo(face, dest, size, maybeOccupied))) {
		console.log('feeling dangerous (need to pass near opponent)');
		path = aStarTo(face, dest, size, occupied);
	}

	//	Try and create move from path.
	if (path) {
		let cellSize = cellAt(path[1], occupied, size).length,
			willTrap = cellSize <= body.length;

		if (willTrap) {
			console.log('a* wants to trap me: ', cellSize, '<', body.length);

			//	Try one more time.
			path = aStarTo(face, dest, size, occupied.concat(path[1]));
			if (path) {
				//	Found a new path.
				//	XXX: No safety check here.
				move = directionTo(face, path[1]);
			}
			else {
				console.log('no other path, probably fucked');
			}
		}
		else {
			//	Move won't trap.
			move = directionTo(face, path[1]);
		}
	}

	if (!move) {
		//	Do some shitty triage.
		let triage = safeNeighbors(face, occupied, size);
		console.log('triageed', triage);
		if (triage.length > 0) {
			move = directionTo(face, triage[0]);
		}
		else {
			console.warn('Extreme failure!');
			move = 'down';
		}
	}

	return resp.json({ move });
}));

app.post('/end', (request, response) => {
	return response.json({})
});

app.post('/ping', (request, response) => {
	return response.json({});
});

app.use('*', fallbackHandler);
app.use(notFoundHandler);
app.use(genericErrorHandler);

app.listen(app.get('port'), () => {
	console.log('Server listening on port %s', app.get('port'))
});
