// x, y.
export function dragging(event, stage, element=null, drag_handler=null, drag_handler_options=null) {
	// returns coords for dragging. called by multiple.
	// "element" must be the element affected.
	if (stage === "down") {
		// if mouse down, record coordinates and add move/mouse up events
		if (element !== null) {
			event.preventDefault();
			window.onmousemove_listeners.dragging = (e) => {
				dragging(e, "move", element, drag_handler, drag_handler_options);
			}
			window.onmouseup_listeners.dragging = (e) => {
				dragging(e, "up", element)
			}
		}
	} else if (stage === "move") {
		// if moving, return dx, dy since last frame.
		if (element === null) throw Error("Element required");
		//event.preventDefault();
		var moved = {
			"dx": event.movementX,
			"dy": event.movementY,
		}
	
		if (drag_handler !== null) {
			drag_handler(event, element, moved, drag_handler_options);
		}
	} else if (stage === "up") {
		window.onmousemove_listeners.dragging = null;
		window.onmouseup_listeners.dragging = null;
	}
}

/**
 * computes points for a widget connection curve.
 * @param {*} a start point
 * @param {*} b end point
 * @param {*} canvas_zoom used only to calculate horizontal segment lengths
 * @returns curve_points, curve_line.
 * `curve_points` is a list of 5 points used to construct the bezier curve.
 * 
 * `curve_line` is the string output that can be applied to an svg curve right away with `.setAttribute('d', curve_line)`
 */
export function compute_conn_svg(a, b, canvas_zoom){
	let hor_seg_maxlen = 100 * window.canvas_zoom;
	let hor_seg_minlen = b.x - a.x >= 0 ? 2/8 * (b.x - a.x) : window.canvas_zoom * 0.5 * (a.x - b.x);
	let seglen = Math.min(hor_seg_maxlen, hor_seg_minlen);
	// do not sort between left and right,
	// bc horizontal segment must be right of the output dot,
	// and left of the input dot.
	let curve_points = [
		{x: a.x, y: a.y},
		{x: a.x + seglen, y: a.y},
		{x: (a.x + b.x)/2, y: (a.y + b.y)/2},
		{x: b.x - seglen, y: b.y},
		{x: b.x, y: b.y}
	]
	let curve_line = `m${a.x} ${a.y} `
	+ `Q${a.x + seglen} ${a.y}, `
	+ `${(a.x + b.x)/2} ${(a.y + b.y)/2} `
	+ `${b.x - seglen} ${b.y}, `
	+ `${b.x} ${b.y}`;
	return [curve_points, curve_line];
}

/**
 * @param {Object}a `{x: number, y: number}`
 * @param {Object}b `{x: number, y: number}`
 * @param {Number}canvas_zoom only used for `compute_conn_svg()` to calculate horizontal segment lengths.
 * @param {Node}curve (svg node)
 * @returns HTML element of existing curve if provided, or new curve if not provided.
 * curve points saved as `curve.curve_points`. Used to re-draw curve if needed.
 *
 * draws a bezier curve FROM point a (output dot) TO point b (intput dot), returns svg segment.
 * input points are expected to be canvas/window coordinates,
 * output points are canvas/window coordinates.
 * The calling function decides what to do with the returned object
 * (i.e. assign to widgets etc)
 * the segments containing a and b points (start & end) are always horizontal
 * */
export function draw_connection_svg(a, b, canvas_zoom, curve=null){

	let [curve_points, curve_line] = compute_conn_svg(a, b, canvas_zoom);

	if (curve === null){
		let out_curve = document.createElementNS("http://www.w3.org/2000/svg", "path");
		out_curve.classList = "conn_curve";
		out_curve.setAttribute('d', curve_line);
		out_curve.onmousedown = (e) => {console.log("lmao")}
		out_curve.curve_points = curve_points;
		return out_curve;
	} else {
		curve.setAttribute('d', curve_line);
		curve.curve_points = curve_points;
		return curve;
	}
}

export function create_tooltip(html,
		options={width: "100px", height: "50px"}){
	let tt = document.createElement("div");
	tt.className = "tooltip_element";
	tt.innerHTML = html;
	
	return tt;
}

const regex_float_adj = new RegExp("(?<=\.[1-9]*)000000+[0-9]*$");

/**
 * round number to nearest place
 * @param {Number} resolution reference for smallest gradation.
 * 	e.g. 0.2 -> nearest 0.2
 * @param {Number} number input number
 * @param {Number} epsilon number to adjust for rounding.
 * 	This is so that e.g. when ronuding integers, *.5 rounds to the higher integer.
 */
export function round_to(place=1, number, epsilon=0.000001){
	// true: round up; false: round down.
	let rounded = (number - parseInt(number/place) * place > (parseInt(number/place) + 1) * place - epsilon - number) ?
	(parseInt(number/place) + 1) * place :
	parseInt(number/place) * place
	return parseFloat(String(rounded).replace(regex_float_adj, ""));
}


/**
 * places an HTML element so that it stays in the window
 * CURRENTLY UNUSED
 * @param {HTMLele} element element to place
 * @returns dict of {top, left}
 */
export function position_element_inside(element, px=true){
	let top = Math.max(0, Math.min(window.innerHeight - element.getBoundingClientRect().height));
	let left = Math.max(0, Math.min(window.innerWidth - element.getBoundingClientRect().width))
	return {top: top + (px ? "px": null), left: left + (px ? "px": null)};
}

/**
 * returns true if any mod keys is active. (ctrl, alt, super/meta/windows, shift)
 * @param {Event} e event.
 * @returns 
 */
export function any_mod_keys(e){
	return (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey);
}
export function no_mod_keys(e){
	return !any_mod_keys(e);
}

/**
 * 2D euclidean distance.
 * a, b are points in the form `{x: <number>, y: <number>}`
 * positions don't matter.
 * @param {dict} a 
 * @param {dict} b 
 */
export function euclidean_distance(a, b){
	return Math.pow(Math.pow(Math.abs(b.x - a.x), 2) + Math.pow(Math.abs(b.y - a.y), 2), 0.5);
}