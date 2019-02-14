const { GameState, listify, createSquigglesIn, keyable } = require('../utils.js');
const { conserveSpaceMove } = require('../brain.js');

const createState = str => {
	str = str.trim();

	let snakes = {}, rows = str.split('\n'), food = [],
		width = rows[0].length, height = rows.length;

	rows.forEach((r, y) => {
		r = r.trim();
		for (let x = 0; x < r.length; x++) {
			if (r[x] == '.') continue;
			let pt = {x, y};

			if (r[x] == 'f') {
				food.push(pt);
				continue;
			}

			let k = +r[x];
			snakes[k] = snakes[k] || [];
			snakes[k].push(pt);
		}
	});

	snakes = Object.keys(snakes).map(k => {
		let s = snakes[k];

		return {
			health: 100,
			id: k,
			body: s.sort((a, b) => (a.x + a.y) - (b.x + b.y))
		};
	});

	return new GameState({board: {width, height, food, snakes}, you: {id: 1}}, {turn: 0});
}

let state = createState(`
	22222..
	2..111.
	2....1.
	2...21.
	222221.
	...111.
`);
let cell = state.cellAt(state.self.head);

console.log(state.show(cell));

let walls = state.cellWallsFor(cell);
console.log('walls');
console.log(walls);
console.log(state.show(listify(walls)));

let squiggles = createSquigglesIn(state.self.head, cell);
console.log('squiggle');
console.log(squiggles);
console.log('...in desc quality order');
squiggles.sort((a, b) => b.length - a.length).forEach(a => {
	let map = {};
	a.forEach((p, i) => {
		map[keyable(p)] = String.fromCharCode(i + 65);
	});
	console.log(state.show(null, map));
});
console.log(conserveSpaceMove(state, state.self));