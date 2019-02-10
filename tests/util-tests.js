const { positionAfterMoves, positionPsAfterMoves, chokeMat, chokePoints } = require('../utils.js');

const strToBoard = str => {
	str = str.trim();

	let walls = [], pt = null, rows = str.split('\n'),
		size = {width: rows[0].length, height: rows.length};

	rows.forEach((r, y) => {
		r = r.trim();
		for (let x = 0; x < r.length; x++) {
			if (r[x] == '#') {
				walls.push({x, y});
			}
			else if (r[x] == '*') {
				pt = {x, y};
			}
		}
	});

	return {pt, walls, size};
}

let snk = [{x: 1, y: 1}, {x: 2, y: 1}, {x: 3, y: 1}];
console.log('known pred');
console.log(positionAfterMoves(snk, [{x: 1, y: 2}]));

console.log('p pred');
let { pt, walls, size } = strToBoard(`
	......
	...#..
	*.....
	...#..
	......
	......
`);
console.log('\tfrom', pt, walls);
console.log(positionPsAfterMoves(pt, walls, size, 10));

console.log('choke mat');
console.log(chokeMat(walls, size));
