const bodyParser = require('body-parser');
const app = require('express')();
const {
	fallbackHandler, notFoundHandler, genericErrorHandler, poweredByHandler
} = require('./handlers.js');
const { computeMove } = require('./brain.js');

const COLORS = [
	null, '#000000', '#aaffaa'
];

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
const mode = +process.env.MODE;
const stateStorage = {};

app.set('port', (process.env.PORT || 9001));

app.use(bodyParser.json());
app.use(poweredByHandler);

app.post('/start', (req, resp) => {
	let {game: {id}} = req.body;
	console.log('start game', id);
	stateStorage[id] = {turn: 0};

	return resp.json({color: COLORS[mode]});
});

app.post('/move', errorLogged((req, resp) => {
	let {game: {id}} = req.body, stateStore = (stateStorage[id] || {turn: 0}),
		{turn} = stateStore;
	console.log('begin turn ' + turn);

	let {move, state, taunt} = computeMove(req.body, stateStore, mode),
		payload = {move};
	if (taunt) payload.taunt = taunt;
	stateStorage[id] = {...state, turn: turn + 1};

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
