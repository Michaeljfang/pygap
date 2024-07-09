const {
	app, BrowserWindow, ipcMain, dialog, Menu, MenuItem
} = require("electron");

const run_exp = require("./components/run_experiment.js");

// import * as API from "./backend/js_modules/jsAPI.js";
const API = require("./backend/js_modules/jsAPI.js");
var js_API = null;

// IPC with any backend
const zmq = require("zeromq");
const fs = require("fs");

// i mean it's gonna be a dict so const doesn't really do anything lmao
const backends = JSON.parse(fs.readFileSync("./backend_refs/messaging.json", "utf-8",
	(error, contents) => {
		if (error){
			console.error(`Loading socket info failed.\n${error}`);
			app.quit();
			return false;
		}
		return contents;
	}
))

// const backends = JSON.parse(bstring);
for (let messenger of Object.keys(backends)){
	if (!("spawn" in backends[messenger])) continue;
	backends[messenger].socket = new zmq.Request({backlog: 99});
	backends[messenger].socket.connect(backends[messenger].address);
	backends[messenger].socket.receive = 1000;
}

console.log("MESSEGING", backends);


var be_widget_info = null;

/** start all backends */
function start_backends(){
	let success = 0;
	for (let item of Object.keys(backends)){
		if (!("spawn" in backends[item])){
			console.log(`No command found for ${item} in ./backend_refs/messaging.json, skipped.`);
			continue;
		}
		console.log(`Starting ${item}`)
		try{
			backends[item].process = require('child_process').spawn(
				backends[item].spawn[0],
				(backends[item].spawn.length > 1 ? backends[item].spawn[1] : [])
			);
			if (typeof backends[item].process === "undefined" ||
			typeof backends[item].process === null) throw Error;
			// error text would be same as that in catch-block.
			success++;
			console.log("ok")
		} catch {
			console.log(item, "failed to start, some modules may be unavailable.")
			backends[item].process = null;
			continue;
		}
	}
	if (!success){
		console.log("All backends failed to start. Exiting.");
		app.quit();
	}
}

function exit_backends(){
	for (let p of Object.keys(backends)){
		backends[p].process.kill();
	}
}

// function run_py (){
// 	console.log("Starting Python backend");
// 	try {
// 		py_proc = require('child_process').spawn('python3', ["messenger.py"]);
// 	} catch {
// 		console.log('Failed to start Python backend.');
// 		app.quit();
// 	}
// 	if (typeof py_proc === 'undefined' || py_proc === null) {
// 		console.log('Failed to start Python backend.');
// 		app.quit();
// 	}
// 	console.log("ok");
// }

// function exit_py(){
// 	console.log("Shutting down Python backend");
// 	py_proc.kill();
// 	py_proc = null;
// }

async function zmq_test() {
	await backends.py_messenger.socket.send("abc");
	var [result] = await backends.py_messenger.socket.receive();
	
	result = Buffer.from(result).toString("utf-8");
	console.log(result);
}

function nodetest(){
	let b;
	if ((typeof process !== 'undefined') && 
	(process.release.name.search(/node|io.js/) !== -1)) {
		b = 'this script is running in Node.js';
	} else {
		b = 'this script is not rawaitunning in Node.js';
	}
	return b;
}

async function send_java(){
	console.log("sending java")
	let serialized = JSON.stringify(["echo:test"].concat(["item1", "item2"]))
	await backends.Java_API.socket.send(serialized);
	let [result] = await backends.Java_API.socket.receive().catch(()=>{return ""});
	if (!result) return {"status": 1, "message": "Error sending java"};
	result = Buffer.from(result).toString("utf-8");
	result = JSON.parse(result);
	if (result.status !== 0) throw Error(result);
	return result;
}
/////////////////////

const path = require("path");

const create_window = () => {
	const win = new BrowserWindow({
		width: 1280,
		height: 720,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
		}
	})
	win.loadFile("main.html");
};

async function handle_file_open(){
	const file_dialog_return = await dialog.showOpenDialog();
	return file_dialog_return;
}


/////////////////////////////////////////////////////////////

function validate_graph() {
	// no cycles allowed unless special loop node?
	// TODO
}

/**
 * combine all input/output specifications to "in_out".
 * This is needed because sometimes widget input, output are specified separately from parameters,
 * and most parameters are treated as a type of input in the Eletron GUI.
 * 
 * Different backends may need different processes.
 * 
 * @param {dict} result a dict where keys are mod_names or class_names and
 * values contain "in_out" and "param_options"
 * @param {string} target backend.
 */
function widget_info_process(result, target){
	if (target === "PyAPI"){
		for (let mod_name of Object.keys(result)){
			if (!("param_options" in result[mod_name])) continue;
			result[mod_name].in_out.in = {
				...result[mod_name].in_out.in,
				// ...result[mod_name].param_options
			}
		}
	} else if (target === "JavaAPI"){
		for (let mod_name of Object.keys(result)){
			if (!("param_options" in result[mod_name])) continue;
			result[mod_name].in_out.in = {
				...result[mod_name].in_out.in,
				...result[mod_name].param_options
			}
		}
	} else if (target === "Js_API"){
		for (let mod_name of Object.keys(result)){
			if (!("in_out" in result[mod_name])
				|| result[mod_name].in_out === undefined) continue;
			result[mod_name].in_out.in = {
				...result[mod_name].in_out.in,
				// ...result[mod_name].param_options
			}
		}
	} else throw new Error("Unknown backend")
	return result;
}

/** calls individual backend to get widget info */
async function widget_get_info_backend(target=null){
	if (target === null) throw Error("no target specified");
	await backends[target].socket.send(["widget:get_info"]);
	let [result] = await backends[target].socket.receive().catch(()=>{return ""});
	if (!result) return {"status": 1, "message": "Error getting widget info"};
	result = Buffer.from(result).toString("utf-8");
	result = JSON.parse(result);
	if (result.status !== 0 || !("content" in result)) throw Error(result.message);

	for (let mod of Object.keys(result.content)){
		result.content[mod].backend = target;
	}
	return result;
}
/** gets widget info from all backends */
async function widget_get_info(){
	let widget_info = {status:1, content: {}};
	js_API = new API.Js_API();

	for (let be of Object.keys(backends)){
		// "be" = widget_info_process PyAPI, JavaAPI, etc.
		if (!("spawn" in backends[be])) continue;
		let be_info = await widget_get_info_backend(be);
		let be_info_content = widget_info_process(be_info.content, be);
		widget_info.content[be] = be_info_content;
		console.log(`got ${be}`);
	}
	widget_info.content["Js_API"] = widget_info_process(js_API.mods_info, "Js_API");
	widget_info.status = 0;
	be_widget_info = widget_info.content;
	return widget_info;
}

async function add_new_widget(args){
	let options = JSON.stringify(args[0])
	let result;
	if (args[0].backend === "Js_API"){
		try {
			result = {status: 0, content: js_API.add_new_widget(args[0])};
		} catch (error) {
			result = {status: 1, message: error};
		}
	} else {
		await backends[args[0].backend].socket.send(["widget:add_new_widget"].concat([options]));
		[result] = await backends[args[0].backend].socket.receive()
			.catch(s=>{return s;})
			.then(r=>{return r;});
		result = Buffer.from(result).toString("utf-8");
		result = JSON.parse(result);
	}
	if (!("status" in result) || result.status !== 0) throw Error(Object.keys(result).map(x=>result[x]));
	return result;
}

async function delete_widgets(args, target="PyAPI"){
	let options = JSON.stringify(args)
	await backends[target].socket.send(['widget:delete_widgets'].concat([options]));
	let [result] = await backends[target].socket.receive()
		.catch(s=>{console.log("main.js delete_widgets error", s); return "";})
		.then(r=>{return r;});
	result = Buffer.from(result).toString("utf-8");
	result = JSON.parse(result);
	if (!("status" in result) || result.status !== 0) throw Error(result);
	return result;
}



/**
 * checks in_out of a widget. This function does not set params.
 * @param {dict} args [{backend: widget.backend, id: widget.id}]
 * @returns 
 */
async function update_in_out(args){
	let options = JSON.stringify(args[0])
	let result;
	if (args[0].backend === "Js_API"){
		// don't use "options". use args[0].
		try {
			let content = {}; content[args[0]["id"]] = {
				// param_options: js_API.mods_in_use[args[0].id]._param_options,
				in_out: js_API.mods_in_use[args[0].id].in_out()
			};
			result = {status: 0, content: content};
		} catch (error) {
			result = {status: 1, message: error};
		}
	} else {
		await backends[args[0].backend].socket.send(["widget:update_in_out"].concat([options]));
		[result] = await backends[args[0].backend].socket.receive()
			.catch(s=>{return s;})
			.then(r=>{return r;});
		result = Buffer.from(result).toString("utf-8");
		result = JSON.parse(result);
	}
	if (!("status" in result) || result.status !== 0) throw Error(Object.keys(result).map(x=>result[x]));
	result.content = widget_info_process(result.content, args[0].backend);
	return result;
}

async function debug_clear_py_mods(){
	backends["PyAPI"].socket.send(["debug:clear_mods"]);
	[result] = await backends["PyAPI"].socket.receive()
		.catch(s=>{return s;})
		.then(r=>{return r;});
	result = Buffer.from(result).toString("utf-8");
	result = JSON.parse(result);
}

/**
 * Set module parameters in the backend.
 * @param {dict} args 
 */
async function set_params(args){
	let options = JSON.stringify(args[0])
	let result;
	for (let mod of Object.values(args.widget_list)){
		let m = JSON.stringify(mod);
		if (mod.backend === "Js_API"){
			try{
				for (let [param, val] of Object.entries(mod.mod_params)){
					js_API.set_mod_param(mod.id, param, val);
				}
			} catch (error) {
				result = {status: 1, message: error};
			}
		} else {
			await backends[mod.backend].socket.send(["widget:set_params"].concat([m]));
			[result] = await backends[mod.backend].socket.receive()
				.catch(s=>{return s;})
				.then(r=>{return r;});
			result = Buffer.from(result).toString("utf-8");
			result = JSON.parse(result);
		}
	}
	return result;
}

/**
 * Called either from the user-end or here.
 * @param {dict} args {widget_list: {...}, ...}
 */
async function batch_set_params(args){
	// consolidate the widgets into dicts by backends.
	// reduces number of requests to the backends.
	console.log("main.js -> batch_set_params")
	let widgets_by_backend = {};
	for (let [wid, w] of Object.entries(args.widget_list)){
		if (!("id" in w) || !("backend" in w)){
			throw Error("set_widget_params(): items in args.widget_list must have both 'id' and 'backend'.")
		}
		if (!(w.backend in widgets_by_backend)) widgets_by_backend[w.backend] = {}
		widgets_by_backend[w.backend][wid] = w;
	}
	let return_results = {status: 0, message: "", content: ""}
	for (let [be, be_widgets] of Object.entries(widgets_by_backend)){
		if (be === "Js_API"){
			try {
				js_API.set_params(be_widgets);
			} catch (error) {
				return_results = {status: 1, message: error};
			}
		} else {
			await backends[be].socket.send(["widget:batch_set_params"].concat([JSON.stringify(
				{widget_list: be_widgets, global_params: []}
			)]));
			[result] = await backends[be].socket.receive()
					.catch(s=>{return s;})
					.then(r=>{return r;});
				result = Buffer.from(result).toString("utf-8");
				result = JSON.parse(result);
			if (result.status !== 0){
				return_results = result;
				break;
			}
		}
	}
	console.log("batch_set_params RETURN RESULTS", return_results)
	return return_results;
}

///////////////////////////////////////////////////////////////////
/**
 * 
 * @param {dict} args expected to be {widget_list: {...}, global_settings: {...}}
 */
async function be_run_exp(args){
	console.log("backend start run exp")
	/*
	args:
		widget_list: ...
		global_settings: ...
	*/
	// first set params and check that the widgets in use actually exist in the backends.
	for (let mod of Object.values(args.widget_list)){
		// check live_only here.
		// (not yet implemented)

		// check that each input either has a value or a connection
		// connection takes precedence over values.
		mod.params = mod.conns.in;
		for (let [c_name, c_content] of Object.entries(mod.conns.in)){
			if (c_content.target == null && c_content.value == null){
				return {
					status: 1, content: "", message:
					`[main.js] ${mod.id}.${c_name} (displayed_name = ${c_content.displayed_name}) does not have an incoming connection or a value where one required.`
				}
			}
		}
	}
	console.log("be_run_exp checked exists.")

	console.log("batch_set_params()")
	let set_params_result = await batch_set_params(args);
	console.log("WIDGET LIST", args)

	if (set_params_result.status !== 0){
		// error setting params./
		console.log("error setting params")
	}

	// find out what order to run the widgets
	let exe_order = run_exp.schedule(args.widget_list);
	console.log("obtained schedule", exe_order, args.widget_list);

	// send parameters for the widgets.

	// run the widgets
	console.log("starting exp")
	let exp_results = run_exp.run_widgets(exe_order /* global settings */);



	console.log("finished exp");
	return {status: 0, content: "placeholder exp results", message: ""}
}

// menu ///////////////////////////////////////////////////////////
// const isMac = (process.platform === 'darwin');

// let app_menu = new Menu();
// app_menu.insert(0, new MenuItem(click=(e => console.log("menu")), label="memm"))

// Menu.setApplicationMenu(app_menu)

console.log("TODO: NEED TO IMPLEMENT JAVA API's inOut() for all widgets, update_in_out and set_params in Messenger.java")

/////////////////////////////////////////////////////////////////////
// app.on('ready', run_py);
// app.on('will-quit', exit_py);
// let [result] = await backends[messenger].socket.receive()
// 		.catch(s=>{console.log("system:startup", s); return "";})
// 		.then(r=>{return r;});

app.whenReady().then(() => {
	debug_clear_py_mods();
	ipcMain.handle("dialog:open_file", handle_file_open);
	ipcMain.handle("debug:nodetest", nodetest);
	ipcMain.handle("debug:zmqtest", zmq_test);

	ipcMain.handle("widget:get_info", e => widget_get_info());
	ipcMain.handle("widget:add_new_widget", (evt, args) => add_new_widget(args));
	ipcMain.handle("widget:delete_widgets", (evt, args) => delete_widgets(args));
	ipcMain.handle("widget:update_in_out", (evt, args) => update_in_out(args));
	ipcMain.handle("widget:set_params", (evt, args) => batch_set_params(args));

	ipcMain.handle("exp:run_exp", (evt, args) => be_run_exp(args));

	ipcMain.handle("send_java", (evt, args) => send_java(args));

	create_window();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) create_window();
	})
}).catch((e) => {console.log(e)});


app.on("window-all-closed", () => {
	if (process.platform !== "darwin"){app.quit();}
});

// end starting and shutting down app
////////////////////////////////////////////////////////////////////////////////////////
