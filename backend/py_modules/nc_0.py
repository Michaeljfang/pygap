from backend.module import Embedding
# from backend.Histograms import generateAbsoluteHistogram as gh
# from backend import PrepareNumbers as pn
from multiprocessing import Pool, cpu_count
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from copy import deepcopy

class Frequency(Embedding):
	normalization = "Global max"
	max_features = 0
	binary = 0
	_default_multiprocessing = False
	_mod_attributes = {
		"input": "events"
	}
	_variable_options = {
		"normalization": {"options": ["None", "Per-document token count", "Per-document max", "Global max"],
		"type": "OptionMenu", "default": 1, "displayed_name": "Normalization"},
		"max_features": {"options": range(0, 101), "type": "Slider", "default": 0, "displayed_name": "Max features", "dtype": "int"},
		"binary": {"options": [0, 1], "type": "Tick", "default": 0, "displayed_name": "Binary", "dtype": "int"}
	}

	def process(self, events: list[list[str]], pipe=None, **options):
		"""Convert and assign to Documents.numbers"""

		mf = self.max_features if self.max_features > 0 else None
		bi = True if self.binary else False
		cv = CountVectorizer(lowercase=False, analyzer=lambda x:x, max_features=mf, binary=bi)

		numbers = cv.fit_transform(events).toarray()

		if self.normalization == "None":
			# equivalent to JGAAP's absolute centroid driver
			pass
		elif self.normalization == "Per-document max":
			numbers = numbers / np.max(numbers, axis=1, keepdims=1)
		elif self.normalization == "Per-document token count":
			# equivalent to JGAAP's centroid driver
			numbers = numbers / np.sum(numbers, axis=1, keepdims=1)
		elif self.normalization == "Global max":
			numbers = numbers / np.max(numbers)
		# elif self.normalization == "Per-token max":
		# 	numbers = numbers / np.max(numbers, axis=0, keepdims=1)
		return numbers

	def displayDescription():
		return (
			"Converts events to their frequencies, using sklearn's count vectorizer\n" +\
			"Normalization:\n\tNone: use raw token counts (with \"Centroid Driver\", equiv. to JGAAP's Absolute Centroid Driver)\n" +\
			"\tPer-document token count: divide counts by total number of tokens in each doc (with \"Centroid Driver\", equiv. to JGAAP's Centroid Driver)\n" +\
			"\tGlobal max: divide counts by the count of most-appeared token in a doc\n" +\
			"Max features: only tally top n tokens by raw counts. If zero, tally all.\n"+\
			"binary: use 0, 1 for token presence/absence instead of counting frequencies."
		)

	def displayName():
		return "Frequency"