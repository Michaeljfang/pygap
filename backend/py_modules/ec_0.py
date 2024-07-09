# from abc import ABC, abstractmethod
from backend.module import EventCulling
from multiprocessing import Pool, cpu_count

class N_Occurrences(EventCulling):
	_variable_options = {
		"Mode": {"options": ["Cull more freq.", "Cull less freq."], "type": "OptionMenu", "default": 0},
		"Frequency": {"options": range(1, 201), "default": 0, "type": "Slider", "default": 10, "dtype": "int"},
	}

	Frequency = _variable_options["Frequency"]["options"][_variable_options["Frequency"]["default"]]
	Mode = _variable_options["Mode"]["options"][_variable_options["Mode"]["default"]]
	
	def process_single(self, eventSet: list[str]):
		freq = dict()
		for e in eventSet:
			if freq.get(e) == None: freq[e] = 1
			else: freq[e] += 1
		if self.Mode == "Cull more freq.":
			new_events = [ev for ev in eventSet if (freq.get(ev)!=None and freq.get(ev) <= self.Frequency)]
		if self.Mode == "Cull less freq.":
			new_events = [ev for ev in eventSet if (freq.get(ev)!=None and freq.get(ev) >= self.Frequency)]
		return new_events

	def displayName():
		return "N occurrences"

	def displayDescription():
		return "Remove features that are encountered N or fewer/more times."