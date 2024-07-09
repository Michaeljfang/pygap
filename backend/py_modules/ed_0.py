# from abc import ABC, abstractmethod
from backend.module import EventDriver
from nltk import ngrams
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk import WordNetLemmatizer
from json import load as json_load
from pathlib import Path
from importlib import import_module
from multiprocessing import Pool, cpu_count
# import spacy

language_codes = dict()
with open(Path("./resources/languages.json"), "r") as f:
	language_codes = json_load(f)
f.close()
del f

# REFERENCE CLASS FOR PyGAAP GUI.
class CharacterNGramEventDriver(EventDriver):
	'''Event Driver for Character N-Grams'''
	n = 2
	sort = 0
	_live = True
	_variable_options={
		"n": {"options": range(1, 21), "default": 1, "type": "Slider", "dtype": "int"},
		"sort": {"options": [0, 1], "type": "Tick", "default": 0, "displayed_name": "Sort Alphabetically", "dtype": "int"}
	}
	# for PyGAAP GUI to know which options to list/are valid
		
	def process_single(self, procText):
		'''Returns a list containing the desired character n-grams.'''
		nltkRawOutput = list(ngrams(procText, self.n)) # This gives us a list of tuples.
		# Make the list of tuples in to a list of character fragments in the form of strings.
		formattedOutput = [''.join(val) for val in nltkRawOutput]
		if len(formattedOutput) == 0:
			raise ValueError("NLTK n-gram returned empty list. Check output of previous modules.")
		return sorted(formattedOutput) if self.sort else formattedOutput
	
	def displayName():
		return "Character NGrams"
	
	def setParams(self, params):
		'''Sets the n parameter (length) for the Character N-Gram Event Driver. params is a list. '''
		self.n = params[0]

	def displayDescription(): # The text to display in PyGAAP GUI's description box.
		return "Groups of N successive characters (sliding window); N is given as a parameter."
	
		
class WhitespaceDelimitedWordEventDriver(EventDriver):
	'''Event Driver for Whitespace-Delimited Words'''
	
	def process_single(self, procText):
		'''Returns a list of words where a word is considered a whitespace-delimited unit.'''
		return procText.split()
		
	def displayName():
		return "Words (Whitespace-Delimited)"
	
	def setParams(self, params):
		'''This function is required, but does not do anything for this event driver.'''
		pass
		
	def displayDescription():
		return "Returns a list of words where a word is considered a whitespace-delimited unit."

class NltkWordTokenizerEventDriver(EventDriver):
	'''Event Driver for using the NLTK Word Tokenizer.'''
	
	def process_single(self, procText):
		'''Returns a list of words as defined by the NLTK Word Tokenizer.'''
		return word_tokenize(procText)
		
	def displayName():
		return "Words (NLTK Tokenizer)"
		
	def setParams(self, params):
		'''This function is required, but does not do anything for this event driver.'''
		pass

	def displayDescription():
		return "Word tokenizer using the Natural Language Took Kit's definition."
		
class SentenceEventDriver(EventDriver):
	'''Event Driver for getting sentences using the NLTK Sentence Tokenizer.'''
	
	def process_single(self, procText):
		'''Returns a list of sentences as defined by the NLTK Sentence Tokenizer.'''
		return sent_tokenize(procText)
		
	def displayName():
		return "Sentences"
		
	def setParams(self, params):
		'''This function is required, but does not do anything for this event driver.'''
		pass

	def displayDescription():
		return "Returns a list of sentences as defined by the NLTK Sentence Tokenizer."

class CharacterPositionEventDriver(EventDriver):
	'''Event Driver for letter positions. Only used on texts with delimited words (after canonicization).'''

	delimiter = "<whitespace(s)>"
	_variable_options = {"delimiter":
		{
			"options": ["<whitespace(s)>", ", (comma)", ". (period)", "; (semicolon)"],
			"type": "OptionMenu",
			"default": 0
		}
	}

	def process_single(self, procText):
		eventSet = []
		if self.delimiter == "<whitespace(s)>":
			splitText = procText.split()
		else:
			splitText = procText.split(self.delimiter[0])

		for word in splitText:
			eventSet += [str(word[letterIndex] + "_" + str(letterIndex)) for letterIndex in range(len(word))]
		return eventSet

	def setParams(self, params):
		'''This function is required, but does not do anything for this event driver.'''
		pass
	
	def displayName():
		return "Character Position"

	def displayDescription():
		return "Converts delimited words into list of letters with their positions within the word.\nRecommended with the Cangjie canonicizer"



class KSkipNGramCharacterEventDriver(EventDriver):
	_variable_options = {
		"k": {"options": range(1, 11), "type": "Slider", "default": 0, "displayed_name": "Skips (k)", "dtype": "int"},
		"n": {"options": range(1, 21), "type": "Slider", "default": 0, "displayed_name": "n-gram length (n)", "dtype": "int"}
	}
	k = 1
	n = 1
	_live = True

	def setParams(self, params):
		self.k = params[0]
		self.n = params[1]

	def displayDescription():
		return "n-gram extracted from text that only has every k characters from the original text."

	def displayName():
		return "K-skip Character N-gram"

	def process_single(self, text):
		text = "".join([text[i] for i in range(len(text)) if i%(self.k + 1) == 0])
		nltkRawOutput = list(ngrams(text, self.n))
		formattedOutput = [''.join(val) for val in nltkRawOutput]
		return formattedOutput

# PROBLEM: need to download vocab for tokenizing?

class WordNGram(EventDriver):
	n = 2
	tokenizer = "NLTK"
	#lemmatize = "No"
	sort = 0

	_variable_options = {
		"n": {"options": range(1, 11), "type": "Slider", "default": 1, "validator": (lambda x: x >= 1 and x <= 20), "dtype": "int"},
		"tokenizer": {"options": ["Space delimiter", "SpaCy", "NLTK"], "type": "OptionMenu", "default": 1},
		#"lemmatize": {"options": ["No", "SpaCy", "NLTK"], "type": "OptionMenu", "default": 0, "displayed_name": "(N/A) lemmatize"},
		"sort": {"options": [0, 1], "type": "Tick", "default": 0, "displayed_name": "Sort Alphabetically", "dtype": "int"}
	}

	def setParams(self, params):
		self.n, self.tokenizer, self.lemmatize = params

	def spacy_single(self, text):
		'''spacy tokenize single doc'''
		# doc is the Document object.
		events = [str(token) for token in self._lang_module.tokenizer(text)]
		return events

	def nltk_single(self, text):
		'''nltk tokenize single doc'''
		events = word_tokenize(text, language=self._nltk_lang)
		return events

	def process(self, docs: list[str], pipe):
		l = len(docs)
		events = []
		if pipe is not None: pipe.send(True)
		if self.tokenizer == "SpaCy":
			lang = self._global_parameters["language_code"].get(self._global_parameters["language"], "eng")
			lang = language_codes.get(lang, "unk").get("spacy", "xx.MultiLanguage")
			self._lang_module = import_module("spacy.lang.%s" % lang.split(".")[0])
			self._lang_module = getattr(self._lang_module, lang.split(".")[1])()
			if self._default_multiprocessing:
				with Pool(max(cpu_count()-1, 1)) as p:
					d_events = p.map(self.spacy_single, docs)
				events = [sorted(x) if self.sort else x for x in d_events]
			else:
				for i, d in enumerate(docs):
					if pipe is not None: pipe.send(100*i/l)
					d_events = [str(token) for token in self._lang_module.tokenizer(d)]
					events.append(sorted(d_events) if self.sort else d_events)

		elif self.tokenizer == "NLTK":
			lang = self._global_parameters["language_code"].get(self._global_parameters["language"], "eng")
			self._nltk_lang = language_codes.get(lang, "unk").get("nltk", "english")
			if self._default_multiprocessing:
				with Pool(max(cpu_count()-1, 1)) as p:
					d_events = p.map(word_tokenize, docs)
				events = [(sorted(x) if self.sort else x) for x in d_events]
			else:
				for i, d in enumerate(docs):
					if pipe is not None: pipe.send(100*i/l)
					d_events = word_tokenize(d.canonicized, language=self._nltk_lang)
					events.append(sorted(d_events) if self.sort else d_events)

		elif self.tokenizer == "Space delimiter":
			events = [(sorted(d.split()) if self.sort else d.split()) for d in docs]
		else:
			raise ValueError("Unknown tokenizer type %s" % self.tokenizer)
		return events

	
	def displayName():
		return "Word n-grams"

	def displayDescription():
		return "Word n-grams."


