const bodyParser = require('body-parser');
const express = require('express');
const logger = require('morgan');
const app = express();
const {
	fallbackHandler, notFoundHandler, genericErrorHandler, poweredByHandler
} = require('./handlers.js');
const {
	directionTo, nearestFood, aStarTo, safeNeighbors
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
	let { board: {height, width, food, snakes}, you: {body} } = req.body,
		face = body[0], size = {width, height},
		occupied = snakes.map(({ body }) => body).reduce((ag, b) => ag.concat(b));

	let path = aStarTo(face, nearestFood(face, food), size, occupied),
		move;
	if (path) {
		move = directionTo(face, path[1]);
	}
	else {
		let triage = safeNeighbors(face, occupied, size);
		console.log('triage', triage);
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
