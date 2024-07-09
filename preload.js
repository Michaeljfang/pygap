// import * as Widget from "./components/widget.js";

const {
	contextBridge, ipcRenderer,
} = require('electron');

const backend_refs = {
	wstyles: fetch("./frontend_refs/widget_styles.json", {method: "GET"}).then(r=>r.json()),
	search_dict: fetch("./backend/search_dictionary.json", {method: "GET"}).then(r=>r.json()),
	gui_params: fetch("./frontend_refs/gui_params.json", {method: "GET"}).then(r=>r.json()),
}


contextBridge.exposeInMainWorld("electronAPI", {
	open_file: () => ipcRenderer.invoke("dialog:open_file"),
	nodetest: () => ipcRenderer.invoke("debug:nodetest"),
	zmqtest: () => ipcRenderer.invoke("debug:zmqtest"),
	widget_get_info: () => ipcRenderer.invoke("widget:get_info"),
	backend_refs: backend_refs,
	add_new_widget: (args) => ipcRenderer.invoke("widget:add_new_widget", args),
	delete_widgets: (args) => ipcRenderer.invoke("widget:delete_widgets", args),
	widget_update_in_out: (args) => ipcRenderer.invoke("widget:update_in_out", args),
	widget_set_params: (args) => ipcRenderer.invoke("widget:set_params", args),
	send_java: (args) => ipcRenderer.invoke("send_java", args),
	run_exp: (args) => ipcRenderer.invoke("exp:run_exp", args),
})
// make window vars available in renderer


/////////////////////////////////////////////////
