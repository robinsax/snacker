import re
import sys

fn, turn = sys.argv[1:3]
offs = 1
if len(sys.argv) == 4:
	offs = int(sys.argv[3])

with open(fn) as f:
	log = f.read()

found = list()
for match in re.finditer(r'begin turn %s\n.*?\nmove .*?\n'%turn, log, re.DOTALL):
	found.append(match)

print(found[-offs].group(0))
