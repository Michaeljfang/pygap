# from abc import ABC, abstractmethod, abstractproperty
from backend.module import AnalysisMethod
from codecs import namereplace_errors

import backend.py_modules.Histograms as histograms
from backend.py_modules import PrepareNumbers as pn
import numpy as np


class CentroidDriver(AnalysisMethod):
	"""The version of centroid driver that pairs with the embedders"""

	_prediction_type = "distance"
	_labels_to_categories = dict()
	_mean_per_author = dict()
	_means_labels = None
	_distance = None

	def train(self, train_data, train_labels):

		# train_data, train_labels = self.get_train_data_and_labels(known_docs, train_data)
		labels, self._labels_to_categories = pn.auth_list_to_labels(train_labels)
		self._mean_per_author, self._means_labels =\
			pn.find_mean_per_author(train_data, labels)
		return

	# def process(self, docs, pipe=None, **options):
	def process(self,
			train_data: list[list[float]] | np.ndarray,
			train_labels: list[str] | np.ndarray | list[int],
			test_data: np.ndarray,
			**options
		):
		"""Get distance."""
		self.train(train_data, train_labels)
		doc_by_author = self._distance.distance(test_data, self._mean_per_author)
		results = self.get_results_dict_from_matrix(doc_by_author)
		results = self.sort_results(results, reverse=0)
		return results

	def displayName():
		return "Centroid Driver"

	def displayDescription():
		return "[VECTORIZED]\nComputes one centroid per Author.\n" +\
			"Centroids are the average relative frequency of events over all documents provided.\n" +\
			"i=1 to n ΣfrequencyIn_i(event)."

class KNearestNeighbor(AnalysisMethod):
	_prediction_type = "distance"
	_document_embeddings: np.ndarray = None
	_labels_to_categories = None
	_train_labels = None
	_distance = None
	k = 5
	tie_breaker = "average"
	_variable_options = {
		"k": {"options": range(1, 21), "type": "Slider", "default": 4, "displayed_name": "K", "dtype": "int"},
		"tie_breaker": {"options": ["average", "minimum"], "type": "OptionMenu", "default": 0, "displayed_name": "Tie breaker"}
	}
	def displayName():
		return "K-Nearest Neighbors"

	def displayDescription():
		return "This finds the K nearest documents in the feature space and assigns the class with most docs among them.\n" +\
			"Tie breakers:\n\taverage: the category with the smallest average\n\tminimum: category of the closest document among the ties."


	def process(self, train_data, train_labels, test_data, **options):
		"""
		K-nearest neighbor analysis implementation:\n
		This uses the usual algorithm for K-NN, where the class/category/author
		with the most votes from the K-nerest neighbors is assigned.
		Votes always out-rank the distance: this is ensured by calculating the votes
		and the distances separately, scaling the distances (per-doc on analysis) to [0, 0.5],
		and calculating the final author score using ```max_vote - votes + tie_breaking_distance.````\n
		Since the tie-breaker never exceeds 0.5, it will only affect ranking if two classes receive
		the same number of votes.
		"""
		labels, self._labels_to_categories =\
			pn.auth_list_to_labels(train_labels)
		labels = labels.flatten().tolist()
		unknown_by_known = self._distance.distance(test_data, train_data)
		unknown_by_known = [[[u_doc[d], labels[d]] for d in range(len(u_doc))] for u_doc in unknown_by_known]
		unknown_by_known = [sorted(x)[:self.k] for x in unknown_by_known]

		results = []
		for doc in unknown_by_known:
			doc_dict = dict()
			for auth in doc:
				doc_dict[auth[1]] = doc_dict.get(auth[1], []) + [auth[0]]
			if self.tie_breaker == "average":
							# votes				average
				doc_list = [[len(doc_dict[a]), sum(doc_dict[a])/len(doc_dict[a]), a] for a in doc_dict]
			elif self.tie_breaker == "minimum":
							# votes				closest score
				doc_list = [[len(doc_dict[a]), min(doc_dict[a]), a] for a in doc_dict]
			doc_list.sort(); doc_list.reverse()
			max_vote = doc_list[0][0]
			doc_list = {self._labels_to_categories[auth[2]]:max_vote-auth[0]+auth[1]/(2*max([a[1] for a in doc_list])) for auth in doc_list}
			results.append(doc_list)
		results = self.sort_results(results, reverse=0)
		return results