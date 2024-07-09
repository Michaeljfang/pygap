


def param_options_cleanup(var_opts: dict) -> dict:
	return {
		param: ({
			poption: var_opts[param][poption]
			for poption in var_opts[param]
			if poption != "validator" and poption != "options"
			# TODO ^^ convert range to serializable
		} | {
			"options": var_opts[param]["options"]
			if type(var_opts[param]["options"]) == list
			else list(var_opts[param]["options"])
		})
		for param in var_opts
	}