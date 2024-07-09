class Js_base {
	static subclasses = new Set();
	constructor(){
		if (new.target === Js_base) throw new TypeError("Don't use Js_base. Find its subclasses instead.");
		let carried_variables = ["_mod_type", "_live", "_param_options"];
		for (let param of carried_variables){
			if (param in new.target){
				this[param] = new.target[param];
			}
		}
		this.after_init();
	}

	after_init(){}
	// _param_options = {};
	static _error = () => {throw new ReferenceError("Abstract method not implemented");};
	static displayName() {return "Js_base";}
	static displayDescription() {return "base class from which mod_type classes are inherited.";}
	static in_out(){this._error();}
	in_out(){this._error();}
	process(){this._error();}
	set_attr(param, value){
		this[param] = value;
	}
	static _param_options = {};
}

class Generic extends Js_base {
	static {Js_base.subclasses.add(this)};
	static _param_options = {}
	static in_out(){}
	static displayName() {return "Generic";}
	static displayDescription() {return "Generic module. Never used.";}
	static process(){}
}


class Float_math extends Js_base {

	// idea: this module will call the appropriate backend depending on
	// the backend of the input and output widget.
	// e.g. if both input and output are both Python, this widget calls
	// a math module in python to process to avoid ipc. i.e. the data doesn't need
	// to be passed around processes

	static {Js_base.subclasses.add(this)};
	static _live = true; // live mode available: instant output.
	static _mod_type = "Utilities";

	constructor(){
		super();
	}

	mode = "Add";
	static _modes = [
		"||Functions", "Add", "Subtract", "Multiply", "Divide", "Modulo", "Integer Division",
		"||", "Power", "Logarithm", "Absolute Value", //"Exponent",
		"||Comparison", "Minimum", "Maximum", "A less than B", "A greater than B",
		// "Sign",
		// "Round",
		"||Rounding", "Floor", "Ceiling", "Truncate",
		"||Trignometry", "Sine", "Cosine", "Tangent", "Arcsine", "Arccosine", "Arctangent",
		"Hyperbolic Sine", "Hyperbolic Cosine", "Hyperbolic Tangent",
		"||Convert", "To Radians", "To Degrees"
	]
	static _param_b = {
		"Add": true, "Subtract": true, "Multiply": true, "Divide": true, "Modulo": true, "Integer Division": true,
		"Power": true, "Logarithm": true, "Absolute Value": false, //"Exponent": true,
		"Minimum": true, "Maximum": true, "A less than B": true, "A greater than B": true,
		// "Sign": false,
		// "Round": false,
		"Floor": false, "Ceiling": false, "Truncate": false,
		"Sine": false, "Cosine": false, "Tangent": false, "Arcsine": false, "Arccosine": false, "Arctangent": false,
		"Hyperbolic Sine": false, "Hyperbolic Cosine": false, "Hyperbolic Tangent": false,
		"To Radians": false, "To Degrees": false
	}

	static _param_options = {
		"A": {options: [-1, 1], dtype: "number", default: 1000, type: "slider", resolution: 0.001, free_slide: true},
		"B": {options: [-1, 1], dtype: "number", default: 1000, type: "slider", resolution: 0.001, free_slide: true},
		"mode": {options: Float_math._modes, default: 1, update: true},
	}

	static in_out(){
		// the static version is a function to keep consistency,
		// i.e. the calling function only has to worry about calling "in_out()"
		return {"in": {
			"A": Float_math._param_options.A,
			"B": Float_math._param_options.B,
			"mode": Float_math._param_options.mode,
		}, "out": {"events": {"dtype": "number"}}};
	}
	in_out(){
		if (Float_math._param_b[this.mode])
			return {"in": {
				"A": Float_math._param_options.A,
				"B": Float_math._param_options.B,
				"mode": Float_math._param_options.mode,
			}, "out": {"events": {"dtype": "number"}}};
		else
			return {"in": {
				"A": Float_math._param_options.A,
				"mode": Float_math._param_options.mode,
			}, "out": {"events": {"dtype": "number", "type": "slider"}}};
	}

	static displayName() {return "Math";}
	static displayDescription() {return "Math on single numbers or a list of numbers.";}

	process(a, b){
		if (b !== undefined && a.length !== b.length) throw Error("Different array lengths");
		if (typeof a === "number" && typeof b === "number"){
			a = [a]; b = [b];
		}
		return Object.keys(a).map(x => this.process_single(a[x], b[x]));
	}
	/**
	 * provide some utility math functions
	 * @param {Number} a number input 
	 * @param {Number} b number input 
	 */
	process_single(a, b){
		switch(this.mode){
			case "Add": return a + b;
			case "Subtract": return a - b;
			case "Multiply": return a * b;
			case "Divide": return (b === 0) ? NaN : a / b;
			case "Modulo": return a % b;
			case "Integer Division": return parseInt(a / b);
			case "Power": return Math.pow(a, b);
			case "Logarithm": return (Math.log(a) / (b === undefined ? 1 : Math.log(b)));
			case "Absolute Value": return Math.abs(a);
			case "A less than B": return a < b;
			case "A greater than B": return a > b;
			case "Floor": return Math.floor(a);
			case "Ceiling": return Math.ceil(a);
			case "Truncate": return parseInt(a);
			case "Sine": return Math.sin(a);
			case "Cosine": return Math.cos(a);
			case "Tangent": return Math.tan(a);
			case "Arcsine": return Math.asine(a);
			case "Arccosine": return Math.acos(a);
			case "Arctangent": return Math.atan(a);
			case "Hyperbolic Sine": return Math.sinh(a);
			case "Hyperbolic Cosine": return Math.cosh(a);
			case "Hyperbolic Tangent": return Math.tanh(a);

			case "Maximum": return Math.max(a, b);
			case "Minimum": return Math.min(a, b);
		}
	}
}


class Text_entry extends Js_base {
	static {Js_base.subclasses.add(this)};
	static _mod_type = "Generic_base";
	static _live = true; // live mode available: instant output.
	static _mod_type = "Utilities";
	static displayName(){return "Text";}
	static displayDescription(){return "Text input";}
	static _default_text = "Right click to edit"
	static in_out(){
		return {
			in: {
				input: {displayed_name: "input", type: "text", options: [Text_entry._default_text, ""], default: 0},
			},
			out: {
				text: {displayed_name: "text", dtype: "str"}
			}
		}
	}
	in_out(){
		return {
			in: {
				input: {displayed_name: "input", type: "text", options: [Text_entry._default_text, ""], default: 0},
			},
			out: {
				text: {displayed_name: "text", dtype: "str"}
			}
		}
	}
	process(){
		return this.input;
	}
	after_init(){
		this.input = Text_entry._default_text;
	}
}

// class Vector_math extends Js_base {

// 	static {Js_base.subclasses.add(this)};
// 	static _mod_type = "Generic_base";
// 	static _live = true; // live mode available: instant output.
// 	static _mod_type = "Utilities";
// 	static displayName(){return "Vector math";}
// 	static displayDescription(){return "Do math with vectors.";}
// 	static in_out(){}
// 	in_out(){}
// 	process(){}
// }

// class Import_text_data extends Js_base {

// 	static {Js_base.subclasses.add(this)};
// 	static _mod_type = "Generic_base";
// 	static _live = true; // live mode available: instant output.
// 	static _mod_type = "Utilities";
// 	static displayName(){return "Import texts";}
// 	static displayDescription(){return "Import text data";}
// 	static in_out(){}
// 	in_out(){}
// 	process(){}
// }

// class Import_image_data extends Js_base {

// 	static {Js_base.subclasses.add(this)};
// 	static _mod_type = "Generic_base";
// 	static _live = true; // live mode available: instant output.
// 	static _mod_type = "Utilities";
// 	static displayName(){return "Import Images";}
// 	static displayDescription(){return "Import image data";}
// 	static in_out(){}
// 	in_out(){}
// 	process(){}
// }

class Preview extends Js_base {

	static {Js_base.subclasses.add(this)};
	static _mod_type = "Generic_base";
	static _live = true; // live mode available: instant output.
	static _preview = 'number'; // has a preview window
	static _mod_type = "Utilities";
	static displayName(){return "Preview";}
	static displayDescription(){return "Preview output";}

	static _is_output = true;

	after_init(){
		this.input_type = Preview._param_options.input_type.options[Preview._param_options.input_type.default];
	}

	static _param_options = {
		input_type: {
			displayed_name: "input type",
			options: ["text", "image", "number"], default: 0, update: true,
		}
	}

	static in_out(){
		return {
			in: {
				input: {displayed_name: "input"},
				input_type: Preview._param_options.input_type,
			},
			out: {}
		}
	}
	in_out(){
		return {
			in: {
				input: {displayed_name: "input", type: null, dtype: this.input_type},
				input_type: Preview._param_options.input_type,
			},
			out: {}
		}
	}
	process(content){

	}
}

module.exports.Float_math = Float_math;
module.exports.Js_base = Js_base;
module.exports.Generic = Generic;
module.exports.Preview = Preview;
module.exports.Text_entry = Text_entry;