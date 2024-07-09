// validate python data types given javascript data types

export function py_int(data){
	if (typeof data !== "number" || ~~data !== data) return false;
	else return true;
}

export function py_float(data){
	return (typeof data === "number");
}

export function py_string(data){
	return (typeof data === "string")
}