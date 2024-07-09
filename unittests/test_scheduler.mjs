import * as run_exp from  "../components/run_exp.js"

function schedule_test(){
	/*
	graph:
	     |------------> E ----> J
			 |              v
	A -> B ------> D -> F ------> G
	     |--> C ---^    ^   I ----^
	             H -----|
	*/
	let widget_list1 = {
		'a': {id: 'a', conns: {in: {'i1': {target: []}},
			out: {'o1':{targets: {'b':[], 'e':[]}}}}},

		'b': {id: 'b', conns: {in: {'i1': {target: ['a']}},
			out: {'o1':{targets: {'c':[], 'd':[]}}}}},

		'c': {id: 'c', conns: {in: {'i1': {target: ['b']}},
			out: {'o1':{targets: {'d':[]}}}}},

		'd': {id: 'd', conns: {in: {'i1': {target: ['b']}, 'i2': {target: ['c']}},
			out: {'o1':{targets: {'f':[]}}}}},

		'e': {id: 'e', conns: {in: {'i1': {target: ['a']}},
			out: {'o1':{targets: {'f':[], 'j':[]}}}}},

		'f': {id: 'f', conns: {in: {'i1': {target: ['e']}, 'i2': {target: ['d']}, 'i3': {target: ['h']}},
			out: {'o1':{targets: {'g':[]}}}}},

		'g': {id: 'g', conns: {in: {'i1': {target: ['f']}, 'i2': {target: ['i']}},
			out: {'o1':{targets: {}}}}, output: true},

		'h': {id: 'h', conns: {in: {'i1': {target: []}},
			out: {'o1':{targets: {'f':[]}}}}},

		'i': {id: 'i', conns: {in: {'i1': {target: []}},
			out: {'o1':{targets: {'g':[]}}}}},

		'j': {id: 'j', conns: {in: {'i1': {target: ['e']}},
			out: {'o1':{targets: {}}}}, output: false}, //looks like an output but not.
	}
	let before_after1 = {// what can be scheduled before/after each widget.
		'a': [['h','i'],['b','c','d','e','f','g','h','i','j']],
		'b': [['a','e','h','i','j'],['c','d','e','f','g','j']],
		'c': [['a','b','e','h','i','j'],['d','e','f','g','h','i','j']],
		'd': [['a','b','c','e','h','i','j'],['e','f','g','h','i','j']],
		'e': [['a','b','c','d','h','i'],['b','c','d','f','g','h','i','j']],
		'f': [['a','b','c','d','e','h','i','j'],['g','i','j']],
		'g': [['a','b','c','d','e','f','h','i','j'],['j']],
		'h': [['a','b','c','d','e','i','j'],['a','b','c','d','e','f','g','i','j']],
		'i': [['a','b','c','d','e','f','h','j'],['a','b','c','d','e','f','g','h']],
	}
	let check = (widget_list, before_after) => {
		let err = 0;
		let queue = run_exp.schedule(widget_list, {live_only: false});
		for (let [k, v] of Object.entries(queue)){
			let predict_before = queue.slice(0, k);
			let predict_after = queue.slice(parseInt(k)+1, queue.length)
			for (let e of predict_before){
				if (!before_after[v][0].includes(e)) {
					err++;
					console.warn(`failed: widget=${v}, before_after: ${before_after[v]}, predict_before: ${predict_before}, predict_after: ${predict_after}`);
				}
			}
			for (let e of predict_after){
				if (!before_after[v][1].includes(e)) {
					err++;
					console.warn(`failed: widget=${v}, before_after: ${before_after[v]}, predict_before: ${predict_before}, predict_after: ${predict_after}`);
				}
			}
		}
		console.log(queue);
		console.log(`Queue ${err === 0 ? "OK" : "check failed. see above."}`);
	}
	check(widget_list1, before_after1);
	
}

schedule_test();