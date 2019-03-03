const bodyParser = require('body-parser');
const app = require('express')();
const {
	fallbackHandler, notFoundHandler, genericErrorHandler, poweredByHandler
} = require('./handlers.js');
const { computeMove } = require('./brain.js');

const COLOR = '#FF3917';

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
const stateStorage = {};

app.set('port', (process.env.PORT || 9001));

app.use(bodyParser.json());
app.use(poweredByHandler);

app.post('/start', (req, resp) => {
	let {game: {id}} = req.body;
	console.log('start game', id);
	stateStorage[id] = {turn: 0};

	return resp.json({color: COLOR});
});

app.post('/move', errorLogged((req, resp) => {
	let {game: {id}, turn} = req.body;
	console.log('begin turn ' + turn);

	let {move, taunt} = computeMove(req.body, turn),
		payload = {move};
	if (taunt) payload.taunt = taunt;

	console.log('move', move, 'taunt', taunt); 
	return resp.json(payload);
}));

app.post('/end', (req, resp) => {
	let {game: {id}} = req.body;
	console.log('end game', id);
	delete stateStorage[id];
	
	return resp.json({});
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
