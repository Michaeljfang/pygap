// import * as builtin from "./builtin.js";
const builtin = require("./builtin.js");

class Js_API {
    mods_in_use = {};
    modules = {}
    mods_info = {};
    constructor(){
        for (let c of builtin.Js_base.subclasses){
            this.modules[c.displayName()] = c;
            this.mods_info[c.displayName()] = {
                desc: c.displayDescription(),
                in_out: c.in_out(),
                mod_type: c._mod_type,
                live: ("_live" in c) ? c._live : false,
                output: ("_is_output" in c) ? c._is_output : false,
                preview: ("_preview" in c) ? c._preview : false,
                // ^^ need iterative method for static fields.
                param_options: c._param_options,
                backend: "Js_API"
            }
        }
        console.log("Built-in modules (js) ready");
    }

    add_new_widget(options){
        if (!("id" in options)) throw Error("Adding a new widget requires a string ID");
        if (!("mod_name" in options)) throw Error("mod_name required");
        if ((this.modules[options.mod_name]) === undefined) throw Error(`${options.mod_name} not found in modules.`);
        this.mods_in_use[options.id] = new this.modules[options.mod_name]();
        // needs to return what the current user variables are.
        return this.mods_in_use[options.id];
    }
    delete_widget(options){
        if (!("ids" in options)) throw Error("Deleting a widget requires one or more string IDs (options.ids)");
        let del = typeof options.ids === "string" ? [options.ids] : options.ids;
        for (let d of del){
            delete del[d];
        }
    }
    /**
     * set value for a mod. used by front end before calling in_out to update in/out changes.
     * @param {String} id string ID
     * @param {String} param string param
     * @param {String} value value
     */
    set_mod_param(id, param, value){
        if (typeof id !== "string") throw new Error("Module ID must be a string");
        if (!(id in this.mods_in_use)) throw new Error(`Module ${id} not found in built-in Js_API.`);
        if (param.startsWith("_") || !(param in this.mods_in_use[id]._param_options)){
            throw new Error(`Attribute "${param}" not found for module with ID ${id}.`);
        }
        this.mods_in_use[id].set_attr(param, value);
        return 0;
    }

    /**
     * 
     * @param {dict} widget_list {<id>: {params: {<param>: {value: ..., ?dtype: ...,}}}, ...}
     */
    set_params(widget_list){
        for (let [wid, widget] of Object.entries(widget_list)){
            if (!(wid in this.mods_in_use)) throw Error(`Module ${wid} not found in built-in Js_API.`);
            for (let [cname, param_info] of Object.entries(widget.params)){
                if (cname.startsWith("_") || !(cname in this.mods_in_use[wid]._param_options)){
                    throw new Error(`Attribute "${cname}" not found for module with ID ${wid}.`);
                }
                let val = param_info.value;
                if (!("dtype" in param_info) || param_info.dtype == null || param_info.dtype === "str"){
                    val = String(val);
                } else if (param_info.dtype.toLowerCase() === "float"){
                    val = parseFloat(val);
                } else if (param_info.dtype.toLowerCase() === "int"){
                    val = parseInt(val);
                }
                this.mods_in_use[wid].set_attr(cname, val);
            }
        }
        return 0;
    }
}

module.exports.Js_API = Js_API;
