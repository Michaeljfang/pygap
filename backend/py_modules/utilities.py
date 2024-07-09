from backend.module import Utilities


class Combine_Events(Utilities):

    n_evts = "two"
    _cache = [None, None, None]

    _variable_options = {
        "n_evts": {"options": ["two", "three"], "default": 0, "displayed_name": "number of events", "update": True}
    }

    def in_out(self=None):
        if self is None:
            return {"in": 
                {
                    "event set 1": {"dtype": "str", "type": None},
                    "event set 2": {"dtype": "str", "type": None}
                }, "out": {
                    "combined events": {"dtype": "str"}
                }
            }

        if self.n_evts == "two":
            return {"in": 
                {
                    "event set 1": {"dtype": "str", "type": None},
                    "event set 2": {"dtype": "str", "type": None}
                }, "out": {
                    "combined events": {"dtype": "str"}
                }
            }
        elif self.n_evts == "three":
            return {"in": 
                {
                    "event set 1": {"dtype": "str", "type": None},
                    "event set 2": {"dtype": "str", "type": None},
                    "event set 3": {"dtype": "str", "type": None}
                }, "out": {
                    "combined events": {"dtype": "str"}
                }
            }

    def displayName():
        return "Combine events"
    
    def displayDescription():
        return "Combine events"

class Run_Analysis(Utilities):
    def in_out(self=None):
        return {"in":
            {
                "classifier": {"dtype": "classifier", "type": None},
            }, "out": {
                "analysis": {"dtype": "float"}
            }
        }

    def displayName():
        return "Run analysis"
    
    def displayDescription():
        return "run analysis"