# Robin's snacker snake

*This is a WIP.*

The strategy for this snake is:
* For navigation, use A*
	* Avoiding current and near-future snake positions
	* Using a heuristic that up-weights traveling though likely future positions of opponent snakes
* Focus on food until length is sufficient for a path blocking play
	* Use set plays?
	* A* across the future position of opponent?
	* Etc...
