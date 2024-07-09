from backend.module import AnalysisMethod
from sklearn.svm import LinearSVC, SVC
from sklearn.neural_network import MLPClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis, QuadraticDiscriminantAnalysis
from sklearn.tree import DecisionTreeClassifier
import numpy as np
from copy import deepcopy
from backend.py_modules import PrepareNumbers as pn


class Linear_SVM_sklearn(AnalysisMethod):
	penalty = "L2"
	opt = "dual"
	tol = 0.0001
	reg_strength = 1
	iterations = 1000
	_NoDistanceFunction_ = True

	_model = None

	_variable_options = {
		"iterations": {"options": [10, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000],
			"type": "OptionMenu", "default": -1, "displayed_name": "Iterations",
			"validator": (lambda x: x in range(2, 500001)), "dtype": "int"},
		"tol": {"options": [0.00001, 0.00002, 0.00005, 0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05],
			"type": "OptionMenu", "default": 3, "displayed_name": "Stopping Tolerance", "dtype": "float",
			"validator": (lambda x: (x > 0.000001 and x < 0.1))},
		"penalty": {"options": ["L1", "L2"], "type": "OptionMenu", "default": 1, "displayed_name": "Penalty type"},
		"reg_strength": {"options": range(1, 11), "type": "Slider", "default": 0, "displayed_name": "Regularization Strength", "dtype": "int"},
		"opt": {"options": ["primal", "dual"], "type": "OptionMenu", "default": 1, "displayed_name": "Optimization Problem"},
	}
	_display_to_input = {"penalty": {"L1": "l1", "L2": "l2"}, "dual": {"dual": True, "primal": False}}
	
	def after_init(self, **options):
		...

	def train(self, train, train_data, **options):
		"""Create model in train() because after this starts the parameters won't change."""
		train_data, train_labels = self.get_train_data_and_labels(train, train_data)
		train_labels = train_labels.flatten() # sklearn's svm takes flattened labels array.
		self._model = LinearSVC(
			max_iter=self.iterations, tol=self.tol, penalty=self._display_to_input["penalty"][self.penalty],
			C=1/self.reg_strength, dual=self._display_to_input["dual"][self.opt]
		)
		self._model.fit(train_data, train_labels)
		return

	def process(self, train_data, train_labels, test_data, **options):
		# train
		train_labels, self._labels_to_categories = pn.auth_list_to_labels(train_labels)
		train_labels = train_labels.flatten() # sklearn's svm takes flattened labels array.
		self._model = LinearSVC(
			max_iter=self.iterations, tol=self.tol, penalty=self._display_to_input["penalty"][self.penalty],
			C=1/self.reg_strength, dual=self._display_to_input["dual"][self.opt]
		)
		self._model.fit(train_data, train_labels)

		# predict
		scores = self._model.decision_function(test_data)
		if len(scores.shape) == 1:
			# in case of binary classification, sklearn returns
			# a 1D array for scores. need to re-format to 2D.
			scores = np.array((scores, 1-scores)).transpose()
		results = self.get_results_dict_from_matrix(scores)
		results = self.sort_results(results, reverse=1)
		return results

	def displayName():
		return "Linear SVM (sklearn)"

	def displayDescription():
		return """Support vector machine implemented in Scikit-learn. (sklearn.svm.LinearSVC).
		Parameters are set to the default from sklearn.
		Parameters:
		\tIterations: number of iterations to run.
		\tStopping tolerance: Tolerance for the stopping criteria.
		\tPenalty: Specifies the norm used in the penalization.
		\tRegularization Strength: Strength of constraints on size of parameters.
		\tOptimization Problem: which problem to solve. Use "primal" if the texts are large in number but short in content, or,
		number of samples > number of features.\n
		To see more details, go to https://scikit-learn.org/stable/modules/generated/sklearn.svm.LinearSVC.html.
		"""

class MLP_sklearn(AnalysisMethod):

	hidden_width = 100
	depth = 1
	activation = "ReLU"
	learn_rate_init = 0.001
	learn_rate_mode = "constant"
	iterations = 200
	tol = 0.0001
	validation_fraction = 0.1

	_variable_options = {
		"hidden_width": {"options": list(range(2,10))+[10,20,30,40,50,75,100,200,300,400,500,750,1000],"default": 14,
			"displayed_name": "Hidden layers width", "validator": (lambda x: (x > 1 and x < 5001)), "dtype": "int"},
		"depth": {"options": list(range(1, 10))+[10,15,20,25,30,35,40,45,50,100], "default":0, "displayed_name": "Network depth",
			"validator": (lambda x: (x > 0 and x < 1001)), "dtype": "int"},
		"activation": {"options": ["ReLU", "tanh", "Logistic", "Identity"], "default": 0, "displayed_name": "Activation function"},
		"learn_rate_init": {"options": [0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2], "default": 3,
			"displayed_name": "Initial learn rate", "validator": (lambda x: (x > 0.00001 and x <= 1)), "dtype": "float"},
		"learn_rate_mode": {"options": ["Constant", "Inverse Scaling", "Adaptive"], "default": 0, "displayed_name": "Learn rate mode"},
		"iterations": {"options": [10, 50, 100, 200, 300, 400, 500, 750, 1000, 2500, 5000, 7500, 10000], "default": -1,
			"displayed_name": "Maximum iterations", "validator": (lambda x: (x > 1 and x < 100001)), "dtype": "int"},
		"tol": {"options": [0.00001, 0.00002, 0.00005, 0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05], "dtype": "float",
			"type": "OptionMenu", "default": 3, "displayed_name": "Stopping Tolerance", "validator": (lambda x: (x >= 0.000001 and x <=0.1))},
		"validation_fraction": {"options": [0.05, 0.45], "type": "Slider", "resolution": 0.05, "default": 1, "displayed_name": "Fraction used for validation",
			"validator": (lambda x: (x > 0.01 and x < 0.5)), "dtype": "float"}
	}

	_display_to_input = {
		"learn_rate_mode": {"Constant": "constant", "Inverse Scaling": "invscaling", "Adaptive": "adaptive"}
	}

	_NoDistanceFunction_ = True


	def process(self, train_data, train_labels, test_data, **options):
	# def process(self, docs, Pipe=None, **options):

		train_labels, self._labels_to_categories = pn.auth_list_to_labels(train_labels)

		train_labels = train_labels.flatten()
		model = MLPClassifier(
			hidden_layer_sizes=(self.hidden_width,)*self.depth,
			activation=self.activation.lower(),
			learning_rate_init=self.learn_rate_init,
			learning_rate=self._display_to_input["learn_rate_mode"][self.learn_rate_mode],
			max_iter=self.iterations,
			tol=self.tol,
			validation_fraction=self.validation_fraction
		)
		model.fit(train_data, train_labels)

		results = model.predict_proba(test_data)
		if len(results.shape) == 1:
			results = np.array((results, 1-results)).transpose()

		results = self.get_results_dict_from_matrix(results)
		results = self.sort_results(results, reverse=1)
		return results


	def displayName():
		return "Multi-layer perceptron (sklearn)"

	def displayDescription():
		return "[multi-process]\nMulti-layer perceptron/neural network implemented in scikit-learn."


class Naive_bayes_sklearn(AnalysisMethod):

	_NoDistanceFunction_ = True

	alpha = 1
	_variable_options = {"alpha":
		{"options": [0, 0.2, 0.4, 0.6, 0.8, 1], "default": 5, "dtype": "float",
			"displayed_name": "Adaptive smoothing", "validator": (lambda x: (x >= 0 and x <= 2))}
	}

	def process(self, train_data, train_labels, test_data, **options):
		train_labels, self._labels_to_categories = pn.auth_list_to_labels(train_labels)
		self._model = MultinomialNB(alpha = self.alpha)
		train_labels = train_labels.flatten()
		self._model.fit(train_data, train_labels)

		results = self._model.predict_proba(test_data)
		results = self.get_results_dict_from_matrix(results)
		results = self.sort_results(results, reverse=1)
		return results

	def displayName():
		return "Naive Bayes (sklearn)"

	def displayDescription():
		return "Multinomial naive bayes implemented in scikit-learn."

class LDA_sklearn(AnalysisMethod):
	shrinkage_option = "none"
	shrinkage_amount = 0
	_variable_options = {
		"shrinkage_option": {
			"options": ["none", "auto", "fixed"], "displayed_name": "shrinkage", "default": 0,
			"update": True
		},
		"shrinkage_amount": {
			"options": [0, 1], "default": 0, "type": "Slider", "resolution": 0.01, "validator": (lambda x: x >= 0 and x <= 1),
			"show": False, "dtype": "float"
		}
	}

	_NoDistanceFunction_ = True

	def after_init(self, **options):
		self.shrinkage_option = "none"
		self.shrinkage_amount = 0
		self._variable_options = deepcopy(self._variable_options)

	def set_attr(self, var, value):
		self.__dict__[var] = value
		if var == "shrinkage_option":
			if value == "fixed":
				self._variable_options["shrinkage_amount"]["show"] = True
			else:
				self._variable_options["shrinkage_amount"]["show"] = False
			return True
		return False

	def process(self, train_data, train_labels, test_data, **options):
		train_labels, self._labels_to_categories = pn.auth_list_to_labels(train_labels)
		model = LinearDiscriminantAnalysis(
			shrinkage=("auto" if self.shrinkage_option == "auto" else (
				None if self.shrinkage_option == "none" else float(self.shrinkage_amount)
			))
		)
		train_labels = train_labels.flatten()
		model.fit(train_data, train_labels)
		results = model.predict_proba(test_data)
		results = self.get_results_dict_from_matrix(results)
		results = self.sort_results(results, reverse=1)
		return results

	def displayName():
		return "Linear Discriminant Analysis (sklearn)"
	
	def displayDescription():
		return "Linear discriminant analysis (LDA) implemented in scikit-learn"

# class Quadratic_discriminant_analysis(AnalysisMethod):

# 	_NoDistanceFunction_ = True

# 	def process(self, train_data, train_labels, test_data, **options):
# 		train_labels, self._labels_to_categories = pn.auth_list_to_labels(train_labels)
# 		model = QuadraticDiscriminantAnalysis()
# 		train_labels = train_labels.flatten()
# 		model.fit(train_data, train_labels)

# 		results = model.predict_proba(test_data)
# 		results = self.get_results_dict_from_matrix(results)
# 		results = self.sort_results(results, reverse=1)
# 		return results


# 	def displayName():
# 		return "Quadratic Discriminant Analysis (sklearn)"

# 	def displayDescription():
# 		return "Classifier with quadratic decision boundary. Fits a Gaussian density to each class."

    
class Decision_tree_sklearn(AnalysisMethod):

	_NoDistanceFunction_ = True

	criterion = "gini"
	splitter = "best"
	_variable_options = {"criterion":
		{"options": ["gini", "entropy", "log_loss"], "default": 0},
        "splitter": {"options": ["best", "random"], "default": 0} #The other options seem like too much for the average user
	}

	def train(self, train, train_data=None, **options):
		train_data, train_labels = self.get_train_data_and_labels(train, train_data)
		self._model = DecisionTreeClassifier(criterion = self.criterion, splitter= self.splitter)
		train_labels = train_labels.flatten()
		self._model.fit(train_data, train_labels)
		return


	def process(self, train_data, train_labels, test_data, **options):

		train_labels, self._labels_to_categories = pn.auth_list_to_labels(train_labels)
		model = DecisionTreeClassifier(criterion = self.criterion, splitter= self.splitter)
		train_labels = train_labels.flatten()
		model.fit(train_data, train_labels)

		results = model.predict_proba(test_data)
		results = self.get_results_dict_from_matrix(results)
		results = self.sort_results(results, reverse=1)
		return results


	def displayName():
		return "Decision tree classifier (sklearn)"

	def displayDescription():
		return "Decision tree classifier implemented in scikit-learn."
