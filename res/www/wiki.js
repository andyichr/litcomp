(function() {
	var path = window.location.pathname;
	var $buttonContainer = $("<div/>").attr("class", "buttons");

	var loading = function() {
		return $("<p>Working...</p>");
	};

	var uid = (function() {
		var curId = 1;
		return function() {
			return curId++;
		};
	}());

	/**
	 * defines behaviors which are toggleable
	 */
	var screenBehavior = {
		/**
		 * define behaviors which will define page elements in order to inform
		 * the user about the current state of the app connection
		 */
		connected: (function() {
			var view = [];
			var interval = null;
			return {
				enable: function() {
					// remove auto-reconnect behavior
					(function() {
						clearInterval(interval);
					}());

					// remove disconnected view
					(function() {
						view.map(function(view) {
							$(view).remove();
							return view;
						});
						view = [];
					}());
				},

				disable: function() {
					// add auto-reconnect behavior
					(function() {
						interval = setInterval(function() {
							reconnect();
						}, 5000);
					}());

					// add disconnected view
					(function() {
						if (view.length) {
							return;
						}

						$message = $("<div/>").text("The application has become disconnected and is attempting to reconnect. Please wait or refresh the page.")
								.attr("style", "position: fixed; 1em; bottom: 0; left: 0; width: 100%; background-color: antiqueWhite; padding: .5em; text-align: center;")
						view.push($message);
						$placeholder = $message.clone().css("position", "static").css("width", "auto").css("visibility", "hidden");
						view.push($placeholder);
						view.map(function(view) {
							$(document.body).append($(view));
							return view;
						});
						$message.fadeIn();
					}());
				}
			};
		}()),

		/**
		 * defines behavior for editing sections of the page
		 */
		edit: {
			enable: function() {

				(function() {
					var $titleButtonContainer = $buttonContainer.clone();

					$("h1").prepend($titleButtonContainer.append($("<span><a>Edit</a></span>").click(function() {

						$titleButtonContainer.html("");

						var $loading = loading();
						$("body > article#wikidoc").remove();
						$("body").append($loading);
						$.get("/literal" + path, function(data) {
							showEditor(data);
						});

						function showEditor(src) {
							var editor;
							var $ct = $("<span/>");
							$titleButtonContainer.append($ct);

							// define save behavior
							$ct.append($("<a>Save</a>").click(function() {
								var code = editor.getCode();
								var $loading = loading();
								$titleButtonContainer.html("");
								$container.replaceWith($loading);
								$.ajax({
									type: "PUT",
									data: code,
									url: path,
									success: function() {
										window.location.href = path;
									},
									error: function() {
										window.location.href = path;
									}
								});
							}));

							$ct.append(" | ");

							// define cancel behavior
							$ct.append($("<a>Cancel</a>").click(function() {
								window.location.href = path;
							}));

							$ct.append("");

							var $container = $("<div/>");

							// define text editor widget
							var $textArea = $("<textarea/>").val(src);
							$container.append($textArea);
							$($loading).replaceWith($container);
							$textArea.focus();
							$textArea.each(function() {
								editor = CodeMirror.fromTextArea(this, {
									parserfile: ["parsexml.js", "parsecss.js", "tokenizejavascript.js", "parsejavascript.js", "parsehtmlmixed.js"],
									stylesheet: ["/res/cm/css/xmlcolors.css", "/res/cm/css/jscolors.css", "/res/cm/css/csscolors.css"],
									path: "/res/cm/js/",
									/*lineNumbers: true,*/
									height: "dynamic"
								});
							});
						}

					})));
				}());
			},
			disable: function() {
			}
		},
		
		/**
		 * defines behavior for program fragment execution
		 */
		run: {
			enable: function() {

				// runnable program fragments
				RPC({
					method: "index",
					params: {
						key: "ProgramFragmentRunIndexes/" + pageMeta.title + "/" + pageMeta.hash
					},
					onData: function(data) {
						var runIndexes = JSON.parse(data.result.value);

						// section behavior
						$("article").find("h1, h2, h3, h4, h5, h6").each(function(hIndex, hEl) {
							hIndex++;
							var $runLink = $("<a>Run</a>");
							var $runLinkContainer = $("<span/>");
							if ($.inArray(hIndex, runIndexes) != -1) {
								// section is runnable; define run controls
								var $hButtonContainer = $buttonContainer.clone();
								(function() {
									var $out;
									$(hEl).prepend($hButtonContainer.append($runLinkContainer.append($runLink.attr("class","exec-run").click(function() {
										if ($out) {
											$out.remove();
										}

										$out = run(hIndex);
										$out.fadeIn();
										$(hEl).after($out);
									}))));
								}());
							}
						});

					}
				});
			},
			disable: function() {
			}
		}
	};

	// defined once connection code is loaded
	var reconnect = function() {};
	var run = function() {};
	var RPC = function() {};

	$(function() {
		(function() {
			var onData = {};

			onSocketConnect = function() {
				console.log("connected");
				screenBehavior.connected.enable();
				screenBehavior.edit.enable();
				screenBehavior.run.enable();
			};

			onSocketMessage = function(data) {
				data = JSON.parse(data);

				if (onData[data.id]) {
					onData[data.id](data);
				} else {
					console.log("response for unknown id: '" + data.id + "'");
				}

				//FIXME remove onData for id once response is finished according to server
			};
			onSocketDisconnect = function() {
				screenBehavior.connected.disable();
				screenBehavior.edit.disable();
				screenBehavior.run.disable();
				$(".exec-run, .exec-container, div.buttons").remove();
			};
			screenBehavior.edit.disable();
			screenBehavior.run.disable();

			// define & invoke reconnect behavior
			var socketSend = function() {};

			reconnect = (function() {
				var socket;

				return function() {
					console.log("begin connecting");
					socket = new io.Socket("localhost");
					(function() {
						var thisSocket = socket;
						socket.on("connect", function() {
							if (thisSocket == socket) {
								onSocketConnect();
							}
						});

						socket.on("message", function(data) {
							if (thisSocket == socket) {
								onSocketMessage(data);
							}
						});

						socket.on("disconnect", function() {
							if (thisSocket == socket) {
								onSocketDisconnect();
							}
						});
					}());
					socket.connect();

					socketSend = function(data) {
						socket.send(data);
					};
				};
			}());

			RPC = function(argv) {
				var id = uid();
				onData[id] = argv.onData;
				socketSend(JSON.stringify({
					id: id,
					method: argv.method,
					params: argv.params
				}));
			};

			run = function(runIndex) {
				var $container = $("<div/>").attr("class","exec-container");
				var $out = $("<div/>").attr("class","exec");
				$container.append($out);
				RPC({
					method: "exec",
					params: {
						title: pageMeta.title,
						index: runIndex,
						pageHash: pageMeta.hash
					},
					onData: function(data) {
						if (data.result.stdout) {
							$out.append($("<span/>").text(data.result.stdout));
							$out.each(function() {
								this.scrollTop = this.scrollHeight;
							});
						}

						if (data.result.stderr) {
							$out.append($("<span/>").attr("class","stderr").text(data.result.stderr));
							$out.each(function() {
								this.scrollTop = this.scrollHeight;
							});
						}

						if (data.result.exit) {
							//TODO handle
						}
					}
				});
				return $container;
			};

			reconnect();
		}());

		var presTitle = pageMeta.title.replace("_", " ");

		$("head").append($("<title/>").text(presTitle));
		$("body").prepend($("<h1/>").text(presTitle));
		$("pre.source").wrap("<div class=\"source\"/>");
	});
}());
