
import * as witem from "./render_witem.js"

export function init(p){
	p.module_search = document.getElementById("module_search"); // search text box
	if (p.module_search === null) throw Error("search box not found.");
	p.match_list = document.createElement("div");
	p.match_list.className = "search_list";

	p.filter_list = document.createElement("div");

	let backend_filters = {
		JavaAPI: {input: document.createElement("input"), label: document.createElement("label")},
		PyAPI: {input: document.createElement("input"), label: document.createElement("label")},
		Js_API: {input: document.createElement("input"), label: document.createElement("label")},
	}
	let filters_container = document.createElement("div");
	p.filters_container = filters_container;
	for (let [el_name, el] of Object.entries(backend_filters)){
		el.input.setAttribute("type", "checkbox");
		el.input.setAttribute("id", `main_panel_be_filter_${el_name}`);
		el.label.setAttribute("for", `main_panel_be_filter_${el_name}`);
		el.label.innerText = el_name;
		el.input.checked = true;
		el.input.oninput = e => search(e);
		p.filters_container.appendChild(el.input);
		p.filters_container.appendChild(el.label);
		p.filters_container.appendChild(document.createElement("br"));
	}
	p.p_content.appendChild(p.filters_container);
	p.p_content.appendChild(p.match_list);

	let search = (e) =>{
		let query = p.module_search.value.trim().toLowerCase().replaceAll("-", " ");
		if (!p.module_search.value.length){
		} else {
			p.match_list.innerHTML = "";
			for (let backend of Object.keys(window.backend_refs.widget_info)){
			// for (let backend of ["PyAPI", "JavaAPI", "Js_API"]){
			// 	if (!(backend in window.backend_refs.widget_info)) {
			// 		console.log(`${backend} not in widget_info`)
			// 		continue;
			// 	}
			if (!backend_filters[backend].input.checked) continue;
				for (let mod_name of Object.keys(window.backend_refs.widget_info[backend])){
					let mod_name_search = mod_name.toLowerCase().replaceAll("-", " ");
					if (!expand_search(query, mod_name_search)) continue;
					let match_item = document.createElement("div");
					// ^^ match item container. Has text and button segments.
					match_item.className = "search_match_item";
					let mod_type = window.backend_refs.widget_info[backend][mod_name].mod_type;
					let match_item_name = document.createElement("div");
					match_item_name.innerText = backend + " > " + mod_type + " > " + mod_name;
					let match_add = document.createElement("button");
					match_add.className = "search_add_button";
					match_add.innerText = "Add";
					match_add.style.position = "relative";
					match_add.style.right = "0";
					match_add.onclick = async e => {
						await window.funcs.add_widget({mod_name: mod_name, backend: backend});
					}
					match_item.appendChild(match_item_name);
					match_item.appendChild(match_add);
					p.match_list.appendChild(match_item);
				}
			}
		}
	}
	p.module_search.oninput = e => search(e);

	p.run_box = document.createElement("div");
	p.id = "main_panel_run_box";

	p.run_box_options = witem.wcoptions(null, ["Run all", "Run previews", "Run outputs"], "Run all");
	p.run_button = document.createElement("button");
	p.run_button.innerText = "Start experiment";
	p.run_box.style.width = "calc(100% - 10px)";
	p.run_box.style.margin = "5px";

	p.run_box.appendChild(p.run_box_options);
	p.run_box.appendChild(p.run_button);
	p.p_content.appendChild(p.run_box);



	p.view_options_box = document.createElement("div");
	p.reset_view_button = document.createElement("button");
	p.reset_view_button.innerText = "Reset View";
	p.reset_view_button.style.width = "calc(100% - 10px)";
	p.reset_view_button.style.margin = "5px";
	p.view_options_box.appendChild(p.reset_view_button);
	p.p_content.appendChild(p.view_options_box);

}


function expand_search(query, mod_name){
	if (mod_name.includes(query)){return true;}
	// I miss list comprehension but this is pretty cool too
	// "".join([i[0] for i in mod_name.split()])
	let mod_name_initials = Array.from(mod_name.toLowerCase().split(/ +/), (i)=>i[0]).join("");
	if (mod_name_initials.includes(query)){return true;}
	for (let key of Object.keys(window.backend_refs.search_dict.forwards)){
		if(key.includes(query)){
			for(let alt_term of window.backend_refs.search_dict.forwards[key]){
				if (mod_name.includes(alt_term)){
					return true;
				}
			}
		}
	}
	return false;
}

function search_modules(query, listbox, search_from){
	query = query.trim().toLowerCase().replaceAll("-", " ");
	// first clear listbox
	while (listbox.length > 0){listbox.remove(listbox.remove(listbox.length-1));}

	for (let mod_name of Object.keys(search_from)){
		let mod_name_search = mod_name.toLowerCase().replaceAll("-", " ");
		if (expand_search(query, mod_name_search)){
			listbox.add(new Option(mod_name, mod_name));
		}
	}
}