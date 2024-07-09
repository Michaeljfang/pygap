# from abc import ABC, abstractmethod
from backend.module import Canonicizer
import re
from multiprocessing import Pool, cpu_count
# import c_cc_0
	
class NormalizeWhitespace(Canonicizer):
	_live = True
	def process_single(self, text: str):
		'''Convert text in to a string where all whitespace characters are the same.'''
		return ' '.join(text.split())

	def process(self, docs: list[str], pipe=None):
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

	def displayName():
		return "Normalize Whitespace"

	def displayDescription():
		return "Converts whitespace characters to a single space.\n" +\
		"The py implementation uses Python's white-space char list for str.split()\n" +\
		"The C++ implementation checks for ascii white space characters."

class UnifyCase(Canonicizer):
	_live = True
	def process_single(self, procText):
		"""Convert procText to lower case"""
		return procText.lower()
	
	def displayName():
		return "Unify Case"

	def displayDescription():
		return "Converts all text to lower case."

class StripPunctuation(Canonicizer):
	_live = True
	full_width = 1
	_variable_options = {
		"full_width": {"options": [0, 1], "type": "Tick", "default": 1, "displayed_name": "Include full-width", "dtype": "int"}
	}
	_punct = re.compile(",.?!\"'`;:-()&$")
	_fw_punct = re.compile("，。？！“”‘’；：——（）、《》【】『』")
	def process_single(self, text):
		"""Gets rid of punctuation characters"""
		text = re.subn(self._punct, "", text)[0]
		#text = ''.join([char for char in text if char not in ",.?!\"'`;:-()&$"])
		if self.full_width:
			text = re.subn(self._fw_punct, "", text)[0]
		return text
	
	def displayDescription():
		return 'Strip a list of punctuations from the text:\n' +\
			',.?!"\'`;:-()&$\n' +\
			'Full-width punctuations include:\n"，。？！“”‘’；：——（）、《》【】『』"'

	def displayName():
		return "Strip Punctuation"

class StripNumbers(Canonicizer):
	# chn_jpa = 0
	# _variable_options = {
	# 	"chn_jpa": {"options": [0, 1], "type": "Tick", "default": 0, "displayed_name": "Chinese/Japanese"}
	# }

	_live = True
	_regex_match = re.compile("0+")
	# this over-covers cases, but the over-covered cases are malformed numerals.
	_chn_regex = re.compile("((([一二两三四五六七八九]*亿)|零)*(([一二两三四五六七八九]*千)|零)*(([一二两三四五六七八九]*百)|零)*"
		"(([一二两三四五六七八九]*十)|零)*(([一二两三四五六七八九]*万)|零)*(([一二两三四五六七八九]*千)|零)*"
		"(([一二两三四五六七八九]*百)|零)*(([一二三四五六七八九]*十)|零)*([一二三四五六七八九])*)+")

	def process_single(self, text):
		"""Converts each digit string to a single zero."""
		text = ''.join(["0" if char in "0123456789" else char for char in text])
		text = re.subn(self._regex_match, "0", text)[0]
		# if self.chn_jpa:
		# 	text = re.subn(self._chn_regex, "零", text)[0]
		return text

	def displayDescription():
		return "Converts each simple digit string to a single 0.\n" +\
			"Enabling Chinese/Japanese numerals converts all chinese-character numberals to the Chinese zero.\n" +\
			"\tThis does not include numerical characters used in accounting."

	def displayName():
		return "Strip Numbers"

class PunctuationSeparator(Canonicizer):
	full_width = 1
	_variable_options = {
		"full_width": {"options": [0, 1], "type": "Tick", "default": 1, "displayed_name": "Include full-width", "dtype": "int"}
	}
	_live = True
	_punct = ",.?!\"'`;:-()&$"
	_fw_punct = "，。？！“”‘’；：——（）、《》【】『』"
	def process_single(self, procText):
		"""Adds whitespaces before and after punctuations."""
		punctuations = self._punct + (self._fw_punct if self.full_width else "")
		return ''.join([" "+char+" " if char in punctuations else char for char in procText])
	
	def displayDescription():
		return "Adds whitespaces before and after punctuations.\n" +\
			'Full-width punctuations include:\n"，。？！“”‘’；：——（）、《》【】『』"'
	
	def displayName():
		return "Punctuation Separator"

class StripAlphanumeric(Canonicizer):
	full_width = 1
	_variable_options = {
		"full_width": {"options": [0, 1], "type": "Tick", "default": 1, "displayed_name": "Include full-width", "dtype": "int"}
	}
	_punct = ",.?!\"'`;:-()&$"
	_fw_punct = "，。？！“”‘’；：——（）、《》【】『』"
	def process_single(self, procText):
		"""Strips all non-whitespace, non-punctuation marks."""
		leave = " " + self._punct + (self._fw_punct if self.full_width else "")
		return ''.join([char for char in procText if char in leave])

	def displayDescription():
		return "Strips all non-whitespace, non-punctuation marks. i.e. leaves only white spaces and punctuation marks.\n"+\
			'Full-width punctuations include:\n"，。？！“”‘’；：——（）、《》【】『』"'
	
	def displayName():
		return "Strip AlphaNumeric"

class StripNullCharacters(Canonicizer):
	def process_single(self, procText):
		return ''.join([char for char in procText if char!="\0"])

	def displayDescription():
		return "Strips all 0x00 from the text."
	
	def displayName():
		return "Strip Null Characters"

class ReplaceNewLines(Canonicizer):

	_pattern = re.compile("(\r\n)|\r|\n")

	def process_single(self, text):
		return re.subn(self._pattern, "\n", text)[0]

	def displayName():
		return "Replace New Lines"

	def displayDescription():
		return "replace different new line sequences (\\n, \\r, \\r\\n) with \\n"
