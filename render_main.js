// main render process
// @ author: Michael Fang


import * as witem from "./components/render_witem.js"
import * as utils from "./components/utils.js"
import * as panels from "./components/panels.js"
import * as main_panel from "./components/main_panel.js"
import * as overlay_menus from "./components/overlay_menus.js"

// change zeromq send/receive pattern?

// const HOVER_TEST = document.createElement("div");
// HOVER_TEST.innerText = 'loren ipsum';
// HOVER_TEST.className = "tooltip_element";	
// document.getElementById("tool_tips").appendChild(HOVER_TEST);


const root_style = getComputedStyle(document.documentElement);

// list of functions to run for a few window events.
// This is to make swapping out specific functions easier,
// when the same event requires different functions under different scenarios
window.onmousemove_listeners = {
	dragging: null,
	conn_request_evt: null,
	conn_request_tooltip: null,
	witem_mousemove: null,
	widget_resize: null,
}
window.onmouseup_listeners = {
	dragging: null,
	conn_request_evt: null,
	conn_request_tooltip: null,
	conn_request_clear: e => {
		svg_canvas_temp.conn_request = {from: [null, null], req: [null, null], to: [null, null]}
	},
	witem_mouseup: null,
	widget_resize: null,
}
window.onmousedown_listeners = {
	dragging: null,
	conn_request_evt: null,
	conn_request_tooltip: null,
}
window.onscroll_listeners = {
	overlay_menus_deactivate: e => overlay_menus_layer.deactivate(e),
}

for (let evt_type of ["onmousemove", "onmouseup", "onmousedown", "onscroll"]){
	window[evt_type] = (e) => {
		for (let handler of Object.values(window[evt_type + "_listeners"])){
			if (handler !== null) handler(e);
		}
	}
}


// a few backend reference jsons.
window.backend_refs = {}
for (let p in window.electronAPI.backend_refs){
	window.backend_refs[p] = await window.electronAPI.backend_refs[p].then(r => { return r; });
}
console.log("backend refs", window.backend_refs);

window.frontend_refs = {
	svg_logos: {
		drag_handle: () => {
			let logo = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			let e = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			e.setAttribute('d', "M3,3 8,3 8,8 3,8 Z M10,3 15,3 15,8 10,8Z M17,3 22,3 22,8 17,8Z\
				M3,10 8,10 8,15 3,15 Z M10,10 15,10 15,15 10,15Z M17,10 22,10 22,15 17,15Z M3,17 8,17 8,22 3,22 Z\
				M10,17 15,17 15,22 10,22Z M17,17 22,17 22,22 17,22Z");
			logo.appendChild(e);
			return logo;
		}
	},
}

// widget colors, etc.
const WSTYLES = window.backend_refs.wstyles;

/** converts numbers, string numbers with units, etc to appropriate dpi, maintaining formatting. */
function dpi(v, multiplier=window.devicePixelRatio){
	if (typeof multiplier !== "number") throw TypeError;
	if (v == null) return v;
	// check if a list.
	let iterable = (Symbol.iterator in Object(v) && (typeof v !== "string"));
	if (! iterable) v = [v];
	let returned = [];
	for (let item of v){
		if (typeof item === "number"){
			returned.push(item * multiplier);
		} else if (typeof item === "string"){
			let parsed = parseFloat(item);
			if (isNaN(parsed) || !isFinite(parsed))
				{returned.push(item); continue;}
			returned.push(
				String(parsed * multiplier)
				+ item.split(String(parsed)).splice(1).join(String(parsed))
			);
		} else {
			returned.push(item);
		}
	}
	return (iterable ? returned : returned[0]);
}

// async function widget_get_info(){
// 	// gets info for widget from backend by invoking a main.js function.
// 	let result = await window.electronAPI.widget_get_info().then(r=>{return r;});
// 	return result;
// }


// a few frequently used elements
/** the "drawing board"; where the widget elements live. The conn curves are separately on svg_canvas. */
const dboard = document.getElementById("drawing_board");
/** layer for panels */
const panels_layer = document.getElementById("panels_layer");
/** layer to draw all connected curves */
const svg_canvas = document.getElementById("svg_canvas");
svg_canvas.mouse_drag_curve = null;
/** layer for tooltips */
const tooltip_layer = document.getElementById("tool_tips");
tooltip_layer.typecheck = null;
/** layer to draw a temporary conn curve as the user drags a connection */
const svg_canvas_temp = document.getElementById("svg_canvas_temp");
svg_canvas_temp.valid_graph = null;
// ^^ var for checking whether graph is valid while user is click-dragging connections.
// the idea is to have the checker check once when mouse entering a connection point,
// and not have to check (which uses DFS) every time the mouse moves inside a connection point.
// this is cleared when mouse leaves the connection point element.

svg_canvas_temp.conn_request = {from: [null, null], req: [null, null], to: [null, null]}

/** layer for anything that need immediate attention and dismissable by clicking
 * empty regions or additionally specified in its activate() function */
const overlay_menus_layer = document.getElementById("overlay_menus");

/**
	blocks all other inputs but the one in the element,
	sets event-handling (re-enable other inputs) for when dismissing element.
	used when adding an element to the overlay_menus layer
	the element can be a context menu or anything that requires
	resolving before anything else continues.
 * @param {HTMLElement} element to insert/become active in the overlay_menus layer
 * @param {HTMLElement} leave_deactivate (optional) element where when the mouse leaves deactivates overlay_menus layer.
 */
overlay_menus_layer.activate = function(element, leave_deactivate=null){
	if (element.parentElement !== overlay_menus_layer){
		overlay_menus_layer.appendChild(element);
	}
	element.style.visibility = "visible";
	overlay_menus_layer.style.pointerEvents = "all";
	overlay_menus_layer.onclick = e => {
		if (e.target === overlay_menus_layer){
			overlay_menus_layer.deactivate(e);
		}
	};
	window.onkeydown = e => {
		if (e.key === "Escape"){
			overlay_menus_layer.deactivate(e);
		}
	}

	if (leave_deactivate !== null){
		for (let element of leave_deactivate){
			element.onmouseleave = e => {
				overlay_menus_layer.deactivate(e);
			}
		}
		
	}
	return;
}

overlay_menus_layer.deactivate = (e=null) => {
	for (let c of overlay_menus_layer.children){
		overlay_menus_layer.removeChild(c);
	}
	overlay_menus_layer.innerHTML = "";
	overlay_menus_layer.style.pointerEvents = "none";
}

//////////////////////////////////////////////////////////////////////////////////////////////////

/** list of all widgets for the GUI. Each entry is a dict containing info & the html element (`widget.html`) */
var widget_list = {};
//	"html": <html_widget>, "params": {}, "in": {}, "out": {},
//	"position": {"x": 0, "y": 0} <= position on canvas.
//	can't move the list to main.js: this contains html elements.

/** the top-left corner of the screen in the units and reference frame of dboard coords. */
var canvas_offset = { "x": -400, "y": 0 };

/** current zoom level */
window.canvas_zoom = 1;
var canvas_zoom_multiplier = 1.1; // mouse wheel sensitivity / zoom speed

function dboard_to_window(c){ // ok
	// converts dboard coordinates to window coordinates.
	return {
		"x": window.canvas_zoom * (c.x - canvas_offset.x),
		"y": window.canvas_zoom * (c.y - canvas_offset.y)
	};
}
function window_to_dboard(c){ // ok
	// converts window coordinates to dboard coordinates.
	return {
		"x": (c.x / window.canvas_zoom) + canvas_offset.x,
		"y": (c.y / window.canvas_zoom) + canvas_offset.y
	};
}

/**
 * This assumes all widgets are already in the widget list.
 * This is called every frame while the widget is being drag-moved
 * @param {dict} w an entry in widget_list. accessible with `widget_list[widget_string_id]`
 * @returns null
 */
function draw_canvas_widget(w){
	let win_coords = dboard_to_window(w.position);

	// widget styling
	let w_style = w.html.style;
	w_style.top = win_coords.y + "px";
	w_style.left = win_coords.x + "px";
	w_style.width = w.width + "px";
	// w_style.top = w.position.y / canvas_zoom + "px";
	// w_style.left = w.position.x / canvas_zoom + "px";

	// component styling
	let wc = w.html.components;
	wc.obj.style.borderColor = w.focused ? "#efefef" : (w.selected ? "#aa9292" : "#555555");
	wc.body.style.borderColor = w.focused ? "#efefef" : (w.selected ? "#aa9292" : "#555555");
	wc.title_bar.style.backgroundColor = w.title_bar_color;
	wc.obj.style.borderWidth = dpi("2px", 1/window.canvas_zoom);
	wc.body.style.borderWidth = dpi("2px", 1/window.canvas_zoom);

	w_style.transform = "scale(" + String(window.canvas_zoom) + "," + String(window.canvas_zoom) + ")";
	return;
}


function widgets_move_selected(event, selected_widgets, moved, options = null){
	// broken
	for (let w of Object.keys(selected_widgets)){
		if (!w.selected) continue;
		widget_move(event, selected_widgets[w], moved, options);
	}
}

/**
 * mouse drag-move a single widget.
 * @param {Event} event event emitted by mouse move. currently unused
 * @param {HTMLElement | dict} element 
 * @param {dict} moved must be like `{dx: <number>, dy: <number>}`
 * @param {*} options currently unused
 */
function widget_move(event, element, moved, options = null){
	widget_list[element.id].position.x += moved.dx / window.canvas_zoom;
	widget_list[element.id].position.y += moved.dy / window.canvas_zoom;
	draw_canvas_widget(widget_list[element.id]);
	draw_outgoing_connection_curves(widget_list[element.id], null, true, true, [moved, {dx: 0, dy: 0}]);
	// ^^ this will also update incoming connections.
}

/** secondary-click menu.
 * @param widget is an entry in widget_list */
function widget_context_menu(widget){
	let cmenu = witem.context_menu(widget.title, 
		{
			"Copy": e => console.log("Copy"),
			"Paste": e => console.log("Paste"),
			"Delete": e => console.log("Delete"),
			"Reset width": e => {widget_set_width(widget.html, 200, "right");},
			// "Rename": e => {}, // need to extract the rename function from create_widget
		}
	);
	return cmenu;
}

/** check if a widget or its in/out connection exists
 * @param {String}widget_id string id
 * @param {String}conn string of connection name
 * @param {String}ctype string of connection type
*/
function w_exists(widget_id=null, conn=null, ctype=null){
	
	if (widget_id === null) return false;
	if (!widget_id in widget_list) return false;
	if (conn === null && ctype === null) return true;
	if (conn !== null && ctype === null) throw Error("w_exists: connection type not specified.");
	else if (! ctype in ['in', 'out']) throw Error(`w_exists: unknown connection type "${ctype}"`)
	return (conn in widget_list[widget_id].conns[ctype]);
}

// MAKING CONNECTIONS ////////////////////////////////////////
/** returns true if graph is valid. checks for cycles with iterative (nonrecursive) DFS
 * @param {String}widget_id string id
 * @param {String}widget_id_to_check string id.
 * @returns `true` if valid, String for reason if invalid.
 */
function valid_graph(widget_id, widget_id_to_check){
	let this_path = [[widget_id]]; // nodes to process
	let this_path_widgets = this_path.map(x=>x[x.length-1]); // widgets along the current search path.

	// check for cycles with iterative DFS
	do {
		// console.log('dfs', this_path);
		this_path_widgets = this_path.map(x=>x[x.length-1]);
		if (!(this_path[this_path.length-1].length)){
			this_path.pop();
			this_path[this_path.length-1].pop();
			continue;
		}
		let next_widget = this_path[this_path.length-1]
			[this_path[this_path.length-1].length-1];
		let next_widgets = []
		for (let out of Object.values(widget_list[next_widget].conns.out)){
			if ("targets" in out && out.targets !== null){
				next_widgets = next_widgets.concat(Object.keys(out.targets));
			}
		}
		next_widgets = next_widgets.filter(x => x !== null);

		if (!next_widgets.length){
			this_path[this_path.length-1].pop();
			continue
		} else { // if there is a connection to new widgets, continue deeper.
			// WEE WOO WEE WOO THIS IS THE GRAPH CYCLE POLICE! PULL OVER IMMEDIATELY!
			if (next_widgets.includes(widget_id_to_check)) return "Cycles detected";
			this_path.push(next_widgets);
			continue;
		}
		// end DFS iteration
	} while (this_path.length > 1)
	return true
}

/** set tooltip hover element to show what data type each conn dot is associated with */
window.onmousemove_listeners.conn_request_tooltip = function(e){
	let conn_types = conn_req_get_types();
	let display_text;
	if (!conn_types){
		return;
	} else if (Object.keys(conn_types).length === 1){
		// only one end of connection known. display its type
		display_text = conn_types.from;
	} else if (Object.keys(conn_types).length === 2){
		// both ends of requested cnonection known. show whether matching
		display_text = `${conn_types.from} -> ${conn_types.to}`;
	} else throw Error("Wrong number of conn request elements while making connections.");
	if (svg_canvas_temp.valid_graph !== null && svg_canvas_temp.valid_graph !== true){// true or string.
		display_text = `Invalid connection.\n${svg_canvas_temp.valid_graph}`
	}
	if ((svg_canvas_temp.conn_request.from[0] || svg_canvas_temp.conn_request.req[0])
				=== (svg_canvas_temp.conn_request.to[0] || svg_canvas_temp.conn_request.req[0])){
			display_text = "Invalid connection.\nSelf connection."
		}
	if (tooltip_layer.typecheck === null){
		let tt_element = utils.create_tooltip(display_text);
		tooltip_layer.typecheck = tt_element;
		tooltip_layer.appendChild(tooltip_layer.typecheck);
	} else {
		// first clear everything using innerHTML, then set regular text with innerText
		tooltip_layer.typecheck.innerHTML = "";
		tooltip_layer.typecheck.innerText = display_text;
	}
	tooltip_layer.typecheck.style.top = e.clientY - tooltip_layer.typecheck.getBoundingClientRect().height * 1.5 + "px";
	tooltip_layer.typecheck.style.left = e.clientX - tooltip_layer.typecheck.getBoundingClientRect().width/2 + "px";
	return;
}

// remove the tooltip element created in window.onmousemove_listeners.conn_request_tooltip when mouse up.
window.onmouseup_listeners.conn_request_tooltip = e => {
	if (tooltip_layer.typecheck === null) return;
	tooltip_layer.removeChild(tooltip_layer.typecheck);
	tooltip_layer.typecheck = null;
	return;
}

// removes connection between two widgets and specified in/out conns
/** w1, w2, are widget ids, cout, cin are input/output names
 * @param {String}w1 - id of from-widget
 * @param {String}cout - outgoing connection name (in w1)
 * @param {String}w2 - id of to-widget
 * @param {String}cin - incoming connection name (in w2)
 * @param {Boolean}redraw
 */
function disconnect_widgets(w1, cout, w2, cin, redraw=false){
	console.log("disconnect_widgets()")
	let drag_curve = widget_list[w1].conns.out[cout].targets[w2][cin];
	// svg_canvas.removeChild(drag_curve);
	delete widget_list[w1].conns.out[cout].targets[w2][cin];
	if (Object.keys(widget_list[w1].conns.out[cout].targets[w2]).length === 0){
		delete widget_list[w1].conns.out[cout].targets[w2];
		if (Object.keys(widget_list[w1].conns.out[cout].targets).length === 0){
			widget_list["remove", w1].conns.out[cout].targets = null;
		}
	}
	widget_list[w2].conns.in[cin].target = null;
	draw_widget_connections(widget_list[w2], {draw_outgoing_connection_curves:false, set_reverse_link:false})
	// TOOD just draw the disconnected widgets
	if (redraw) draw_all_widgets();
	return drag_curve;
}
/**
used for `window.onmouseup_listeners.conn_request_evt`
when a connection is invalid or no connections is made while mouse up.
clean up and do nothing.
*/
function ignore_connection(evt){
	console.log("ignore_connection()")
	window.onmouseup_listeners.conn_request_evt = null;
	svg_canvas_temp.conn_request.from = [null, null];
	svg_canvas_temp.conn_request.to = [null, null];
	window.onmousemove_listeners.conn_request_evt = null;
	if (svg_canvas_temp.contains(svg_canvas_temp.mouse_drag_curve)) svg_canvas_temp.removeChild(svg_canvas_temp.mouse_drag_curve);
	if (svg_canvas_temp.mouse_drag_curve !== null) svg_canvas_temp.mouse_drag_curve = null;
		
	svg_canvas_temp.conn_request.req = [null, null]
}

/**
 * make a connection when the user drags a curve from a conn dot to another.
 * triggered when connection is valid while mouse up
 * calls valid_graph() to check.
 * @param {dict} evt 
 * @returns 
 */
function make_connection(evt){
	// console.log("make_connection()")
	window.onmouseup_listeners.conn_request_evt = null;
	window.onmousemove_listeners.conn_request_evt = null;
	if (svg_canvas_temp.contains(svg_canvas_temp.mouse_drag_curve)) svg_canvas_temp.removeChild(svg_canvas_temp.mouse_drag_curve);
	if (svg_canvas_temp.mouse_drag_curve !== null) svg_canvas_temp.mouse_drag_curve = null;

	let conn_from, conn_to;
	if (!svg_canvas_temp.conn_request.req.includes(null) &&
				(!svg_canvas_temp.conn_request.from.includes(null) ||
				!svg_canvas_temp.conn_request.to.includes(null))){
		if (!svg_canvas_temp.conn_request.from.includes(null)){
			conn_from = svg_canvas_temp.conn_request.from;
			conn_to = svg_canvas_temp.conn_request.req;
		} else {
			conn_from = svg_canvas_temp.conn_request.req;
			conn_to = svg_canvas_temp.conn_request.to;
		}
	} else return;
	let [from_widget, from_cname] = conn_from;
	let [to_widget, to_cname] = conn_to;

	// svg_canvas_temp.style.pointerEvents = 'none';
	dboard.style.pointerEvents = 'all';
	svg_canvas_temp.conn_request.from = [null, null];
	svg_canvas_temp.conn_request.to = [null, null];
	svg_canvas_temp.conn_request.req = [null, null];
	// mouse drop check:
	// same output can have multiple connections, but can't be the same input of same widget.
	// can't connect widget to itself
	if (from_widget === to_widget) return;
	// can't duplicate already existing connection
	if ("targets" in widget_list[from_widget].conns.out[from_cname] &&
		widget_list[from_widget].conns.out[from_cname].targets !== null &&
		to_widget in widget_list[from_widget].conns.out[from_cname].targets &&
		widget_list[from_widget].conns.out[from_cname].targets[to_widget] !== null &&
		widget_list[from_widget].conns.out[from_cname].targets[to_widget][to_cname]) return;
	// can't have cycles
	let valid = valid_graph(to_widget, from_widget);
	if (valid !== true){// don't change, read below
		// ^^ This is because valid may be a string indicating why graph is not valid.
		console.log(`invalid connection. ${valid}`)
		return;
	}

	// perform connections here.

	// fill the outgoing slot in widget.conns of from_wiget
	let from_widget_obj = widget_list[from_widget];
	if ((!("targets" in from_widget_obj.conns.out[from_cname])) ||
			from_widget_obj.conns.out[from_cname].targets === null){
		from_widget_obj.conns.out[from_cname].targets = {
			[to_widget]: {[to_cname]: null}
		}
	// } else if (!"targets" in from_widget_obj.conns.out[from_cname]){
	// 	from_widget_obj.conns.out[from_cname].targets = {[to_widget]: {[to_cname]: null}}
	} else if (!(to_widget in from_widget_obj.conns.out[from_cname].targets)){
		from_widget_obj.conns.out[from_cname].targets[to_widget] = {[to_cname]: null}
	} else {
		from_widget_obj.conns.out[from_cname].targets[to_widget][to_cname] = null;
	}
	// fill the incoming slot in widget.conns of to_widget
	let to_widget_obj = widget_list[to_widget];
	let old_from_widget, old_from_cname;
	if (("target" in to_widget_obj.conns.in[to_cname]) &&
			to_widget_obj.conns.in[to_cname].target !== null){
		[old_from_widget, old_from_cname] = to_widget_obj.conns.in[to_cname].target;
		if (old_from_widget !== null && old_from_cname !== null){
			// if another incoming connection is already at this input dot,
			// remove the other connection (here) and replace with this connection (below).
			let curve_remove = widget_list[old_from_widget].conns.out[old_from_cname].targets[to_widget][to_cname];
			if (curve_remove !== null && svg_canvas.contains(curve_remove)) svg_canvas.removeChild(curve_remove);
			disconnect_widgets(old_from_widget, old_from_cname, to_widget, to_cname, false);
		} else if (old_from_widget === null && old_from_cname === null){
			//pass
		} else {
			throw Error(`Incomplete specification for an incoming connection to ${to_widget_obj.id}`);
		}
	}
	to_widget_obj.conns.in[to_cname].target = [from_widget, from_cname];
	draw_widget_connections(from_widget_obj, {set_reverse_link: false});
	draw_widget_connections(to_widget_obj, {draw_outgoing_connection_curves: false, set_reverse_link: false});
	draw_outgoing_connection_curves(to_widget_obj, null, true);
	if (from_widget_obj != null) draw_outgoing_connection_curves(from_widget_obj);
}

/** performs type checking while dragging a conn from one dot to hover on the other. */
function conn_req_get_types(){
	if (svg_canvas_temp.conn_request.req.includes(null)){
		// when not making a connection, just hovering over a dot.
		let conn_type;
		if (!svg_canvas_temp.conn_request.from.includes(null)){
			conn_type = widget_list[svg_canvas_temp.conn_request.from[0]]
				.conns.out[svg_canvas_temp.conn_request.from[1]].dtype;
		} else if (!svg_canvas_temp.conn_request.to.includes(null)){
			conn_type = widget_list[svg_canvas_temp.conn_request.to[0]]
				.conns.in[svg_canvas_temp.conn_request.to[1]].dtype;
		} else return 0;
		return {from: conn_type};
	}

	let from_widget, from_cname, to_widget, to_cname;
	if (!(svg_canvas_temp.conn_request.from.includes(null))){
		[from_widget, from_cname] = svg_canvas_temp.conn_request.from;
		[to_widget, to_cname] = svg_canvas_temp.conn_request.req;
	} else if (!(svg_canvas_temp.conn_request.to.includes(null))){
		[from_widget, from_cname] = svg_canvas_temp.conn_request.req;
		[to_widget, to_cname] = svg_canvas_temp.conn_request.to;
	} else {
		throw Error(`svg_canvas_temp.conn_request is broken while dragging connection.\
		Two of them must not contain nulls and the third must be nulls. Got this abomination:\
		${Object.values(svg_canvas_temp.conn_request)}`);
	}
	let from_type = widget_list[from_widget].conns.out[from_cname].dtype;
	let to_type = widget_list[to_widget].conns.in[to_cname].dtype;
	return {from: from_type, to: to_type};
}

/**
 * specifies what happens when the user click-drags from a conn dot from start to finish:
 * calls functions to show conn types, check validity if applicable, draw curvesf, etc.
 * @param {dict} widget is an entry in widget_list
 * @param {HTMLElement} c connection dot element
 * @param {String} cname connection name
 */
function conn_request(widget, c, cname){
	let conn_dot_onmouseenter = (e=null) => {
		// this function is saved to a variable
		// because it may need to be swapped out of the actual onmouseenter event,
		// since not every onmouseenter event needs to be reacted to.

		// not making connection
		if (svg_canvas_temp.conn_request.from.includes(null) &&
				svg_canvas_temp.conn_request.to.includes(null)){
			window.onmousemove_listeners.conn_request_evt = null;
			return;
		}

		// both dots are outputs or both inputs, ignore
		if (c.classList.contains("wconn_out") && !svg_canvas_temp.conn_request.from.includes(null) ||
				c.classList.contains("wconn_in") && !svg_canvas_temp.conn_request.to.includes(null)){
			window.onmouseup_listeners.conn_request_evt = e => ignore_connection(e);
			return;
		}
		
		// prepare to make connection if possibly valid.
		svg_canvas_temp.conn_request.req = [widget.id, cname];
		window.onmouseup_listeners.conn_request_evt = e => make_connection(e);

		if (svg_canvas_temp.valid_graph === null){
			svg_canvas_temp.valid_graph = valid_graph(
				(svg_canvas_temp.conn_request.to[0] || svg_canvas_temp.conn_request.req[0]),
				(svg_canvas_temp.conn_request.from[0] || svg_canvas_temp.conn_request.req[0])
			)
		}

		// check if same widget.
		if (svg_canvas_temp.conn_request.to[0] === svg_canvas_temp.conn_request.req[0] || 
				svg_canvas_temp.conn_request.from[0] === svg_canvas_temp.conn_request.req[0]) return;

		// check data types
	}

	c.onmouseenter = e => conn_dot_onmouseenter(e);

	c.onmouseleave = (e) => {
		if (svg_canvas_temp.conn_request.from.includes(null) &&
				svg_canvas_temp.conn_request.to.includes(null)) return;
		svg_canvas_temp.conn_request.req = [null, null];
		svg_canvas_temp.valid_graph = null
	}

	c.onmousedown = (event) => {
		// what happens when user presses mouse button on a conn dot.
		if (event.button === 0 && !event.ctrlKey && !event.shiftKey && !event.altKey){
			window.onmouseup_listeners.conn_request_evt = e => ignore_connection(e);
			if (c.classList.contains("wconn_out")){
				svg_canvas_temp.conn_request.from = [widget.id, cname]
				svg_canvas_temp.conn_request.to = [null, null]
			} else if ("target" in widget.conns.in[cname] && widget.conns.in[cname].target !== null){
				svg_canvas_temp.conn_request.from = widget.conns.in[cname].target;
				svg_canvas_temp.conn_request.to = [null, null];
				svg_canvas_temp.conn_request.req = [widget.id, cname];
				// if trying to disconnect, but mouse havent left the conn dot element,
				// treat as if the mouse was dragged from the output to the input.
				conn_dot_onmouseenter(event);
				let drag_curve = disconnect_widgets(...widget.conns.in[cname].target, widget.id, cname);

				// since mouse hasn't moved, no curve was drawn.
				// In other cases this would be fine bc curve would be 0 length anyway.
				// But here there's an existing connection. Need to draw the non-0-length curve.
				// let rect = widget_list[svg_canvas_temp.conn_request.from[0]]
				// 		.conns.out[svg_canvas_temp.conn_request.from[1]].element.getBoundingClientRect();
				// let out_xy = {x: rect.x + rect.width/2, y: rect.y + rect.height/2};
				// let in_xy = {x: event.clientX, y: event.clientY};
				// let drag_curve = utils.draw_connection_svg(
				// 	out_xy, in_xy,
				// 	window.canvas_zoom,
				// 	svg_canvas_temp.mouse_drag_curve
				// );

				drag_curve.style.pointerEvents = 'none';
				svg_canvas_temp.mouse_drag_curve = drag_curve;
				svg_canvas_temp.appendChild(svg_canvas_temp.mouse_drag_curve);
				// svg_canvas_temp.appendChild(svg_canvas_temp.mouse_drag_curve)
			} else {
				svg_canvas_temp.conn_request.to = [widget.id, cname];
				svg_canvas_temp.conn_request.from = [null, null]
			}
			// this is a hack >:(
			// consequence is that you can't move the dboard when you are
			// mid-drag while creating a connection. Arguably a UX loss
			// dboard.style.pointerEvents = 'none';
			// svg_canvas_temp.style.pointerEvents = 'none';
			event.preventDefault(); // prevents text selection while making conns.
			event.stopPropagation(); // prevents widgets from being moved while making conns.

			window.onmousemove_listeners.conn_request_evt = (e) => {
				// when moving mouse after pressing down main mouse button,
				// start drawing the conn curve
				let out_xy; // point to draw curve FROM.
				let in_xy;
				let rect;
				if (svg_canvas_temp.conn_request.from.includes(null) &&
							!svg_canvas_temp.conn_request.to.includes(null)){
					// mouse to input
					rect = widget_list[svg_canvas_temp.conn_request.to[0]]
						.conns.in[svg_canvas_temp.conn_request.to[1]].element.getBoundingClientRect();
					in_xy = {x: rect.x + rect.width/2, y: rect.y + rect.height/2};
					out_xy = {x: e.clientX, y: e.clientY};
				} else if (!svg_canvas_temp.conn_request.from.includes(null) &&
						svg_canvas_temp.conn_request.to.includes(null)){
					// output to mouse
					rect = widget_list[svg_canvas_temp.conn_request.from[0]]
						.conns.out[svg_canvas_temp.conn_request.from[1]].element.getBoundingClientRect();
					out_xy = {x: rect.x + rect.width/2, y: rect.y + rect.height/2};
					in_xy = {x: e.clientX, y: e.clientY};
				} else return;

				let drag_curve = utils.draw_connection_svg(
					out_xy, in_xy,
					window.canvas_zoom,
					svg_canvas_temp.mouse_drag_curve
				);
				drag_curve.style.pointerEvents = 'none';
				svg_canvas_temp.mouse_drag_curve = drag_curve;
				svg_canvas_temp.appendChild(svg_canvas_temp.mouse_drag_curve)
			}
			// window.onmouseup_listeners.conn_request_evt = null;
			// window.onmouseup_listeners.conn_request_tooltip = null;
		}
	}
}


// ADD/CREATE/UPDATE WIDGET ELEMENT /////////////////////////////////////////////////
/** returns if two widget input/outputs are the same.
 * mostly uses duck typing.
 * checks for data types, names, input types. (e.g. OptionMenu, Slider, etc.)
 * @param {dict} conn1
 * @param {dict} conn2
 * The two inputs are dicts that contain "dtype" (data type), and if input, also "type" (input type, e.g. slider).
 * @returns boolean
 */
let same_conn = (conn1, conn2) => {
	if (("type" in conn1 && conn1.type != null) &&
	("type" in conn2 && conn2.type != null) && conn1.type !== conn2.type){
		if (conn1.type.toLowerCase() !== "optionmenu" && conn1.type.toLowerCase() !== "optionmenu") return false;
	}
	if (("dtype" in conn1 && conn1.dtype != null) &&
	("dtype" in conn2 && conn2.dtype != null) && conn1.dtype !== conn2.dtype) return false;
	return true;
}
/**
 * small helper function called by `draw_widget_connections`
 * to update connections when input/output change.
 * Disconnects where in/out no longer available or change type.
 * 
 * Arguments are the same as `draw_widget_connections`.
 */
let update_widget_connections = async (widget, options={
		draw_outgoing_connection_curves: true,
		set_reverse_link: true,
	}, updated_params) => {
	// if param needs update, need to first transmit changed params to backend
	// becuase that's when the backend in_out will be updated.
	// the backend doesn't have to remember the change because
	// all module params will be sent at experiment-time.
	if (updated_params != null){
		await window.electronAPI.widget_set_params(
			{widget_list: updated_params}
		);
	}
	let updated_in_out = await window.electronAPI.widget_update_in_out(
		[{backend: widget.backend, id: widget.id}]
	);
	let new_io = updated_in_out.content[widget.id].in_out;
	let old_io = widget_list[widget.id].conns;

	// check if any io needs to be deleted. Compare old IOs with new ones.
	// widget output config will be a bit more rigid than inputs.
	for (let [cname, c] of Object.entries(old_io.out)){
		// don't have to worry about io type.
		if ((cname in new_io.out) && same_conn(new_io.out[cname], c)){
			new_io.out[cname].targets = ("targets" in c) ? c.targets : null; // persist connections if conn unchanged
		} else if (("targets" in c) && c.targets != null) {
			// if the conn is removed but there are outgoing connections, remove all those connections.
			for (let in_widget of Object.keys(c.targets)){
				for (let in_conn of Object.keys(c.targets[in_widget])){
					disconnect_widgets(widget.id, cname, in_widget, in_conn);
				}
			}
		}
	}
	widget_list[widget.id].conns.out = new_io.out;

	for (let [cname, c] of Object.entries(old_io.in)){
		// if there is an incoming connection, disconnect if conn changed.
		if ((cname in new_io.in) && same_conn(new_io.in[cname], c)){
			new_io.in[cname].value = c.value;
			new_io.in[cname].target = ("target" in c) ? c.target : null;
		} else if (("target" in c) && c.target != null) {
			disconnect_widgets(c.target[0], c.target[1], widget.id, cname);
		}
	}
	widget_list[widget.id].conns.in = new_io.in;

	draw_widget_connections(widget, {
		draw_outgoing_connection_curves: true,
		set_reverse_link: true
	});
}

/**
 * draws the input/output "dot" symbols of a widget, add or update connections.
 * re-drawing connection curves with draw_outgoing_connection_curves().
 * adjusts resize handles
 * 
 * calls:
 * * `update_widget_connections()` if widget IO changed
 * * * `draw_widget_connections()` (this)
 * * `draw_outgoing_connection_curves()` if applicable.
 * 
 * @param {object} widget is an entry in widget_list
 * @param {dict} options
 * 		* {bool} `draw_outgoing_connection_curves`
 * 		* {bool} `set_reverse_link` whether to add .targets to a receiving widget's conns dict |
 * if an outgoing link exists.
 */
function draw_widget_connections(widget, options={
		draw_outgoing_connection_curves: true,
		set_reverse_link: true,
	}){

	// widget is an entry in widget_list
	// create connection points
	// called when creating widgets/widget IO change in response to param change
	if (widget === undefined){throw Error("No widget specified.");}

	widget.html.components.entries.innerHTML = '';
	// ^^ i'm sure this will come back and bite my ass later
	// (clear in/out dots by setting innerHTML)

	// output nodes first, then input.

	// list of conns must draw from the specific widget (dynamic),
	// because conns may be different from static in/out types.


	for (let c of Object.keys(widget.conns.out)){
		let conn_info = widget.conns.out[c];
		let entry = document.createElement("div");
		entry.className = "widget_item_entry";
		let conn_dot = witem.wconn("wconn_out", conn_info.dtype);
		// ^^ element the user clicks on/drags to set a new connection
		conn_request(widget, conn_dot, c);
		entry.appendChild(conn_dot);
		entry.appendChild(witem.wtextlabel(c, "wconn_out"));
		widget.html.components.entries.appendChild(entry);
		conn_info.element = conn_dot;

		if (!options.set_reverse_link) continue;

		// set reverse link of connected widgets
		if (conn_info.targets == null) continue;
		// reference: conn_info.targets = {
		// out going connections, their target widgets, and target inputs.
		// 		<widget1_id>: [widget1_input1, widget1_input2, ...], <-- list is "in_conn" in the loop below
		//		<widget2_id>: [widget2_input1, ...], ...
		// }
		for (let t_widget of Object.keys(conn_info.targets)){
			if (!t_widget in widget_list){
				// "target" is expected to be an ID string
				throw Error(`Connected widget not found.\\
				Connection: ${widget.id} (this widget) <-> ${t_widget}`);
			}
			for (let in_conn of Object.keys(conn_info.targets[t_widget])){
				// for each input of the target widget connected to this widget's this output
				if (!in_conn in widget_list[t_widget].conns.in){
					throw Error(`Connected widget (${t_target}) has no such input or parameter: ${in_conn}`);
				}
				// Here both the widget and its target input are verified for an outgoing connection.
				widget_list[t_widget].conns.in[in_conn].target = [widget.id, c]
			}	
		}
	}
	// in
	for (let c of Object.keys(widget.conns.in)){
		let conn_info = widget.conns.in[c];
		let displayed_name = ("displayed_name" in conn_info && conn_info.displayed_name != null) ?
			conn_info.displayed_name : c;
		let entry = document.createElement("div");
		entry.className = "widget_item_entry";
		if ("show" in conn_info && !conn_info.show) continue;

		if (!("type" in conn_info)){} // ignore if no specified type for widget
		else if (conn_info.type !== null && "optionmenu".includes(conn_info.type.toLowerCase())){} // if optionmenu, ignore.
		else {
			let conn_dot = witem.wconn("wconn_in", conn_info.dtype);
			// ^^ element the user clicks on/drags to set a new connection
			conn_request(widget, conn_dot, c);
			entry.appendChild(conn_dot);
			conn_info.element = conn_dot;
		}
		///////////////
		// deal with python negative indexing
		if ("default" in conn_info && conn_info.default !== null &&
				"options" in conn_info && conn_info.options !== null && conn_info.default < 0
			){
			conn_info.default = conn_info.options.length + conn_info.default;
		}

		// create different types of inputs
		// if ((!("options" in conn_info) || !("default" in conn_info))){
		if ((!("type" in conn_info) && !("options" in conn_info)) || ("type" in conn_info && conn_info.type === null)){
			let element = witem.wtextlabel(displayed_name, "wconn_in");
			element.value = null;
			conn_info.value = null;
			entry.appendChild(element);
			
		} else if ((!("type" in conn_info)) || ("optionmenu".includes(conn_info.type.toLowerCase()))){
		// OPTION MENU
			let default_option = (("value" in conn_info && conn_info.value != null) ? conn_info.value : conn_info.options[conn_info.default]);
			let optionmenu_element = witem.wcoptions(displayed_name, conn_info.options, default_option);
			entry.appendChild(optionmenu_element);
			optionmenu_element.addEventListener("input", async (e) => {
				conn_info.value = optionmenu_element.velement.value;
				if ("update" in conn_info && conn_info.update){
					// needs update
					let updated_params = {
						[widget.id]: {
							id: widget.id,
							backend: widget.backend,
							params: {[c]: {
								dtype: ("dtype" in conn_info ? conn_info.dtype : "str"),
								value: conn_info.value
							}}
						}
					};
					// this below will call this function again, so return after bc conns will have been updated.
					await update_widget_connections(widget, {
						draw_outgoing_connection_curves: options.draw_outgoing_connection_curves,
						set_reverse_link: options.draw_outgoing_connection_curves,
					}, updated_params)
					return; // after updating, stop this call and re-execute this function (above)
				}
			});
			conn_info.value = default_option;
		} else if ("target" in conn_info && conn_info.target !== null){
		// TEXT LABEL
			let text_label_element = witem.wtextlabel(displayed_name, "wconn_in");
			entry.appendChild(text_label_element);
			// text label's velement is null. don't need its value.
			conn_info.value = null;
		} else if (conn_info.type.toLowerCase() === "slider"){
		// SLIDER
			conn_info.dtype = "float/int"; // guess dtype from widget type
			let resolution = (("resolution" in conn_info && conn_info.resolution != null) ? conn_info.resolution : 1)
			let set_value = (("value" in conn_info && conn_info.value != null) ? conn_info.value :
				conn_info.options[0] + resolution * conn_info.default
			)
			let slider_element = witem.wslider(
				displayed_name, conn_info.options[0], conn_info.options[conn_info.options.length-1],
				set_value, resolution, (("free_slide" in conn_info) ? conn_info.free_slide : false)
			);
			entry.appendChild(slider_element);
			slider_element.addEventListener("input", e => conn_info.value = slider_element.velement.value);
			conn_info.value = set_value;
		} else if ("tick_check".includes(conn_info.type.toLowerCase())){
		// CHECKBOX
			let default_state = (("value" in conn_info && conn_info.value != null) ?
				conn_info.value : (("default" in conn_info ? conn_info.options[conn_info.default] : false)));
			conn_info.dtype = "bool"; // guess dtype from widget type
			let checkbox_element = witem.checkbox(displayed_name, ("value" in conn_info ? conn_info.value : false));
			entry.appendChild(checkbox_element);
			checkbox_element.oninput = e => conn_info.value = checkbox_element.checkbox.checked;
			checkbox_element.value = default_state;
			checkbox_element.addEventListener("input", e => conn_info.value = checkbox_element.velement.checked);
			conn_info.value = default_state;
		} else if (conn_info.type.toLowerCase() === "text"){
			// entry.style.height = "var(--widget_textentry_height)";
			// entry.style.height = "calc(0.9 * var(--widget_textentry_height))";
			entry.style.height = "auto";
			let text_entry_element = witem.wtextentry(
				(("displayed_name" in conn_info && conn_info.displayed_name != null) ?
				conn_info.displayed_name : c), // input displayed name
				("value" in conn_info && conn_info.value != null) ?
				conn_info.value : (
					("default" in conn_info && conn_info.default != null) ?
					conn_info.default : "Right click to edit"
				));
			entry.appendChild(text_entry_element);
			text_entry_element.addEventListener("input", e => conn_info.value = text_entry_element.velement.value);
			conn_info.value = text_entry_element.velement.value;
		} else {
		// UNKNOWN. use text label
			let text_label_element = witem.wtextlabel(c, "wconn_in");
			entry.appendChild(text_label_element);
			text_label_element.value = null;
		}
		widget.html.components.entries.appendChild(entry);
	}

	if (options.draw_outgoing_connection_curves){
		draw_outgoing_connection_curves(widget);
	}

	// code to reconnect conns after param change.
}



/**
 * draws the curves of outgoing connections.

 ** verifies that no 2 connections are routed to the same input of the same widget.
 ** if out_attributes is null, re-draw all outgoing connections;
 ** if out_attributes not null, re-draw only those specified in out_attributes.

 * @param {dict} widget 
 * @param {String[]} out_attributes
 * 		null when "widget" is the element being dragged,
 * 		not null when this function is called but "widget" is not the one being dragged,
 * 		but one with an out-going connection to the widget being dragged.
 * 		this is to avoid updating all outgoing connection curves when not necessary.
 * @param {Boolean} incoming if true, call self on widgets with incoming connections.
 * won't propagate further (i.e. the self-call will set this to false)
 * set to false when needs to update all widgets to avoid duplicate calls.
 * @param {boolean} place whether to simply modify the curve attribute.
 * 	true: cheap, when moving widgets; false: expensive: widget needs to be redrawn, calls boundingClient Rect()
 * @param {dict} moved form `{dx: <number>, dy: <number>}`
 * @param {String[]} moved_out_target when a widget's output has multiple destinations, only update the connection for
 * target widgets with these IDs.
 * @returns 
 */
function draw_outgoing_connection_curves(widget, out_attributes=null, incoming=true, place=false, moved=null, move_out_target=null){
	if (place && (moved === null)) throw new Error("when using place, must specify `moved`")
	// should work fine with updating connections while moving multiple widgets
	let drawing_attributes;
	if (out_attributes === null || !out_attributes.length) drawing_attributes = widget.conns.out;
	else drawing_attributes = out_attributes.map(out => widget.conns.out[out]);
	for (let conn_info of Object.values(drawing_attributes)){
		// for each attribute to draw curves
		// if there are no out-connections (empty "targets"), skip.
		if ((!("targets" in conn_info)) || conn_info.targets == null || conn_info.targets.length === 0){
			conn_info.targets = null;
			continue;
		}
		for (let t_widget of Object.keys(conn_info.targets)){
			// for each entry in "targets".
			// targets: {<widget1_id>: [conn1, conn2, ...], <widget2_id>: [...], ...}
			if (!w_exists(t_widget)) throw Error(`Connected widget does not exist: ${t_widget}`);
			let connected_attrs = {}; // tracks already connected inputs, error on duplicates
			for (let t_conn of Object.keys(conn_info.targets[t_widget])){
				// for each connection to some target widget
				if (move_out_target !== null && !move_out_target.includes(t_widget)) continue;
				if (connected_attrs[t_conn]){
					throw Error(`Can't route two connections to the same widget input: ${t_widget}.${t_conn}`);
				} else if (!w_exists(t_widget, t_conn, "in")){
					throw Error(`Widget input does not exist: ${t_widget}.${t_conn}`)
				}
				connected_attrs[t_conn] = true;
				if (place){//place
					let curve_move = conn_info.targets[t_widget][t_conn];
					let [cpoint, cline] = utils.compute_conn_svg(
						{x: curve_move.curve_points[0].x + moved[0].dx,
							y: curve_move.curve_points[0].y + moved[0].dy},
						{x: curve_move.curve_points[4].x + moved[1].dx,
							y: curve_move.curve_points[4].y + moved[1].dy},
						window.canvas_zoom,
					)
					conn_info.targets[t_widget][t_conn].setAttribute('d', cline);
					conn_info.targets[t_widget][t_conn].curve_points = cpoint;
				} else {
					let out_rect = conn_info.element.getBoundingClientRect();
					let in_rect = widget_list[t_widget]
						.conns.in[t_conn].element.getBoundingClientRect()
	
					let curve = utils.draw_connection_svg(
						{x: out_rect.x + out_rect.width/2, y: out_rect.y + out_rect.height/2},
						{x: in_rect.x + in_rect.width/2, y: in_rect.y + in_rect.height/2},
						window.canvas_zoom,
						conn_info.targets[t_widget][t_conn]
					);
					conn_info.targets[t_widget][t_conn] = curve;
					svg_canvas.appendChild(curve);
				}
				
			}
		}
	}
	if (incoming){
		// now update in-coming connection curves by calling this function
		// on the widget with out-going connections to this widget.

		// first get the list of widgets and their outputs that connect to inputs of this widget,
		// using dicts and sets to avoid duplication.

		let in_widgets = incoming_widgets(widget);
		// now update.
		for (let w of Object.keys(in_widgets)){
			if (place){
				draw_outgoing_connection_curves(widget_list[w],
					widget_list[w].conns.out[in_widgets[w]], false, true, [{dx: 0, dy: 0}, moved[0]], [widget.id]);
			} else {
				draw_outgoing_connection_curves(widget_list[w],
					widget_list[w].conns.out[in_widgets[w]], false);
			}
		}
	}
	return;
}

function incoming_widgets(widget){
	let in_widgets = {};// {widdget1: [out_name1, out_name2, ...], widget2: [...], ...}
	for (let conn_info of Object.values(widget.conns.in)){
		if (!("target" in conn_info) || conn_info.target === null) continue;
		if (!(conn_info.target[0] in in_widgets)) in_widgets[conn_info.target[0]] = new Set();
		in_widgets[conn_info.target[0]].add(conn_info.target[1]);
	}
	return in_widgets;
}

////////////////////////////////////////////////////////////////////////////////////
// a few debug vars to test in console
document.debug = {};
document.debug.draw_widget_connections = draw_widget_connections;
document.debug.draw_connection_svg = utils.draw_connection_svg;
document.debug.widget_list = widget_list;
document.debug.svg_canvas_temp = svg_canvas_temp;
document.debug.add_curve = (x1, y1, x2, y2) => {
	document.getElementById("svg_canvas").appendChild(
		utils.draw_connection_svg({x: x1, y: y1}, {x: x2, y: y2}, window.canvas_zoom)
	);
}
document.debug.draw = () => {draw_all_widgets("redraw");}
document.debug.offset = (x, y) => {canvas_offset = {x: x, y: y}; draw_all_widgets("redraw");}
// window.onmousedown = (e) => {console.log(e.clientX, e.clientY)}
////////////////////////////////////////////////////////////////////////////////////

function widget_set_width(widget, req_width, side){
	if (req_width < window.backend_refs.gui_params.widget.width_min) return;
	let moved = {dx: (req_width - widget_list[widget.id].width) * window.canvas_zoom, dy: 0}
	widget_list[widget.id].width = req_width;
	widget.style.width = req_width + "px";
	draw_canvas_widget(widget_list[widget.id]);
	if (side === "left"){
		let in_widgets = incoming_widgets(widget_list[widget.id]);
		for (let w of Object.keys(in_widgets)){
			draw_outgoing_connection_curves(widget_list[w], null, false, true, [{dx: 0, dy: 0}, {dx: -moved.dx, dy: -moved.dy}], [widget.id]);
		}
	} else if (side === "right"){
		draw_outgoing_connection_curves(widget_list[widget.id], null, false, true, [moved, {dx: 0, dy: 0}]);
	}
	return;
}
/**
 * attach a zoom-compensated resizing function to widgets,
 * called when mouse dragging on left/right edge of widgets.
 * This does not call `utils.dragging()` because this needs to adjust for zoom levels.
 * @param {HTMLElement} widget the top-level widget element. ie the direct child element of dboard
 * @param {HTMLElement} resizer the resizing handle
 * @param {HTMLElement} side "left" or "right". specifies which handle.
 */
function widget_resize(widget, resizer, side){
	resizer.onmousedown = e => {
		if (e.button !== 0 || utils.any_mod_keys(e)) return;
		e.preventDefault();
		document.body.style.cursor = "ew-resize";
		window.onmousemove_listeners.widget_resize = e => {
			e.preventDefault();
			// when moving, need to compensate for zoom levels,
			// widget position if dragging on left side,
			// and redraw connections

			// here, widths, mouse position, and widget position are in dboard units.
			// because the width of WIDGETS are specified in dboard units in the stylesheet.
			// canvas zoom is applied using css scale transform.
			let mouse_pos = window_to_dboard({x: e.clientX, y: e.clientY});
			let widget_pos = widget_list[widget.id].position;
			let widget_width = widget_list[widget.id].width; // widget with before resizing
			let req_width = 0;
			if (side === "left"){
				req_width = widget_width + widget_pos.x - mouse_pos.x;
				if (req_width < window.backend_refs.gui_params.widget.width_min) return;
				// extra step: move the widget in the same direction as the mouse movement.
				// if new width is more than original width, move left, else move right.
				widget_list[widget.id].position.x -= (req_width - widget_width);
			} else if (side === "right"){
				req_width = mouse_pos.x - widget_pos.x;
				if (req_width < window.backend_refs.gui_params.widget.width_min) return;
			}
			widget_set_width(widget, req_width, side);
		}
	}
	window.onmouseup_listeners.widget_resize = e => {
		document.body.style.cursor = "auto";
		resizer.onmouseup = null;
		window.onmousemove_listeners.widget_resize = null;
	}
}

/**
 * creates the HTML element for a widget
 * @param {dict} options 
 * @param {string} widget_id 
 * @returns HTML widget element
 */
function create_widget_element(options, widget_id, widget_info=null){
	let widget = document.createElement("div"); // the top level widget item
	widget.style.pointerEvents = 'all';
	let widget_titles = document.createElement("div");
	// the element that contains the title bar and body
	// the drag event is received here.

	// widget.style.transformOrigin = "left top"
	widget.className = "widget-module";
	widget_titles.className = "widget_obj";
	widget.appendChild(widget_titles);
	widget.id = widget_id;
	widget.components = {}; // dict of widget html components
	widget.components.obj = widget_titles;

	let resize_handle_left = document.createElement("div");
	widget_resize(widget, resize_handle_left, "left");
	let resize_handle_right = document.createElement("div");
	widget_resize(widget, resize_handle_right, "right");

	resize_handle_left.classList = "widget_resize";
	resize_handle_right.classList = "widget_resize";
	resize_handle_left.style.left = "0";
	resize_handle_right.style.right = "-5px";
	widget.appendChild(resize_handle_left);
	widget.appendChild(resize_handle_right);

	// title bar
	let widget_title_bar = document.createElement("div");
	widget_title_bar.innerText = options.title;
	widget_title_bar.id = widget_id + "_title";
	widget_title_bar.className = "widget_title";
	widget_titles.appendChild(widget_title_bar);
	widget.components.title_bar = widget_title_bar;

	widget_title_bar.onmousedown = e => {
		// widget secondary click context menu
		if (e.button === 2 && !e.shiftKey && !e.altKey && !e.ctrlKey){
			let cmenu = widget_context_menu(widget_list[widget_id]);
			overlay_menus_layer.appendChild(cmenu);
			cmenu.style.left = e.clientX + "px";
			cmenu.style.top = e.clientY + "px";
			overlay_menus_layer.activate(cmenu);
		}
	}

	widget_title_bar.ondblclick = e => {
		// title bar double click rename widget
		if (e.button === 0 && !e.shiftKey && !e.altKey && !e.ctrlKey){
			let rename = overlay_menus.widget_rename();
			rename.style.left = e.clientX + "px";
			rename.style.top = e.clientY + "px";
			rename.entry.value = widget_list[widget_id].title;
			overlay_menus_layer.activate(rename);
			rename.entry.focus();
			rename.entry.select();

			let widget_rename = e => {
				overlay_menus_layer.deactivate();
				draw_canvas_widget(widget_list[widget_id]);
				widget_list[widget_id].title = (
					rename.entry.value === "" ?
					widget_list[widget_id].mod_name :
					rename.entry.value
				);
				widget_title_bar.innerText = widget_list[widget_id].title;
			}

			rename.onkeydown = e => {
				if (e.key === "Enter"){
					widget_rename(e);
				}
			}
			rename.confirm.onclick = e => widget_rename(e);
		}
	}


	// widget body
	let widget_body = document.createElement("div");
	widget_body.id = widget_id + "_body";
	widget_body.className = "widget_body";
	widget.appendChild(widget_body);
	widget.components.body = widget_body;

	// subtitle bar
	let widget_subtitle = document.createElement("div");
	widget_subtitle.innerText = `${(options.mod_name || "Generic")} : ${widget_id}`;
	widget_subtitle.id = widget_id + "_subtitle";
	widget_subtitle.className = "widget_subtitle";
	widget_body.appendChild(widget_subtitle);
	widget.components.subtitle = widget_subtitle;

	// config and status bar
	let widget_config = document.createElement("div");
	widget_config.id = widget_id + "_config";
	widget_config.className = "widget_config";
	widget_body.appendChild(widget_config);
	widget.components.config = widget_config;
	// let widget_config_run = document.createElement("div");
	// let widget_config_cached = document.createElement("div");
	// widget_config_run.className = "widget_config_item";
	// widget_config_cached.className = "widget_config_item";
	// widget_config_run.innerText = "run";
	// widget_config_cached.innerText = "cached";
	// widget_config_cached.style.right = "0";
	// widget_config.appendChild(widget_config_run);
	// widget_config.appendChild(widget_config_cached);

	if (widget_info != null && "live" in widget_info && widget_info.live != false){
		let widget_config_live = document.createElement("div");
		widget_config_live.className = "widget_config_item";
		widget_config_live.innerText = "live";
		widget_config.appendChild(widget_config_live);
		widget_config_live.onclick = e => {
			widget_list[widget_id].is_live = !widget_list[widget_id].is_live;
			if (widget_list[widget_id].is_live) widget_config_live.style.color = "var(--live_green)";
			else widget_config_live.style.color = "var(--white)";
		}
	}

	// preview window
	if (widget_info != null && "preview" in widget_info && widget_info.preview != false){
		let widget_preview = document.createElement("div");
		widget_preview.id = widget_id + "_subtitle";
		widget_preview.className = "widget_preview";
		widget_body.appendChild(widget_preview);
		widget.components.preview = widget_preview;
	}

	// widget entries
	let widget_entries = document.createElement("div");
	widget_entries.id = widget_id + "_entries";
	widget_entries.className = "entries";
	widget_body.appendChild(widget_entries);
	widget.components.entries = widget_entries;


	// the actual style of the widget is set in draw_canvas_widget,
	// which is called after creating the widget html element.
	return widget;
}

/**
 * Creates an entry in `widget_list`, async calls backend to instance a corresponding object.
 * @param {dict} options 
 * @returns 
 */
async function add_widget(options){

	// options and example values
	// "position": {x: 10, y: 13}
	// "width": 200
	// "fontSize": 24
	// "borderRadius": 15
	// "padding": 5
	// "mod_name": "Canonicizer"

	window.backend_refs.widget_info;
	// console.log(window.backend_refs.widget_info[options.backend][options.mod_name])

	if (options.mod_name == null){
		options.mod_name = "Generic";
	}

	let this_id;
	if (options.id == null){
		do {
			// each widget is associated with a UID in the widget list,
			// in case the user names two widgets with the same name.
			this_id = Math.floor(Math.random() * 1679615).toString(36);
		} while (widget_list[this_id] !== undefined);
	} else {
		if (widget_list[this_id] !== undefined){
			throw ReferenceError(`Dupliate IDs for widgets: ${options.id}`);
		}
		this_id = options.id;
	}

	if (!("backend" in options)){
		throw Error("Must specify a backend for add_widget, because duplicate names may exist between backends.");
	}
	

	options.id = this_id;
	let add_widget_return = await window.electronAPI.add_new_widget([options]);
	if (add_widget_return.status){
		console.log("Error adding \n" + (add_widget_return.message || "Unknown error."));
		return;
	}
	// do something with add_widget_return? currently it returns 0.

	let this_title = options.title || options.mod_name || "Generic";
	options.title = this_title;

	// create html element
	let widget = create_widget_element(options, this_id, window.backend_refs.widget_info[options.backend][options.mod_name]);

	// add to widget list
	widget_list[this_id] = {
		// these attributes are dboard attributes for the backend.
		// actual displayed width, height etc are stored in the HTML element.
		"id": this_id,
		"backend": options.backend,
		"title": this_title,
		"html": widget, "params": {},
		"is_live": false,
		"output": (("output" in window.backend_refs.widget_info[options.backend][options.mod_name]) ?
			window.backend_refs.widget_info[options.backend][options.mod_name].output : false),
		"mod_name": options.mod_name, // backend class name
		"mod_type": window.backend_refs.widget_info[options.backend][options.mod_name].mod_type,
		"conns": structuredClone(window.backend_refs.widget_info[options.backend][options.mod_name].in_out),
		"position": (options.position || window_to_dboard({ "x": window.innerWidth / 2, "y": window.innerHeight / 2 })),
		"width": (Math.max(options.width || 200, window.backend_refs.gui_params.widget.width_min)),
		"fontSizeLarge": (options.fontSizeLarge || 22),
		"fontSizeMedium": (options.fontSizeMedium || 18),
		"fontSizeSmall": (options.fontSizeSmall || 12),
		"borderRadius": (options.borderRadius || 15),
		"padding": 5,
		// title bar color priority:
		// explicitly specified -> color assigned to module type -> default color
		"title_bar_color": (
			options.title_bar_color || 
			WSTYLES[window.backend_refs.widget_info[options.backend][options.mod_name].mod_type] ||
			WSTYLES.Generic_base
		).title_bar_color,
	};

	widget.style.top = 0.4 * window.innerHeight;
	widget.style.left = 0.4 * window.innerWidth;
	widget.style.width = widget_list[this_id].width * window.canvas_zoom + "px";
	widget.events = {};
	widget.events.widget_move_event = (e) => {
		if (e.target.className.includes("wtextentry")) return;
		// event for when the widget is moved
		if (e.button === 0){
			let selected = widget_list[this_id].selected;
			utils.dragging(e, "down", widget, widget_move);

			let max_index = 10;

			for (let w of Object.keys(widget_list)){
				if (!e.shiftKey) widget_list[w].selected = false;
				widget_list[w].focused = false;
				// shuffle z-indices
				max_index = Math.max(parseInt(widget_list[w].html.style.zIndex), max_index);
				if (parseInt(widget_list[w].html.style.zIndex) > parseInt(widget.style.zIndex)){
					widget_list[w].html.style.zIndex = String(parseInt(widget_list[w].html.style.zIndex) - 1)
				}
			}
			if (e.shiftKey) widget_list[this_id].selected = !selected;
			else widget_list[this_id].selected = true;
			if (!e.ctrlKey) widget_list[this_id].focused = true;
			else widget_list[this_id].focused = false;

			widget.style.zIndex = String(max_index);
			draw_all_widgets("place", [{dx: e.movementX, dy: e.movementY}, {dx: 0, dy: 0}]);
			// draw_canvas_widget(widwidget.components.objget_list[this_id]);
			e.stopImmediatePropagation();
		}
	}
	widget.components.body.onmousedown = e => widget.events.widget_move_event(e);
	widget.components.obj.onmousedown = e => widget.events.widget_move_event(e);
	let max_index = 10;
	for (let w of Object.keys(widget_list)){
		let z = parseInt(widget_list[w].html.style.zIndex);
		if (z > max_index) max_index = z;
	}
	widget.style.zIndex = String(max_index + 1);
	dboard.appendChild(widget);

	// this is needed because there is no info on widget params (only IO)
	// before a widget is instanced in the backend.
	await update_widget_connections(widget_list[this_id], {
		draw_outgoing_connection_curves: false,
		set_reverse_link: false
	})
	// widget should be added to html before drawing widget styles.
	draw_canvas_widget(widget_list[this_id]);
	draw_widget_connections(widget_list[this_id], options);

	return widget;
}

/**
 * delete a widget, update backend with the deletion
 * @param {string} id 
 */
async function delete_widgets(id){
	let widget_ids = (typeof id === "string") ? [id] : id;
	for (let wid of widget_ids){
		let widget = widget_list[wid];
		for (let in_target of Object.keys(widget.conns.in)){
			// disconnect widgets giving input to this widget
			if (!("target" in widget.conns.in[in_target]) || widget.conns.in[in_target].target === null) continue;
			let [in_widget, in_cname] = widget.conns.in[in_target].target;
			delete widget_list[in_widget].conns.out[in_cname].targets[widget.id];
		}
		for (let out_cname of Object.keys(widget.conns.out)){
			// disconnect widgets taking output of this widget
			// nested loops because each out-conn may have multiple widgets
			// and there may be multiple conns to the same widget
			if (!("targets" in widget.conns.out[out_cname])) continue;
			for (let to_widget of Object.keys(widget.conns.out[out_cname].targets)){
				for (let to_cname of Object.keys(widget.conns.out[out_cname].targets[to_widget])){
					widget_list[to_widget].conns.in[to_cname].target = [null, null];
				}
			}
		}
		dboard.removeChild(widget.html);
		delete widget_list[widget.id];
	}
	await window.electronAPI.delete_widgets({ids: widget_ids});
	draw_all_widgets();
}

document.debug.add_widget = add_widget;
window.funcs = {};
window.funcs.add_widget = add_widget;

/////////////////////////////////////////////////////////

// EXPERIMENTS

/** Read an experiment file and construct graph. */
function read_experiment_graph(){
	// first realize the widget elements, DO NOT CONNECT
	// Then add connections lmao
}

/**
 * This is called from the function that handles run button clicks
 */
async function run_exp(options={}){
	console.log(widget_list)
	// first create widget_for_exp that is sent to the backend.
	// This includes connections, IDs, params etc.


	let widgets_for_exp = {};
	for (let w of Object.values(widget_list)){
		// for every widget, remove the html elements,
		// then get parameters/inputs

		// conns.in only has the element for the conn dot
		let conns = {in: {}, out: {}};
		for (let c of Object.keys(w.conns.in)){
			conns.in[c] = {
				target: w.conns.in[c].target,
				value: w.conns.in[c].value,
			};
			conns.in[c].displayed_name = (
					("displayed_name" in w.conns.in[c]) && w.conns.in[c].displayed_name != null
				) ? w.conns.in[c].displayed_name : c
		}

		// conns.out has both the conn dot and the outgoing svg curve.
		for (let c of Object.keys(w.conns.out)){
			// a widget is not expected to connect to too many other widgets (>10?),
			// and each output is not expected to connect to too many inputs (>5?),
			// so the nested loop shouldn't add too much to comp time.

			// the outgoing connections are checked in two layers of loops
			// because the connections are grouped by target widget and their inputs.
			// the above "rule" applies to all these connections. i.e. widgets x conns < 5, probably.
			conns.out[c] = {targets: {}};
			if (w.conns.out[c].targets == null) continue;
			for (let out_widget of Object.keys(w.conns.out[c].targets)){
				// out_widget is widget id string
				conns.out[c].targets[out_widget] = {};
				for (let widget_c of Object.keys(w.conns.out[c].targets[out_widget])){
					conns.out[c].targets[out_widget][widget_c] = null;
				}
			}
		}

		widgets_for_exp[w.id] = {
			backend: w.backend,
			conns: conns, // swap in the "sanitized" conns list.
			id: w.id,
			global_params: w.params,
			is_live: w.is_live,
			mod_name: w.mod_name,
			mod_type: w.mod_type,
			value: w.value,
			output: w.output,
			dtype: (("dtype" in w) ? w.dtype : "str"),
		}
	}
	let exp_results = await window.electronAPI.run_exp({
		widget_list: widgets_for_exp,
		global_settings: {
			live_only: ("live_only" in options) ? options.live_only : false,
		},
	});
	if (exp_results.status === 0){
		console.log("ran experiment", exp_results);
	} else {
		console.warn("Experiment error:", exp_results.message)
	}
	
}
document.debug.run_exp = run_exp;


/////////////////////////////////////////////////////////
/**
 * A faster version of draw_all_widgets() but instead of re-drawing everything,
 * only calculate widget and connection positions.
 * @param {dict} zoom_center data form: `{x: <number>, y: <number>}`
 * @param {Number} zoom_factor float number.
 */
function place_all_widgets(){
	for (let wid of Object.values(widget_list)){
		draw_canvas_widget(wid);
	}

}

/**
 * draw all widgets (draw_canvas_widget) and connections (draw_outging_connection_curves)
 * @param {String} connections = 'redraw'. options: 'redraw', 'place'.
 * @param {dict} moved `{dx: <number>, dy: number}`
 */
function draw_all_widgets(connections="redraw", moved=null){
	// draw all widgets and connections
	for (let w of Object.keys(widget_list)){
		draw_canvas_widget(widget_list[w]);
		// most expensive. when widgets' input entries may change
		if (connections === "redraw"){
			svg_canvas.innerHTML = '';
			draw_outgoing_connection_curves(widget_list[w], null, false);
		}
		// cheap. when only moving dboard
		else if (connections === "place"){
			// if (svg_canvas.innerHTML === "") console.log("info: svg_canvas is empty")
			if (moved===null) throw new Error("connections===place needs `moved`. will assume nothing");
			draw_outgoing_connection_curves(widget_list[w], null, false, true, moved);
		}
		// free-of-charge
		else {}
	}
}

/**
 * move canvas and adjust elements. canvas is seen through the "UI window"
 * @param {Event} event unused
 * @param {*} canvas unused
 * @param {dict} moved - `{dx: <number>, dy: <number>}`, formatted & obtained from
 * two e.clientX's and e.clientY's
 * @param {*} options 
 */
function canvas_move(event, canvas, moved, options=null){

	canvas_offset.x -= moved.dx / window.canvas_zoom;
	canvas_offset.y -= moved.dy / window.canvas_zoom;
	// svg_canvas.style.left = canvas_offset.x + "px";
	// svg_canvas.style.top = canvas_offset.y + "px";
	// svg_canvas_temp.style.left = canvas_offset.x + "px";
	// svg_canvas_temp.style.top = canvas_offset.y + "px";
	// dboard.style.left = canvas_offset.x + "px";
	// dboard.style.top = canvas_offset.y + "px";
	draw_all_widgets("place", [moved, moved]);
}

/** calculates center of widgets. used to reset view position */
function canvas_center(options=null){
	let x = 0; let y = 0; let n = 0;
	for (let w of Object.keys(widget_list)){
		x += widget_list[w].position.x;
		y += widget_list[w].position.y;
		n += 1;
	}
	return [x/n, y/n];
}



/**
 * 
 * @param {dict} zoom_center zoom center in window coords `{x: <number>, y: <number>}` (i.e. clientX, Y)
 * @param {Number} zoom_fac how much to zoom
 */
function canvas_zooming(zoom_center, zoom_fac){


	let zc = window_to_dboard(zoom_center);
	let real_zoom_fac = window.canvas_zoom

	window.canvas_zoom *= zoom_fac;
	if (window.canvas_zoom > 5) {window.canvas_zoom = 5;}
	if (window.canvas_zoom < 0.3) {window.canvas_zoom = 0.3;}

	let zc_moved = window_to_dboard(zoom_center);
	zc_moved.x -= zc.x; zc_moved.y -= zc.y;
	canvas_offset.x -= zc_moved.x; canvas_offset.y -= zc_moved.y;
	place_all_widgets();
	// oh boy.
	real_zoom_fac = window.canvas_zoom / real_zoom_fac;
	for (let curve of svg_canvas.childNodes){
		if (!("curve_points" in curve)) continue;
		let c0 = curve.curve_points[0];
		let c4 = curve.curve_points[4];
		utils.draw_connection_svg(
			{x: zoom_center.x + real_zoom_fac * (c0.x - zoom_center.x), y:zoom_center.y + real_zoom_fac * (c0.y - zoom_center.y)},
			{x: zoom_center.x + real_zoom_fac * (c4.x - zoom_center.x), y:zoom_center.y + real_zoom_fac * (c4.y - zoom_center.y)},
			window.canvas_zoom, curve
		)
	}
}

var left_panel = panels.panel({
	id: "pcontent_main_panel", p_layer: panels_layer,
	left: "0", top: "0", height: "99vh", width: "100px",
	docked: "left-both",
	html_id: "panel_content_main_panel", // the id to pick out in the hidden elements in main.html
});
panels_layer.appendChild(left_panel);
main_panel.init(left_panel);
left_panel.run_button.onclick = async (e) => run_exp();
left_panel.reset_view_button.onclick = (e) => {
	// let ccenter = canvas_center();
	// canvas_offset.x = ccenter[0] - canvas_offset.x;
	// canvas_offset.y = ccenter[1] - canvas_offset.y;
	// draw_all_widgets("place", {dx: ccenter[0] - canvas_offset.x, dy: ccenter[1] - canvas_offset.y});
};

//
var previous_touches_pos = {}; //set this to null upon touchend.

// use touchevent.identifier to decide which touchpoint moved

// dboard.addEventListener("touchstart", e => {console.log("touch start", e);})
dboard.addEventListener("touchmove", e => {

	let this_touches_pos = {}
	for (let t of Object.values(e.touches)){
		this_touches_pos[t.identifier] = {x: t.clientX, y: t.clientY};
	}

	if (("0" in previous_touches_pos) && ("1" in previous_touches_pos)
			&& ("0" in this_touches_pos) && ("1" in this_touches_pos)
		){
		let ptp = [previous_touches_pos[0], previous_touches_pos[1]];
		let ttp = [this_touches_pos[0], this_touches_pos[1]];
		let center_prev = {x: (ptp[1].x + ptp[0].x) / 2, y: (ptp[1].y + ptp[0].y) / 2};
		let center_this = {x: (ttp[1].x + ttp[0].x) / 2, y: (ttp[1].y + ttp[0].y) / 2};

		
	
		let moved = {dx: center_this.x - center_prev.x, dy: center_this.y - center_prev.y};

		let zoom_fac = utils.euclidean_distance(ttp[0], ttp[1]) /
			utils.euclidean_distance(ptp[0], ptp[1])
	
		canvas_move(e, dboard, moved);
		canvas_zooming(center_this, zoom_fac);
		dboard.hidden = true;
		dboard.hidden = false;
	}

	previous_touches_pos = this_touches_pos;
})

dboard.addEventListener("touchend", e => {
	for (let t of Object.values(e.changedTouches)){
		delete previous_touches_pos[t.identifier];
	}
})
// dboard.addEventListener("touchend", e => {console.log("touch end", e);})

// dboard.addEventListener("touchstart", e => console.log(e.changedTouches))


window.addEventListener('DOMContentLoaded', async () => {


	dboard.onmousedown = (e) => {
		// set middle mouse to drag canvas
		if (e.button === 1){
			utils.dragging(e, "down", dboard, canvas_move);
		} else {
			for (let w of Object.keys(widget_list)){
				widget_list[w].focused = false;
				widget_list[w].selected = false;
			}
			draw_all_widgets(false);
		}
	}

	// set delete button to delete widget when selected
	window.onkeydown = (e) => {
		if (e.key === "Delete"){
			// delete widget
			let widget_id;
			for (let w of Object.keys(widget_list)){
				if (!widget_list[w].focused) continue;
				widget_id = w;
				break;
			}
			if (widget_list[widget_id] == null) return;
			// TODO instead of drawing all widgets,
			// only call removeChild on deleted widgets and its incoming/outgoing conns
			delete_widgets(widget_id);
			draw_all_widgets();
		}
	}


	dboard.onwheel = (e) => {
		let zoom_center_w = {x: e.clientX, y: e.clientY};
		let zoom_fac = Math.pow(canvas_zoom_multiplier, e.deltaY > 0 ? -1 : 1);

		canvas_zooming(zoom_center_w, zoom_fac);
	}

	let get_widget = await window.electronAPI.widget_get_info();
	if (get_widget.status !== 0) console.log("couldn't load widget info");
	else window.backend_refs.widget_info = get_widget.content;
	document.debug.widget_info = window.backend_refs.widget_info;

	await add_widget({ title: "h 3", position: { x: 44, y: 92 },
		mod_name: "Character NGrams", id: 'ttt2', backend: "PyAPI"});
	await add_widget({
		title: "preview", position: { x: 200, y: 300 }, width: 230,
		mod_name: "Preview", id: 'ttt1', backend: "Js_API"
	});
	await add_widget({
		title: "math", position: {x: 50, y:100},
		mod_name: "Math", id: "danw", backend: "Js_API"
	})
	// await add_widget({
	// 	title: "combine", position: {x: 100, y:100},
	// 	mod_name: "Combine events", id: "vian", backend: "PyAPI", width: 250
	// })


	// widget_list['ttt1'].conns.out['event set'].targets = {'ttt2': {'n':null, 'text':null}};
	// draw_widget_connections(widget_list['ttt1'])



	document.getElementById("loading_screen").style.pointerEvents = "none";
	document.getElementById("loading_screen").style.opacity = "0";
	document.getElementById("loading_screen").style.visibility = "hidden";
	console.log("winfo", document.debug.widget_info)
})


