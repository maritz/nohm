"use strict";


// thanks to FransWillem
exports.intersections = function intersections(arrs,cmp) {
	var ret=[],
		offsets=arrs.map(function() { return 0; }),
		lowestIndex,highestIndex,
		lowest,highest,
		index,
		cur;
	//Copy each array and sort it
	arrs=arrs.map(function(a) { return a.slice(0).sort(cmp); });
	while (arrs.every(function(x,i) { return x.length>offsets[i]; })) {
		lowestIndex=highestIndex=0;
		lowest=highest=arrs[0][offsets[0]];
		for (index=1; index<arrs.length; index++) {
			cur=arrs[index][offsets[index]];
			if (cmp(cur,lowest)<0) {
				lowest=cur;
				lowestIndex=index;
			}
			if (cmp(cur,highest)>0) {
				highest=cur;
				highestIndex=index;
			}
		}
		if (lowestIndex===highestIndex) {
			ret.push(lowest);
			for (index=0; index<offsets.length; index++) {
				offsets[index]++;
			}
		} else {
			offsets[lowestIndex]++;
		}
	}
	return ret;
}
