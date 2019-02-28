import re
import sys

fn, turn = sys.argv[1:]

with open(fn) as f:
	log = f.read()

found = None
for match in re.finditer(r'begin turn %s\n.*?\nmove .*?\n'%turn, log, re.DOTALL):
	found = match

print(found.group(0))
