# communicates between the electron front end and the python back end

from time import sleep
import zmq
from backend.PyAPI import PyAPI
import json
from traceback import format_exc
from multiprocessing import Process, Pipe
from sys import exit as sys_exit

class Messenger:

	def __init__(self, **options):

		'''
		options:
		port (str) = "4227"
			zmq port
		socket_type (zmq socket) = zmq.REP
			zmq socket type.
		exp_params (dict)
			dict for global, mod params.
		'''


		# process to run the py api.
		# TODO need to figure out if need to always run a separate process
		# even in regular use or only during an experiment
		self.api_process = None

		# identify whether this instance is one just for running experiments
		exp_params = options.get('exp_params')
		if exp_params is None: return


	def receive_send(self, process_func, send_type):
		message = self.socket.recv().decode('utf-8')

		process_return = process_func(message)

		if send_type == bytes:
			self.socket.send(bytes(process_return, encoding="utf-8"))
		elif send_type == str:
			self.socket.send_string(str(process_return))
		return message

	def acknowledge(self, response_time=1):
		"""echo messages"""
		message = self.socket.recv().decode('utf-8')
		print("received")
		sleep(response_time)
		#self.socket.send(bytes("received.", encoding='utf-8') + bytes(str(message)[:10], encoding='utf-8'))
		self.socket.send_string('received '+message[:10])
		return

	def test_listen(self):
		while True:
			self.acknowledge(0.2)

	def retrieve_message(self):
		message = self.socket.recv_multipart()#.decode('utf-8')
		message = [m.decode("utf-8") for m in message]
		if ":" not in message[0]:
			namespace = None
			function = None
		else:
			namespace = message[0].split(":")[0]
			function = message[0].split(":")[1]
		content = message[1:]
		return message, namespace, function, content

	def listen(self):
		"""use polling with timeout?"""
		while True:
			message, namespace, function, content = self.retrieve_message()

			if namespace is None:
				print(f"No namespace specified. Echo.\nMessage: {message[0]}\nlength: {len(message)}")
				self.socket.send_string(str(message))
				continue
			match namespace:
				case "widget":
					self.socket.send_string(str(self.widgets(function, content)))
					continue
				case "debug":
					self.socket.send_string(str(self.debug(function, content)))
					continue
				case "exp":
					self.socket.send_string(json.dumps({"status": 1, "message": "not implemented"}))
					continue
				case "exp_start":
					self.socket.send_string(str(self.exp_start(function, content)))
					continue
				case "state_check":
					self.socket.send_string(json.dumps(self.state_check))
				case "exit":
					# TODO need to take care of subprocesses
					sys_exit()
				case _:
					self.socket.send_string("Unknown namespace. Message: " + str(message)[:20])
					continue

	def state_check(self):
		return {"status": 0, "message": None, "content": None}

	def exp_start(self, function, content):
		'''
		Starts a new process to run the experiments. Gives a new socket connection to the GUI.
		'''
		print(content)
		self.process = Process()


	def debug(self, function, content):
		to_return = json.dumps({"status": 1, "message": "unknown option for debug()"})
		try:
			match function:
				case "clear_mods":
					self.api.clear_mods()
					to_return = json.dumps({"status": 0, "content": None})
					print("cleared all py mods")
		except Exception as e:
			print("debug() error", e)
			to_return = json.dumps({"status": 1, "message": format_exc()})
		return to_return

	def widgets(self, function: str, content=[0]) -> str:
		to_return = json.dumps({"status": 1, "message": "unknown option for widgets()"})
		try:
			print("function", function, "content", content)

			options = [] if not len(content) else json.loads(content[0])
			"""parsed arguments passed from front end."""


			if function == "get_info":
				to_return = json.dumps({"status": 0, "content": self.api.mods_info})
			elif function == "add_new_widget":
				to_return = json.dumps({"status": 0, "content": self.api.add_new_widget(options)})
			elif function == "delete_widgets":
				to_return = json.dumps({"status": 0, "content": self.api.delete_widget(options)})
			elif function == "set_params":
				# need id, dict of {param_name: value}
				for param_name in options["mod_params"].keys():
					self.api.set_mod_param(options["id"], param_name, options["mod_params"][param_name])
				to_return = json.dumps({"status": 0})
			elif function == "batch_set_params":
				for wid in options["widget_list"].keys():
					for param_name in options["widget_list"][wid]["params"]:
						print(wid, param_name)
						self.api.set_mod_param(wid, param_name, options["widget_list"][wid]["params"][param_name]["value"])
				to_return = json.dumps({"status": 0})
				print("set all params")
			elif function == "update_in_out":
				# need id.
				to_return = json.dumps({"status": 0, "content":
					{
						options["id"]: {
							"in_out": self.api.mods_in_use[options["id"]].in_out(),
							"param_options": self.api.param_options_cleanup(self.api.mods_in_use[options["id"]]._variable_options)
						}
					}
				})
			elif function == "get_cache":
				to_return = json.dumps({"status": 0, "content": self.api.get_cache(options)})
			elif function == "clear_cache":
				to_return = json.dumps({"status": 0, "content": self.api.clear_cache(options)})
			elif function == "exists":
				to_return = json.dumps({"status": 0, "content": str(int(self.api.exists(options)))})
		except Exception as e:
			to_return = json.dumps({"status": 1, "message": format_exc()})

		# if function == "get_info":
		# 	to_return = json.dumps({"status": 0, "content": self.api.mods_info})
		# elif function == "add_new_widget":
		# 	try:
		# 		options = json.loads(content[0])
		# 		to_return = json.dumps({"status": 0, "content": self.api.add_new_widget(options)})
		# 	except Exception as e:
		# 		to_return = json.dumps({"status": 1, "message": format_exc()})
		# elif function == "delete_widgets":
		# 	try:
		# 		options = json.loads(content[0])
		# 		to_return = json.dumps({"status": 0, "content": self.api.delete_widget(options)})
		# 	except Exception as e:
		# 		to_return = json.dumps({"status": 1, "message": format_exc()})
		print(self.api.mods_in_use)
		return to_return


	def start(self, **options):
		"""starts a messenger process that listens/reports to a main frontend process"""

		self.port = options.get("port", "4227")
		context = zmq.Context()
		self.socket = context.socket(options.get("socket_type", zmq.REP))
		self.socket.bind("tcp://127.0.0.1:"+self.port)

		self.api = PyAPI()
		print("Python backend ready")
		self.listen()

	def start_exp_subprocess(self, **options):
		"""
		starts as the subprocess that only runs the experiment.
		This should run in a separate process than the one connecting to the frontend.

		use dealer (client) and router (server)
		use poller?
		test this:
		https://stackoverflow.com/questions/18114343/how-does-zmq-poller-work#18116839
		"""

		self.port = options.get("port", "4226")
		# get alternate port from gui_params file, if there is one
		context = zmq.Context()
		self.socket = context.socket(zmq.DEALER)
		self.socket.bind("tcp://127.0.0.1:"+self.port)

		try:
			self.api = PyAPI()
		except Exception as e:
			to_return = json.dumps({"status": 1, "message": format_exc()})
			return
		self.api.batch_set_params(value_dict)


if __name__ == "__main__":
	a = Messenger()
	a.start()
