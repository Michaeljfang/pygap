# API for managing Python modules in use.
# It Adds, deletes, sets params of, and runs Python-based PyGAP modules.
# Ok to raise errors. Errors will be handled in messenger.py

# @author: Michael

from importlib import import_module
from backend import PyUtils

mods = [
	"am_0", "am_pytorch", "am_sklearn", "cc_0", "cc_1", "df_0", "df_JSDivergence",
	"ec_0", "ed_0", "nc_0", "nc_1_roberta"
]

class PyAPI:
	"""If using Electron node-based front-end, errors raised here are handled in the calling function."""
	def __init__(self):
		from backend import module
		# from backend.py_modules import proof_of_concept
		from backend.py_modules import am_0, am_sklearn, cc_0, df_0, ec_0, ed_0, nc_0, nc_1_roberta, utilities
		# in later versions this will be a block of imports

		self.modules = dict()
		for t in module.Module.__subclasses__():
			for c in t.__subclasses__():
				self.modules[c.displayName()] = c		


		# gather in/out, description, params for mods

		# DO NOT COMBINE IN_OUT and PARAM_OPTIONS HERE. (first get info call)
		# BECAUSE NEED TO DO IT EVERY TIME WHEN PARAMS NEED UPDATING.
		self.mods_info = {
			name:{
				"live": self.modules[name]._live if "_live" in self.modules[name].__dict__ else False,
				"desc": self.modules[name].displayDescription(), #string
				"in_out": self.modules[name].in_out(), # dict
				"mod_type": self.modules[name].mro()[1].__name__, # string
				"param_options": PyUtils.param_options_cleanup(self.modules[name].__dict__["_variable_options"])
					if "_variable_options" in self.modules[name].__dict__ else {}
			}
			for name in list(self.modules.keys())
		}

		self.mods_in_use = dict()

	def param_options_cleanup(self, var_opts: dict) -> dict:
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

	def add_new_widget(self, options):
		assert 'id' in options, "Adding a new widget requires a string ID"
		print("API: add_new_widget, options:", options)
		if options["mod_name"] not in self.modules:
			# module not found.
			raise ValueError(str(options["mod_name"]) + " module not found.")
		self.mods_in_use[options['id']] = self.modules[options["mod_name"]]()
		return 0

	def delete_widget(self, options):
		assert 'ids' in options, "Deleting a widget requires one or multiple string IDs"
		print("API: delete_widget, options:", options)
		ids = options['ids'] if type(options['ids']) == list else [options['ids']]
		for i in ids:
			self.mods_in_use.pop(i)
		return 0
	
	def clear_mods(self):
		del self.mods_in_use
		self.mods_in_use = dict()
		return 0

	def set_mod_param(self, mod_id, var, value, ignore_invalid=True):
		"""Sets mod user-modifiable param. (i.e. param name doesn't start with _)"""
		assert (type(mod_id) == str), "mod id must be a string"
		assert (mod_id in self.mods_in_use.keys()), "module %s does not exist in this Python backend." % mod_id
		if (var[0] == "_") or (var not in self.mods_in_use[mod_id]._variable_options):
			if ignore_invalid: return 0
			else: raise ValueError(f'{var} not found for module with ID: {mod_id}')
		if "dtype" in self.mods_in_use[mod_id]._variable_options[var]:
			if self.mods_in_use[mod_id]._variable_options[var]["dtype"] == "int":
				value = int(value)
			elif self.mods_in_use[mod_id]._variable_options[var]["dtype"] == "float":
				value = float(value)
			elif self.mods_in_use[mod_id]._variable_options[var]["dtype"] == "str":
				value = str(value)
		self.mods_in_use[mod_id].set_attr(var, value)
		print("set mod params in PyAPI")
		return 0

	def batch_set_params(self, value_dict, **options):
		'''
		sets params for all listed ids and user-modifiable params
		(ignoring those whose names start with _)
		value_dict form:
			{
				<id>: {
					<param>: <value>, ...
				}, ...
			}
		options: currently empty.
		'''
		if not bool(self.exists({"ids": list(value_dict.keys())})): return 1 # error

		for mod_id in value_dict:
			for var in value_dict[mod_id]:
				if (var[0] == "_") or (var not in self.mods_in_use[mod_id]._variable_options):
							raise ValueError(f'variable "{var}" not found for module with ID: {mod_id}')
				if "dtype" in self.mods_in_use[mod_id]._variable_options[var]:
					if self.mods_in_use[mod_id]._variable_options["dtype"][var] == "int":
						value = int(value)
					elif self.mods_in_use[mod_id]._variable_options["dtype"][var] == "float":
						value = float(value)
					elif self.mods_in_use[mod_id]._variable_options["dtype"][var] == "str":
						value = str(value)
				self.mods_in_use[mod_id].set_attr(var, value)

		return 0


	# def run_schedule(self, mod_list: list[dict], initial_input, **options):
	# 	"""
	# 	Runs the modules in order presented in mod_list. Use cache if available.
	# 	Returns the result of the last module as a string.
	# 	Reports intermediate info.
	# 	options:
	# 		use_cache: bool = True
	# 	"""
	# 	use_cache = options.get("use_cache", True)
	# 	for mod in mod_list:
	# 		...

	def get_cache(self, options) -> dict:
		"""
		Get saved cache from a mod/multiple mods. Returns dict.
		Cache is saved to widget._cache when a widget is run.
		"""
		assert "ids" in options, 'get_cache() requires "ids"'
		strict = options.get("strict", False) # if strict, raise error if any don't match.
		ids = options.get("ids")
		caches = dict()
		for i in ids:
			if (i not in self.mods_in_use) and strict: raise ValueError("get_cache() strict mode: mod %s not found." % i)
			if "_cache" not in self.mods_in_use[i].__dict__ and strict: raise ValueError("get_cache() strict mode: mod %s has no cache." % i)
			caches[i] = self.mods_in_use[i]._cache
		return caches

	def clear_cache(self, options):
		"""clear cache"""
		for mod_id in self.mods_in_use:
			self.mods_in_use[mod_id]._cache = None
		return 0

	def exists(self, options):
		"""check if mod(s) exist(s). options.ids is required to be a list"""
		if "ids" not in options: raise ValueError('widgets:exists() requires "ids"')
		ids = [options["ids"]] if type(options["ids"]) == str else options["ids"] # just in case
		for i in ids:
			if i not in self.mods_in_use:
				return 0
		return 1

