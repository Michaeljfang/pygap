from abc import ABC, abstractmethod, abstractproperty
import numpy as np
from multiprocessing import Pool, cpu_count, Process, Pipe
import re
from unicodedata import normalize as unicode_normalize
import dictances as distances
from nltk import ngrams
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk import WordNetLemmatizer
from json import load as json_load
from pathlib import Path
from importlib import import_module
from sklearn.feature_extraction.text import CountVectorizer
from copy import deepcopy
from codecs import namereplace_errors

from backend import PyUtils


class Module(ABC):
	"""The most generic module type. Does not appear in GUI, but inherited by all other module types."""


	_global_parameters = {}
	def __init__(self, **options):
		try:
			for variable in self._variable_options:
				setattr(self, variable, self._variable_options[variable]["options"][self._variable_options[variable]["default"]])
		except AttributeError:
			self._variable_options = dict()
		self._global_parameters = self._global_parameters
		try: self.after_init
		except (AttributeError, NameError): return
		self.after_init(**options)

	def after_init(self, **options):
		return

	def in_out(self=None) -> dict:
		"""returns input and output types. should match the process function"""
		raise NotImplementedError()
		# return {"in": {}, "out": {}}

	@abstractmethod
	def process(self, process_input):
		return

	@abstractmethod
	def displayName():
		'''Returns the display name for the given analysis method.'''
		pass

	@abstractmethod
	def displayDescription():
		'''Returns the description of the method.'''
		pass

	def set_attr(self, var, value) -> bool | None:
		"""
		Custom way to set attributes.
		Return True if needs GUI to update parameter lists:
		good for dynamic param settings. e.g. selecting a particular option
		in an option menu makes a slider show up or disappear.
		"""
		self.__dict__[var] = value

	def validate_parameter(self, param_name: str, param_value) -> None:
		"""validating parameter expects param_value to already been correctly typed"""
		if param_name not in self._variable_options:
			raise NameError("Unknown parameter in module")
		validator = self._variable_options[param_name].get("validator")
		if validator != None:
			val_result = validator(param_value)
			if not val_result: raise ValueError("Module parameter out of range")
		elif param_value not in self._variable_options[param_name]["options"]:
			raise ValueError("Module parameter out of range")
		return

	@abstractmethod
	def process(self, process_input, pipe=None, **options):
		"""generic process function"""
		raise NotImplementedError()

	def process_single(self, single_process_input, **options):
		"""This is not an abstract method because it's optional."""
		raise NotImplementedError

class Generic_base(Module):
	_variable_options = dict()
	def displayName(): return "Generic_base"

# class Math(Module):
#     pass

# analysis
class AnalysisMethod(Module):
	
	'''
	The analysis method takes the known docs to train and predicts the labels of the unknown docs.
	It must be able to take one or a mix of dictinoaries, numpy arrays or scipy sparse arrays as training data.
	It calls backend.PrepareNumbers to make everything the same format.
	'''
	distance = None
	# _variable_options = dict() # do not set
	_global_parameters = dict()
	_NoDistanceFunction_ = False
	_cache = [None, None, None]

	def displayName(): return "AnalysisMethod"

	def get_train_data_and_labels(self, known_docs, train_data):
		"""get train data and labels, also sets self._labels_to_categories."""
		raise DeprecationWarning(
			"get_train_data_and_labels is deprecated.\n"
			"Get train data and labels with the following:\n\n"
			"from backend import PrepareNumbers as pn\n"
			"def process(self, train_data, train_labels, test_data, **options):\n"
			"\t...\n"
			"\ttrain_labels, self.labels_to_categories = pn.auth_list_to_labels(train_labels)\n"
			"\t...\n"
		)
		if train_data is None:
			train_data = tuple([d.numbers for d in known_docs])
			train_data = np.array(train_data)
		train_labels, self._labels_to_categories =\
			pn.auth_list_to_labels([d.author for d in known_docs])
		return train_data, train_labels

	def get_test_data(self, docs, options) -> np.ndarray:
		"""
		Aggregate test data into a single matrix,
		designed to take parameters from document list input of analyze.
		"options" is the "options" parameter passed to the AnalysisMethod.process() function.
		"""
		raise DeprecationWarning(
			"get_test_data is deprecated. test_data is now passed directly to AnalysisMethod.process()"
		)
		return options.get("unknown_numbers") \
			if "unknown_nubmers" in options \
			else np.array([d.numbers for d in docs if d.author == ""])

	def get_results_dict_from_matrix(self, scores: list[list[float]] | np.ndarray) -> dict[str: float]:
		"""
		returns the dictionary results per class from a scores matrix whose
		rows are test samples and whose columns are the known classes.
		"""
		if type(scores) != list:
			scores = scores.tolist()
		results = list()
		for doc in scores:
			doc_result = dict()
			for auth_index in range(len(doc)):
				doc_result[self._labels_to_categories[auth_index]] = doc[auth_index]
			results.append(doc_result)
		return results

	def sort_results(self, results: list[dict[str: float]], **options) -> list[dict[str: float]]:
		"""
		Sort categories by predicted value for each prediction.
		This is a wrapper to make invoking sorting easier.
		"""
		return [
			{
				f_key:f[f_key]
				for f_key in
				sorted(f.keys(), key=lambda x:f[x], reverse=options.get("reverse", 0))
			}
			for f in results
		]

	def setDistanceFunction(self, distance) -> None:
		'''Sets the distance function to be used by the analysis driver.'''
		self._distance = distance

	@abstractmethod
	def process(
		self,
		train_data: list[list[float]] | list[list[int]] | np.ndarray,
		train_labels: list[str] | list[int] | np.ndarray,
		test_data: list[list[float]] | list[list[int]] | np.ndarray,
		**options
	) -> list[dict[str: int]]:
		"""process function for analysis. takes in train data/label and test data, outputs dict."""
		return

	def in_out(self=None):
		return {"in": {
			"training set": {"dtype": "float", "type": None},
			"train labels": {"dtype": "str", "type": None},
			"testing set": {"dtype": "float", "type": None}
		} | (PyUtils.param_options_cleanup(self._variable_options) if self is not None else {}),
		"out": {"probabilities": {"dtype": "classifier"}}}

# Canonicizer
class Canonicizer(Module):
	_index = 0
	_global_parameters = dict()
	_default_multiprocessing = True
	_cache = [None]

	def displayName(): return "Canonicizer"

	def in_out(self=None):
		return {"in": {"text": {"dtype": "str", "type": "text"}
		} | (PyUtils.param_options_cleanup(self._variable_options) if self is not None else {}),
		"out": {"canonicized text": {"dtype": "str"}}}

	def process(self, docs: list[str], pipe=None) -> list[str]:
		"""
		process all docs at once, auto-call process_single.
		"""
		canon = []
		if self._default_multiprocessing:
			if pipe is not None: pipe.send(True)
			with Pool(max(cpu_count()-1, 1)) as p:
				canon = p.map(self.process_single, docs)
		else:
			for i, d in enumerate(docs):
				if pipe is not None: pipe.send(100*i/len(docs))
				canon.append(self.process_single(d))
		return canon


	def process_single(self, text: str):
		"""
		This is not an abstract method in the base class because
		it may not be present in some modules.
		Input/output of this may change. If changing input,
		also need to change the self.process() function.
		"""
		raise NotImplementedError
		

# Distance functions
class DistanceFunction(Module):
	_global_parameters = dict()
	_cache = [None, None]

	def displayName(): return "DistanceFunction"

	@abstractmethod
	def distance(self, unknownHistogram, knownHistogram):
		'''
		Input is the unknown and known histograms and output is the resulting distance calculation.
		"knownHistogram" can be a per-author histogram or per-document histogram.
		'''
		pass

	def in_out(self=None):
		return {"in": {
			"vectors": {"dtype": "float", "type": "Slider"}
		} | (PyUtils.param_options_cleanup(self._variable_options) if self is not None else {}),
		"out": {"distance": {"dtype": "float"}}}


# An abstract Embedding class.
class Embedding(Module):
	"""
	An embedder accepts the set of known documents
	and set the docs' representations directly to Document.numbers
	"""
	_global_parameters = dict()
	_default_multiprocessing = False
	_cache = [None]

	def displayName(): return "Embedding"

	@abstractmethod
	def process(self, knwon_events: list[list[str]], pipe_here=None, **options) -> list[list[float]] | np.ndarray:
		'''Input is event set, output is numbers'''
		pass
	
	def in_out(self=None):
		return {"in": {
			"string features": {"dtype": "str", "type": None}
		} | (PyUtils.param_options_cleanup(self._variable_options) if self is not None else {}),
		"out": {"vectors": {"dtype": "float"}}}



# An abstract Event Culling class.
class EventCulling(Module):

	_global_parameters = dict()
	_default_multiprocessing = True
	_cache = [None]

	def displayName(): return "EventCulling"

	def process(self, docs: list[list[str]], pipe=None) -> list[list[str]]:
		"""Process all docs"""
		filtered_events = []
		if self._default_multiprocessing:
			if pipe is not None: pipe.send(True)
			with Pool(max(cpu_count()-1, 1)) as p:
				filtered_events = p.map(self.process_single, docs)
		else:
			for d_i, d in enumerate(docs):
				if pipe is not None: pipe.send(100*d_i/len(docs))
				filtered_events.append(self.process_single(d))
		return filtered_events

	def process_single(self, eventSet: list[str]):
		"""Process a single document"""
		raise NotImplementedError

	def in_out(self=None):
		return {"in": {
			"events": {"dtype": "str", "type": None}
		} | (PyUtils.param_options_cleanup(self._variable_options) if self is not None else {}),
		"out": {"filtered events": {"dtype": "str"}}}


# An abstract EventDriver class.
class EventDriver(Module):

	_global_parameters = dict()
	_default_multiprocessing = True
	_cache = [None]

	def displayName(): return "EventDriver"

	@abstractmethod
	def setParams(self, params):
		'''Accepts a list of parameters and assigns them to the appropriate variables.'''

	def process(self, docs: list[str], pipe=None) -> list[list[str]]:
		"""Sets the events for the documents for all docs. Calls createEventSet for each doc."""
		events = []
		if self._default_multiprocessing:
			if pipe is not None: pipe.send(True)
			with Pool(max(cpu_count()-1, 1)) as p:
				events = p.map(self.process_single, docs)
		else:
			for i, d in enumerate(docs):
				if pipe is not None: pipe.send(100*i/len(docs))
				events.append(self.process_single(d))
		return events
	
	def process_single(self, text: str):
		'''
		Processes a single document.
		This is no longer an abstract method because
		some modules may choose to ignore this function and deal with all documents instead in "process".
		'''
		raise NotImplementedError

	def in_out(self=None):
		return {"in": {
			"text": {"dtype": "str", "type": "text"}
		} | (PyUtils.param_options_cleanup(self._variable_options) if self is not None else {}),
		"out": {"events": {"dtype": "str"}}}


# An abstract Utilities class.
class Utilities(Module):

	_global_parameters = dict()
	_default_multiprocessing = True
	_cache = []

	def displayName(): return "Utilities"

	def setParams(self, params):
		'''Accepts a list of parameters and assigns them to the appropriate variables.'''

	def process(self, docs, pipe=None):
		"""Sets the events for the documents for all docs. Calls createEventSet for each doc."""
		return
	
	def process_single(self, procText):
		raise NotImplementedError

