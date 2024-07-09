// modules to generate various controls in a widget. e.g. sliders, entries, menus.
// each module has some methods attatched to them to make interactions easier to set up.
// @author Michael Fang


// need to specify what needs to be scaled when zooming in/out




/*

notes:
"velement" is the value-containing element.
This is so when the calling function needs the value of the input,
which is represented to the user by a "container element",
it just needs to find the value of the velement instead of worrying about
whether the container element has the value.

This is useful when the container element is not the velement,
e.g. in a checkbox, where the actual checkbox is a child of a label element,
which is the child of the container element.

*/


import * as utils from "./utils.js"

const dboard = document.getElementById("drawing_board");
const svg_canvas = document.getElementById("svg_canvas");
const overlay_menus_layer = document.getElementById("overlay_menus");
const svg_canvas_temp = document.getElementById("svg_canvas_temp");
svg_canvas_temp.mouse_drag_curve = null;

/**
 * Converts a number to its representation string with <place> decimal places.
 * @param {Number} number 
 * @param {int} place 
 * @returns 
 */
function wslider_number_display(number, place=3){
	if (place < 0) throw Error("wslider_number_display(): place must be a non-neg integer")
	let value_string = String(number).split(".");
	value_string = value_string.length === 1 ?
	(
		place === 0 ?
		value_string :
		value_string[0] + "." + "0".repeat(place)
	) :
	value_string[0] + "." + value_string[1].substring(0, 3) + "0".repeat(Math.max(0, place - value_string[1].length));
	return value_string;
}


var last_touch = {x: null, y: null};
var scaled_slide_value = null;

/**
 * a slider that can also accept number input. reference Blender shader editor slider.
 * @param {String} wname name of slider to display
 * @param {Number} min min value (inclusive)
 * @param {Number} max max value (inclusive)
 * @param {Number} d default value
 * @param {Number} resolution minimum step
 * @returns 
 */
export function wslider(wname="slider", min=-0.5, max=2, d=1.5, resolution=0.05, free_slide=false){
	if (resolution <= 0) throw Error("Resolution cannot be zero or less.");
	if (!free_slide){
		if (max < min + resolution) throw Error("Max value can't be equal or less than minimum value.");
		if (d < min || d > max) throw Error(`Default value for ${wname}: ${d} is out of range [${min}, ${max}]`)
	}
	// add internal event listener here.
	let s_container = document.createElement("div");
	s_container.className = "wslider";
	s_container.velement = s_container;
	let s_slider = document.createElement("div");
	s_slider.className = "wslider_slider";
	s_slider.style.width = 100 * (d-min)/(max-min) + "%";
	s_slider.style.pointerEvents = "none";

	let s_text_label = document.createElement("div");
	let s_value_label = document.createElement("div");
	s_text_label.className = "wentry_covered_text";
	s_text_label.innerText = wname;
	s_value_label.innerText = wslider_number_display(d, (resolution === 1 ? 0 : 3));
	// make text and value labels non-interactive by mouse
	s_value_label.className = "wslider_value";

	s_container.velement.value = d;


	let set_value = (v, vmin, vmax, vres, input_element) => {
		// input element is s_container, to be read by render_main.js.
		try {v = parseFloat(v)}
		catch {return;}
		if (!free_slide && (v < vmin || v > vmax)) return;
		v = utils.round_to(vres, v);
		s_container.velement.value = v;
		if (!free_slide) s_slider.style.width = (v - vmin) / (vmax - vmin) * 100 + "%";
		s_value_label.innerText = v;
		s_value_label.innerText = wslider_number_display(v, (vres === 1 ? 0 : 3));
		input_element.value = v;
		s_container.dispatchEvent(new InputEvent("input"));
	}

	// when mouse down, react to dragging events.
	// set mouseup event
	// preventing dragging events from moving the widget
	// is done by the calling function.
	let slider_adjust = (e, cursor=true) => {

		if (cursor) document.body.style.cursor = "ew-resize";
		let bbox = s_container.getBoundingClientRect();

		let dx = ("movementX" in e) ? e.movementX : (last_touch.x == null ? 0 : e.clientX - last_touch.x);
		//let dy = ("movementY" in e) ? e.movementY : (last_touch.y == null ? 0 : e.clientY - last_touch.y);

		let value;
		if (e.clientY <= bbox.bottom && e.clientY >= bbox.top){
			// decimal (0-1) position
			let position = Math.max(Math.min((e.clientX - bbox.left) / (bbox.right - bbox.left), 1), 0);
			// raw value, to be rounded re: resolution
			value = min + (max-min) * position;
			scaled_slide_value = value;
		} else {
			// make scrubbing speed faster if dragged vertically outsid element2
			let value_per_pixel = free_slide ? 0.1 * window.canvas_zoom : (max - min) / bbox.width; // value changed per pixel
			let move_scale = Math.max(0.001, Math.min(1000, (// the min-max clamps the value.
				(e.clientY > bbox.top) ?
				value_per_pixel - 0.0001 * (e.clientY - bbox.bottom) :// below element
				value_per_pixel + 0.01 * (bbox.top - e.clientY) // above element
			)))
			value = scaled_slide_value + dx * (move_scale);
			scaled_slide_value = value;
		}
		set_value(value, min, max, resolution, s_container);
		if (!free_slide) scaled_slide_value = Math.max(min, Math.min(max, scaled_slide_value))

		if (last_touch.x == null) last_touch.x = e.clientX;
		if (last_touch.y == null) last_touch.y = e.clientY;
	}
	s_container.addEventListener("touchstart", e => {scaled_slide_value = s_container.velement.value});
	s_container.addEventListener("touchmove", e => {
		if (Object.keys(e.touches).length > 1) return;
		slider_adjust(e.touches[Object.keys(e.touches)[0]], false);
	})
	s_container.onmousedown = e => {
		if (e.button !== 0) return;

		let initial_pos = {x: e.clientX, y: e.clientY};
		scaled_slide_value = s_container.velement.value;

		e.stopPropagation();
		e.preventDefault();
		// once mouse down, attach mouse move and mouse up listeners to
		// the window so the widget can be controlled even after the mouse leaves
		// the element.
		window.onmousemove_listeners.witem_mousemove = e => slider_adjust(e);
		
		window.onmouseup_listeners.witem_mouseup = e => {
			scaled_slide_value = null;
			if (e.clientX === initial_pos.x && e.clientY === initial_pos.y){
				// if the mouse didn't move (aka a regular click), enter edit mode
				let slider_edit = document.createElement("input");
				slider_edit.classList = "wslider_edit wslider";
				let brect = s_container.getBoundingClientRect();

				slider_edit.style.outline = "0";
				slider_edit.style.width = (brect.width/window.canvas_zoom) - 9 + "px";
				slider_edit.style.height = (brect.height/window.canvas_zoom) - 4 + "px";
				slider_edit.style.transform = "scale(" + String(window.canvas_zoom) + "," + String(window.canvas_zoom) + ")";
				slider_edit.style.top = brect.top + "px";
				slider_edit.style.left = brect.left + "px";
				slider_edit.value = s_container.velement.value;
				window.onmouseup_listeners.witem_mouseup = null;
				window.onmousemove_listeners.witem_mousemove = null;
				overlay_menus_layer.activate(slider_edit);
				slider_edit.select();
				slider_edit.onkeydown = e => {
					if (e.key !== "Enter" || e.metaKey || e.shiftKey || e.ctrlKey || e.altKey) return;
					set_value(slider_edit.value, min, max, resolution, s_container);
					overlay_menus_layer.deactivate(e);
				}
			} else {
				// if the mouse moved, it was dragging. save new value.
				document.body.style.cursor = "auto";
				window.onmouseup_listeners.witem_mouseup = null;
				window.onmousemove_listeners.witem_mousemove = null;
				// s_container.dispatchEvent(new CustomEvent("input"));
				s_container.dispatchEvent(new InputEvent("input"));
				window.onmouseup_listeners.witem_mouseup = null;
				window.onmousemove_listeners.witem_mousemove = null;
			}
		}
	}

	// when mouse up, ignore dragging events

	if (!free_slide) s_container.appendChild(s_slider);
	s_container.appendChild(s_text_label);
	s_container.appendChild(s_value_label);
	return s_container;
}

/**
 * FOR WIDGETS: USE WCOPTIONS INSTEAD ("notice the C")
 * 
 * Options menu using default html options/select widget
 * @param {String} cname name of parameter
 * @param {Array} options_list list of string options
 * @param {String} set_value index of default option in options_list
 * @returns element to be added to widget
 */
export function woptions(cname, options_list, set_value){
	// FOR WIDGETS: USE WCOPTIONS INSTEAD ("notice the C")
	// a drop-down menu
	// let o = document.createElement("div");
	// let olabel = document.createElement("label");
	let o = document.createElement("select");
	o.className = "woptions";
	for (let op of options_list){
		let this_option = document.createElement("option");
		this_option.innerText = op; this_option.value = op;
		o.appendChild(this_option);
	}
	o.onmousedown = e => {
		e.stopPropagation();
	}
	o.value = set_value;
	o.velement = o;
	return o;
}

export function context_menu(title, options_list){
	let cmenu = document.createElement("div");
	cmenu.className = "context_menu";
	let scrollpane = document.createElement("div");
	scrollpane.className = "context_menu_scrollpane";
	cmenu.appendChild(scrollpane);
	scrollpane.onscroll = e => {console.log(scrollpane.scrollTop)}
	for (let op_item of Object.keys(options_list)){
		let op = options_list[op_item];
		let this_option = document.createElement("div");
		this_option.innerText = op_item;
		this_option.setAttribute("value", op_item);
		this_option.onmousedown = e => {
			op(e); overlay_menus_layer.deactivate(e);
		};
		this_option.className = "context_menu_item_selectable";
		scrollpane.appendChild(this_option);
	}
	cmenu.style.display = "grid";
	cmenu.style.gridTemplateColumns = "auto";
	return cmenu;
}

/**
 * Custom option menu with name of parameter at bottom.
 * @param {String} cname name of parameter
 * @param {Array} option_list list of string options
 * @param {String} set_value VALUE of default option in options_list if newly created, or current value if already set.
 * 	* must be obtained in the calling function using the default index.
 * @param {HTMLElement} custom_menu **not implemented** |
 * 	a custom html page to select items. best for js-based widgets.
 *  goal is Blender's Math node
 * @returns element to be added to widget
 */
export function wcoptions(cname=null, options_list, set_value, custom_menu=null){
	// custom
	// on mouse exit, the menu will disappear
	let display = document.createElement("div"); // the element that always shows up
	let menu = document.createElement("div"); // the element that only shows up when interacted with.
	menu.className = "context_menu";
	let display_text = document.createElement("div");
	let title_text;
	if (cname != null){
		title_text = document.createElement("div");
		title_text.innerText = cname;
		title_text.className = "context_menu_item_nonselectable";
		menu.appendChild(title_text);
	}

	let scrollpane = document.createElement("div");
	scrollpane.className = "context_menu_scrollpane";
	menu.appendChild(scrollpane);

	display.innerText = "⋯";

	display.className = "wcoptions_display";
	display_text.className = "wentry_covered_text";
	display.appendChild(display_text);
	//display_text.style.width = "100%";

	display.onmousedown = e => {
		if (e.button !== 0) return;
		e.stopPropagation();
		menu = document.createElement("div");
		menu.className = "context_menu";

		if (cname != null){
			title_text = document.createElement("div");
			title_text.innerText = cname;
			title_text.className = "context_menu_item_nonselectable";
			menu.appendChild(title_text);
			let br = menu.appendChild(document.createElement("div"));
			br.className = "divider_horizontal";
		}


		scrollpane = document.createElement("div");
		scrollpane.className = "context_menu_scrollpane";
		menu.appendChild(scrollpane);
		let rect = display.getBoundingClientRect();
		if (custom_menu === null){
			for (let op of options_list){
				let this_option = document.createElement("div");
				this_option.innerText = op;
				if (String(op).startsWith("||")){
					this_option.className = "context_menu_item_nonselectable";
					this_option.innerText = op.slice(2);
					this_option.style.backgroundColor = "#222222";
					scrollpane.appendChild(this_option);
				} else {
					this_option.setAttribute("value", op);
					this_option.className = "context_menu_item_selectable";
					scrollpane.appendChild(this_option);
				}
				this_option.onmouseenter = e => e.preventDefault();
			}
		} else console.error("wcoptions type: custom_menu page not implemented");

		menu.style.visibility = "hidden";
		overlay_menus_layer.appendChild(menu);
		let menu_rect = menu.getBoundingClientRect();

		// position and height adjustments
		if (window.innerHeight - rect.bottom < menu_rect.height){
			if (rect.top > menu_rect.height){
				menu.style.bottom = window.innerHeight - rect.top + "px";
			} else if (window.innerHeight - rect.bottom > rect.top) {
				menu.style.height = window.innerHeight - rect.bottom - 15 + "px";
				menu.style.top = rect.bottom + "px";
			} else {
				menu.style.height = rect.top - 15 + "px";
				menu.style.top = "0px"
			}
		} else menu.style.top = rect.bottom + "px";

		menu.style.left = rect.left + "px";

		// adjust width so there is space to display the texts
		menu.style.width = Math.max(menu.getBoundingClientRect().width, rect.width) + "px";
		// adjust height so the menu can be scrolled if there isn't enough screen space
		
		overlay_menus_layer.activate(menu, [menu]);

		menu.onmousedown = e => {
			if (e.target.getAttribute("value") !== undefined &&
				e.target.getAttribute("value") !== null &&
				e.target.getAttribute("class") !== undefined &&
				e.target.getAttribute("class").includes("_selectable")){
					display_text.innerText = e.target.getAttribute("value");
					display.value = e.target.getAttribute("value");
					display.dispatchEvent(new InputEvent("input"));
				}
			overlay_menus_layer.deactivate(e);
		}
	}
	display.value = set_value;
	display_text.innerText = set_value;
	display.velement = display;
	return display;

}

/**
 * The "connection dot" for input/output parameters
 * @param {String} conn_type must be "wconn_in" or "wconn_out". specifies whether input or output.
 * @param {String} data_type used to check type matching.
 * @returns 
 */
export function wconn(conn_type, data_type){
	// input/output of a widget
	if (typeof conn_type !== "string") throw TypeError;
	if (conn_type !== "wconn_in" && conn_type !== "wconn_out") throw Error;
	if (data_type === null || data_type === undefined) console.log("caution: wconn data type is not specified");
	let c = document.createElement("div");
	c.data_type = data_type;
	c.classList = `wconn ${conn_type}`;
	return c;
}

/**
 * Text label for inputs that are connected, are outputs, or place-holders.
 * @param {String} text text to display in the param slot in widget.
 * @param {String} conn_type must be "wconn_in" or "wconn_out". specifies whether input or output.
 * @returns 
 */
export function wtextlabel(text="lorem ipsum", conn_type=null){
	let e = document.createElement("div");
	e.className = "wentry";
	e.innerText = text;
	if (conn_type === "wconn_out") {
		e.style.justifyContent = "end"
	}
	e.velement = null;
	return e;
}

export function wtextentry(cname="input text", d="default text"){
	let container = document.createElement("div");
	let label = document.createElement("div");
	label.className = "wentry";
	label.innerText = cname;
	let tfield = document.createElement("textarea");
	tfield.innerText = d;

	tfield.className = "wtextentry";
	tfield.style.minHeight = "20px";
	tfield.style.maxHeight = "2000px";
	container.appendChild(label);
	container.appendChild(tfield);
	container.onclick = e => {
		e.stopImmediatePropagation();
		e.stopPropagation();
	};
	container.velement = tfield;
	return container;
}

/**
 * Checkbox input type
 * @param {String} text Text to display as label
 * @param {Boolean} state true if checked, false when not.
 * @returns 
 */
export function checkbox(text="checkbox", state=false){
	// checkbox
	let c = document.createElement("input");
	let clabel = document.createElement("label");
	c.setAttribute("type", "checkbox");
	c.checked = state;
	clabel.innerText = text
	clabel.appendChild(c);
	clabel.checkbox = c;
	clabel.velement = c;
	return clabel;
}

export function read_file(extensions){
	// considerations:
	// extensinos, multiple, chain read (csv -> other txt)
}