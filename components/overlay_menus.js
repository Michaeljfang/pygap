export function widget_rename(){
	let rename_ui = document.createElement("div");
	rename_ui.className = "context_menu";
	let title = document.createElement("div");
	let entry = document.createElement("input");
	let confirm = document.createElement("button");
	confirm.innerText = "OK";
	entry.type = "text";
	entry.classList = "text_input horizontally_margined";
	title.classList = "horizontally_margined";
	confirm.classList = "horizontally_margined";
	title.innerText = "Rename widget";
	entry.maxLength = 512;
	rename_ui.entry = entry;
	rename_ui.confirm = confirm;
	rename_ui.appendChild(title);
	rename_ui.appendChild(entry);
	rename_ui.appendChild(confirm);
	return rename_ui;
}

export function widget_menu(){
	let menu = document.createElement("div");
	menu.className = "context_menu";
	return menu;
}