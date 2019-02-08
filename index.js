const bodyParser = require('body-parser');
const express = require('express');
const logger = require('morgan');
const app = express();
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

app.set('port', (process.env.PORT || 9001));

//app.enable('verbose errors');
//app.use(logger('dev'));

app.use(bodyParser.json());
app.use(poweredByHandler);

app.post('/start', (req, resp) => {
	return req.json({
		color: '#DFFF00',
	});
});

app.post('/move', errorLogged((req, resp) => {
	move = computeMove(req);

	console.log('move', move); 
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
