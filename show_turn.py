import re
import sys

fn, turn = sys.argv[1:]

with open(fn) as f:
	log = f.read()

found = list()
for match in re.finditer(r'begin turn %s\n.*?\nmove .*?\n'%turn, log, re.DOTALL):
	found.append(match.group(0))

print('\n\n#########\n\n'.join(found))
