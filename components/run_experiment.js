/**
 * schedule widgets to run. keep data in the same backend when in the same path.
 * runs in main thread
 */


var cached_widget_io = {}
var widget_io = {}

/**
 * get the input/output widget IDs of a widget. Memoized.
 * Cached cleared with every `schedule()` call.
 * @param {String} widget_id 
 * @returns `{in: ..., out: ...}`
 */
function get_io(widget_id, widget_list){
	if (widget_id in cached_widget_io && cached_widget_io[widget_id] != null){
		return cached_widget_io[widget_id];
	}
	let io = {in: [], out: []};
	for (let conn of Object.values(widget_list[widget_id].conns.in)){
		if ("target" in conn && conn.target != null && conn.target.length){
			io.in.push(conn.target[0])
		};
	}
	for (let conn of Object.values(widget_list[widget_id].conns.out)){
		if ("targets" in conn && conn.targets != null){
			io.out = io.out.concat(Object.keys(conn.targets));
		}
	}
	cached_widget_io[widget_id] = io;
	return io;
}

/**
 * generate a list of mods to run for each backend (if applicable).
 * topological sort basically.
 * @param {dict} widget_list
 * @param {*} options
 * 		* live_only (bool) = true
 * @returns list of mods to execute in order.
 */
function schedule(widget_list, options={}){
	cached_widget_io = {}
	let destinations = []; // list of IDs for output widgets
	for (let widget of Object.values(widget_list)){
		if (("output" in widget) && widget.output) destinations.push(widget.id);
	}
	// console.log("output widget IDs: ", destinations);
	let execute_order = [];

	let live_only = ("live_only" in options) ? options.live_only : true;


	// plan:
	// after finding all nodes marked as "outputs",
	// back-trace to find an input node, preserving the trace path to
	// know which widget to advance to when done
	// [if a node goes out to two nodes, only one of which reaches the output, ignore the other.]
	// then start the usual topological sort.
	// do this for every output, noting which will have cached with each sort
	// to avoid duplicate scheduling.

	for (let id of destinations){
		// DO NOT RUN EXPERIMENTS HERE.
		let this_backtrace = [{"id": id, "in": structuredClone(get_io(id, widget_list).in)}];
		// first element is output node, thereafter are nodes feeding in.

		let this_node;
		let this_node_in;
		while (this_backtrace.length){// if true, topo sort has not reached the output node.
			// two scenarios:
			// this node's input are all taken care of -> append this node to schedule & advance one.
			//		"taken care of" means all mandatory inputs have conns or have values
			// this node sill has unprocessed inputs, backtrack one.
			this_node = this_backtrace[this_backtrace.length-1].id;
			this_node_in = this_backtrace[this_backtrace.length-1].in;
			// console.log("this_node", this_node, "this_backtrace", this_backtrace);
			if (this_node_in.length){
				// still has unprocessed inputs: back-trace, note trace path.
				let backtrack_node = this_node_in[this_node_in.length-1];
				this_backtrace.push({"id": backtrack_node, "in": get_io(backtrack_node, widget_list).in});
				// console.log("----", this_backtrace.map(x=>x.id));
				continue;
			} else {
				// all incoming connections/inputs processed. advnace
				this_backtrace.pop();
				if (!execute_order.includes(this_node)) execute_order.push(this_node);
				if (this_backtrace.length) this_backtrace[this_backtrace.length-1].in.pop();
				// console.log("----", this_backtrace.map(x=>x.id));
				continue;
			}
		}
	}
	console.log("scheduled. returning results.")
	return execute_order;
}


/**
 * 
 * @param {list} run_schedule list of string IDs of the widget. e.g. ['riwn', 'fiwn', 'ciwo']
 * @param {dict} global_settings dict of global settings
 */
function run_widgets(run_schedule, global_settings={}){
	console.log("run widgets function")
}


module.exports.schedule = schedule;
module.exports.run_widgets = run_widgets;