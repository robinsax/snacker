const bodyParser = require('body-parser');
const app = require('express')();
const {
	fallbackHandler, notFoundHandler, genericErrorHandler, poweredByHandler
} = require('./handlers.js');
const { computeMove } = require('./brain.js');

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
	stateStorage[id] = {__turn: 0};

	return resp.json({});
});

app.post('/move', errorLogged((req, resp) => {
	let {game: {id}} = req.body,
		{__turn, ...lastState} = stateStorage[id];
	console.log('begin turn ' + __turn);
	let {move, state} = computeMove(req.body, lastState);

	stateStorage[id] = {...state, __turn: __turn + 1};
	console.log('move', move); 
	return resp.json({ move });
}));

app.post('/end', (req, resp) => {
	let {game: {id}} = req.body;
	delete stateStorage[id];
	
	return resp.json({})
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
