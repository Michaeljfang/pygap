import * as utils from "./utils.js"

export function panel(options){
	if (options.id === undefined || options.id === null) throw Error;
	// panel element
	// p_shell: the root element
	// |--- resizers (4x)
	// L___ p_content: element containing contents
	let p_shell = document.createElement("div");
	p_shell.className = "panel";
	p_shell.id = options.id.startsWith("panel_") ? options.id : "panel_" + options.id;

	let pcontent_id = options.id.startsWith("pcontent_") ? options.id : "pcontent_" + options.id;
	let p_content = document.getElementById(pcontent_id) || document.createElement("div");
	p_content.className = "panel_content";
	p_shell.p_content = p_content;
	p_shell.appendChild(p_content);

	//options.p_layer.appendChild(p_shell)

	let r_top = document.createElement("div");
	r_top.className = "resizer";
	let r_left = document.createElement("div");
	r_left.className = "resizer";
	let r_right = document.createElement("div");
	r_right.className = "resizer";
	let r_bottom = document.createElement("div");
	r_bottom.className = "resizer";


	r_right.style.top = "0";
	r_right.style.left = "100%";
	r_right.style.width = "5px";
	r_right.style.height = "100%";
	r_right.style.cursor = "ew-resize";

	r_top.style.top = "0";
	r_top.style.left = "0";
	r_top.style.width = "100%";
	r_top.style.height = "5px";
	r_top.style.cursor = "ns-resize"; 

	r_left.style.top = "0";
	r_left.style.left = "0";
	r_left.style.width = "5px";
	r_left.style.height = "100%";
	r_left.style.cursor = "ew-resize";

	r_bottom.style.top = "100%";
	r_bottom.style.left = "5px";
	r_bottom.style.width = "100%";
	r_bottom.style.height = "5px";
	r_bottom.style.height = "ns-resize";

	p_shell.r_right = r_right;
	p_shell.appendChild(r_right);
	p_shell.r_left = r_left;
	p_shell.appendChild(r_left);
	p_shell.r_bottom = r_bottom;
	p_shell.appendChild(r_bottom);
	p_shell.r_top = r_top;
	p_shell.appendChild(r_top);
	
	let resize_options = {};
	r_right.onmousedown = (e) => {
		resize_options.side = "right";
		if (e.button === 0) utils.dragging(e, "down", p_shell, resizing, resize_options);
	};
	r_top.onmousedown = (e) => {
		resize_options.side = "top";
		if (e.button === 0) utils.dragging(e, "down", p_shell, resizing, resize_options);
	};
	r_left.onmousedown = (e) => {
		resize_options.side = "left";
		if (e.button === 0) utils.dragging(e, "down", p_shell, resizing, resize_options);
	};
	r_bottom.onmousedown = (e) => {
		resize_options.side = "bottom";
		if (e.button === 0) utils.dragging(e, "down", p_shell, resizing, resize_options);
	};
	if (options.docked.startsWith("left-")) r_left.style.visibility = "hidden";
	else if (options.docked.startsWith("right-")) r_right.style.visibility = "hidden";
	if (options.docked.endsWith("-top")) r_top.style.visibility = "hidden";
	if (options.docked.endsWith("-bottom")) r_bottom.style.visibility = "hidden";
	if (options.docked.endsWith("-both")){
		r_top.style.visibility = "hidden";
		r_bottom.style.visibility = "hidden";
	}
	return p_shell;
}

function resizing(evt, element, moved, options){
	if (options.side === "right" || options.side === "left"){
		// element.style.width = element.clientWidth + moved.dx + "px";
		let test_width = evt.clientX - parseFloat(element.getBoundingClientRect().left);
		element.style.width = Math.min(
			Math.max(
				parseFloat(window.getComputedStyle(element).minWidth || 10), test_width
			), parseFloat(window.getComputedStyle(element).maxWidth) || 200
		) + "px";
	}
	else if (options.side === "bottom" || options.side === "top"){
		let test_height = evt.clientY - parseFloat(element.getBoundingClientRect().top);
		element.style.height = Math.min(
			Math.max(
				parseFloat(window.getComputedStyle(element).minHeight || 10), test_height
			), parseFloat(window.getComputedStyle(element).maxHeight || 200)
		) + "px";
	}
	else if (options.side === "top"){
		element.style.height = element.clientHeight - moved.dy + "px";
		if (element.clientHeight > parseInt(window.getComputedStyle(element).minWidth || "0")){
			element.style.top = parseInt(element.style.top || "0") + moved.dy + "px";
		}
	}
}