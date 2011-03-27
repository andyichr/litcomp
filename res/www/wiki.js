/**
 * @see http://javascript.crockford.com/remedial.html
 */
if (!String.prototype.entityify) {
    String.prototype.entityify = function () {
        return this.replace(/&/g, "&amp;").replace(/</g,
            "&lt;").replace(/>/g, "&gt;");
    };
}

/**
 * pretty-prints a DOM node
 *
 * @param el the DOM node
 */
function prettyPrint(el, indent, first) {
	if (isNaN(indent)) {
		indent = 0;
	}

	var spaces = "";

	for (var i = 0; i < 2 * indent; i++) {
		spaces += " ";
	}

	var html = [];

	if (el.nodeName.match(/H[1-6]/)) {
		var text = $("<div/>").append($(el).clone()).html();

		var trailSpaces = "\n";

		if (indent == 0) {
			trailSpaces = "\n\n";
		}

		return [spaces, text, trailSpaces].join("");
	}

	if (el.nodeName.match(/(STRONG|EM|A)/)) {
		var trailSpaces = "";
		var text = $("<div/>").append($(el).clone()).html();

		if (text.match(/\s$/)) {
			trailSpaces = "\n";
		}

		if (!first) {
			spaces = "";
		}

		return [spaces, text, trailSpaces].join("");
	}

	if (el.nodeName == "PRE") {

		var trailSpaces = "\n";

		if (indent == 0) {
			trailSpaces = "\n\n";
		}

		return [spaces, $("<div/>").append($(el).clone().prepend("\n")).html(), trailSpaces].join("");
	}

	if (el.nodeName == "#text") {
		if (el.nodeValue.match(/^\s+$/)) {
			// skip if just whitespace
			return "";
		}

		var text = el.nodeValue;

		if (first) {
			var text = $.trim(text) + "\n";
			//text = text.replace(/^\s*/m,"");
		}

		if (!first && !text.match(/^\s/)) {
			spaces = "";
		}

		return [spaces, text.entityify()].join("");
	}

	html.push(spaces);
	html.push("<");
	html.push(el.nodeName.toLowerCase());

	for (var i = 0; i < el.attributes.length; i++) {
		html.push(" " + el.attributes[i].name + "=\"" + el.attributes[i].textContent.entityify() + "\"");
	}

	html.push(">\n");

	var last = "";
	var lastNonempty = "";

	for (var i = 0; i < el.childNodes.length; i++) {
		if (last == "") {
			childFirst = true;
		} else {
			childFirst = false;
		}

		last = prettyPrint(el.childNodes[i], indent+1, childFirst);
		html.push(last);

		if (last != "") {
			lastNonempty = last;
		}
	}

	if (!lastNonempty.match(/\n$/)) {
		html.push("\n");
	}

	html.push(spaces);
	html.push("</");
	html.push(el.nodeName.toLowerCase());
	html.push(">\n");

	if (indent == 0) {
		html.push("\n");
	}

	return html.join("");
}

/**
 * app-specific main routine
 */
$(window).load(function() {
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
	 * defines behaviors which are toggleable & orthogonal
	 */
	var screenBehavior = {
		/**
		 * enable structured navigation in sections
		 */
		sectionNavigation: {
			enable: function() {
				$("article").find("h1, h2, h3, h4, h5, h6").each(function(hIndex, hEl) {
					var $hButtonContainer = $buttonContainer.clone();
					$(hEl).prepend($hButtonContainer);
					$(hEl).bind("nav-data", function(e, argv) {
						var $runLink = $("<a/>").text(argv.name).click(function() {
							argv.invoke();
						});

						// insert in order
						var $runLinkContainer = $("<span/>").append($runLink).data("priority", argv.priority || 0);
						var aAfterEl = null;
						var navEmpty = true;
						$hButtonContainer.find("> span").each(function(aIndex, aEl) {
							navEmpty = false;
							if ($(aEl).data("priority") < (argv.priority || 0)) {
								aAfterEl = aEl;
							}
						});

						var $sep = $("<span> | </span>");

						if (aAfterEl) {
							$(aAfterEl).after($sep).after($runLinkContainer);
						} else {
							if (!navEmpty) {
								$hButtonContainer.prepend($sep);
							}

							$hButtonContainer.prepend($runLinkContainer);
						}

						// make controls available to sender
						if (argv.success) {
							argv.success({
								remove: function() {
									$sep.remove();
									$runLinkContainer.remove();
								}
							});
						}
					});
				});
			},

			disable: function() {
				$("article").find("h1, h2, h3, h4, h5, h6").each(function(hIndex, hEl) {
					$(hEl).unbind("nav-data");
				});
			}
		},

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
		edit: (function() {

			var $titleButtonContainer = $buttonContainer.clone();

			return {
				enable: function() {

					$titleButtonContainer.remove().html("");
					$("h1").prepend($titleButtonContainer.append($("<span><a>Edit</a></span>").click(function() {

						$titleButtonContainer.html("");

						var $loading = loading();
						$("body > article#wikidoc").remove();
						$("body").append($loading);
						literalPath = path.split("/");
						file = literalPath.pop();
						literalPath.push("literal");
						literalPath.push(file);
						literalPath = literalPath.join("/");
						$.get(literalPath, function(data) {
							showEditor(data);
						});

						function showEditor(src) {
							window.location.hash = "#Edit";

							$(window).bind("hashchange", function() {
								if (window.location.hash == "#Edit") {
									return;
								}

								window.location.reload();
							});

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
									stylesheet: ["./res/cm/css/xmlcolors.css", "./res/cm/css/jscolors.css", "./res/cm/css/csscolors.css"],
									path: "./res/cm/js/",
									/*lineNumbers: true,*/
									height: "dynamic"
								});
							});
						}

					})));
				},
				disable: function() {
					$titleButtonContainer.remove().html("");
				}
			};
		}()),

		sectionEdit: (function() {
			var navControls = [];
			return {
				enable: function() {
					$("article").find("h1, h2, h3, h4, h5, h6").each(function(hIndex, hEl) {
						$(hEl).trigger("nav-data", {
							name: "Edit",
							priority: 1,
							invoke: function() {
								sectionEdit(hIndex);
							},
							success: function(newNavControl) {
								navControls.push(newNavControl);
							}
						});
					});
				},
				disable: function() {
					$(navControls).each(function (i, thisNavControl) {
						thisNavControl.remove();
					});
					navControls = [];
				}
			};
		}()),
		
		/**
		 * defines behavior for program fragment execution
		 */
		run: (function() {
				var navControls = [];
				return {
					enable: function() {

						// runnable program fragments
						RPC({
							method: "index",
							params: {
								key: "ProgramFragmentRunIndexes/" + pageMeta.title + "/" + pageMeta.hash
							},
							onData: function(data) {
								return;
								var runIndexes = JSON.parse(data.result.value);

								// section behavior
								$("article").find("h1, h2, h3, h4, h5, h6").each(function(hIndex, hEl) {
									hIndex++;

									if ($.inArray(hIndex, runIndexes) != -1) {
										var $out;
										var $runLink = $("<a>Run</a>");
										var $runLinkContainer = $("<span/>");

										// section is runnable; define run controls
										$(hEl).trigger("nav-data", {
											name: "Run",
											invoke: function() {
												if ($out) {
													$out.remove();
												}

												$out = run(hIndex);
												$out.fadeIn();
												$(hEl).after($out);
											},
											success: function(newNavControl) {
												navControls.push(newNavControl);
											}
										});
									}
								});

							}
						});
					},
					disable: function() {
						$(".exec-run, .exec-container").remove();
						$(navControls).each(function (i, thisNavControl) {
							thisNavControl.remove();
						});
						navControls = [];
					}
			};
		}())
	};

	// defined once connection code is loaded
	var reconnect = function() {};
	var run = function() {};
	var sectionEdit = function() {};
	var RPC = function() {};

	$(function() {
		(function() {
			var onData = {};
			var addAnchors = function() {
				addAnchors = function() {};
				// add heading anchors & section title data

				RPC({
					method: "take",
					params: {
						"take": {
							"this": {
								"title": pageMeta.title,
								"hash": pageMeta.hash
							},
							"from": "ArticleVersion",
							"to": "WikitextDocument",
							"using": "Source"
						},
						"from": "WikitextDocument",
						"to": "StringTuple",
						"using": "SectionTitle"
					},
					onData: function(data) {
						$("h2, h3, h4, h5, h6").each(function(hIndex, hEl) {
							$(hEl).data("section_id", data.result.value[hIndex]);
							$(hEl).before($("<a/>").attr("name", data.result.value[hIndex]));

							// enable activation of anchor from page load
							if (window.location.hash == "#" + data.result.value) {
								window.location.hash = "";
								window.location.hash = "#" + data.result.value;
							}
						});
					}
				});
			};

			onSocketConnect = function() {
				console.log("connected");
				addAnchors();
				screenBehavior.connected.enable();
				screenBehavior.edit.disable();
				screenBehavior.edit.enable();
				screenBehavior.run.disable();
				screenBehavior.run.enable();
				screenBehavior.sectionEdit.disable();
				screenBehavior.sectionEdit.enable();
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
				screenBehavior.sectionEdit.disable();
				screenBehavior.run.disable();
			};

			// define & invoke reconnect behavior
			var socketSend = function() {};

			reconnect = (function() {
				var socket;

				return function() {
					console.log("begin connecting");
					var path =  window.location.pathname.replace(/[^\/]*$/,"");
					socket = new io.Socket(window.location.hostname, {
						resource: (path == "/")
								? "socket.io"
								: (path + "socket.io")
					});
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

			/** 
			 * sectionEdit creates an editor widget which edits a subsection of the document keyed on header index
			 *
			 * @param int hIndex
			 */
			sectionEdit = (function() {

				var $originalArticle = $("#article_src").clone();
				var $headers = $originalArticle.find("h1, h2, h3, h4, h5, h6");

				return function(hIndex) {

					window.location.hash = "#Edit";

					$(window).bind("hashchange", function() {
						if (window.location.hash == "#Edit") {
							return;
						}

						window.location.reload();
					});

					$h = $($headers.get(hIndex));
					var hLevel = $h.get(0).nodeName.substring(1);
					var untilSelector = [];

					for (var i = hLevel; i > 0; i--) {
						untilSelector.push("h" + i);
					}

					untilSelector = untilSelector.join(", ");

					var $selection = $($h).add($h.nextUntil(untilSelector));
					var $editSelection = $selection.clone();

					var src = [];

					$editSelection.each(function(i, el) {
						src.push(prettyPrint(el));
					});

					src = src.join("");

					$("div.buttons").hide();
					var $titleButtonContainer = $buttonContainer.clone();
					$("h1").prepend($titleButtonContainer);
					var editor;
					var $ct = $("<span/>");
					$titleButtonContainer.append($ct);

					// define save behavior
					$ct.append($("<a>Save</a>").click(function() {
						var src = editor.getCode();
						var $loading = loading();
						$titleButtonContainer.html("");
						$container.replaceWith($loading);
						$h.before($(src));
						$selection.remove();
						src = []
						var childNodes = $originalArticle.get(0).childNodes;

						for (var i = 0; i < childNodes.length; i++) {
							src.push(prettyPrint(childNodes[i]));
						}

						src = src.join("");

						$.ajax({
							type: "PUT",
							data: src,
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
					$("body > article#wikidoc").replaceWith($container);
					$textArea.focus();
					$textArea.each(function() {
						editor = CodeMirror.fromTextArea(this, {
							parserfile: ["parsexml.js", "parsecss.js", "tokenizejavascript.js", "parsejavascript.js", "parsehtmlmixed.js"],
							stylesheet: ["./res/cm/css/xmlcolors.css", "./res/cm/css/jscolors.css", "./res/cm/css/csscolors.css"],
							path: "./res/cm/js/",
							/*lineNumbers: true,*/
							height: "dynamic"
						});
					});

				};
			}());

			/**
			 * run invokes server-side execution of a program fragment
			 */
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

			screenBehavior.sectionNavigation.enable();
			var timeout = 0;
			if ($.browser.safari) {
				timeout = 500;
			}
			setTimeout(function() {
				reconnect();
			}, timeout);
		}());

		var presTitle = pageMeta.title.replace("_", " ");

		$("head").append($("<title/>").text(presTitle));
		$("body").prepend($("<h1/>").text(presTitle));

		// enhance source blocks
		$("pre.source").wrap("<div class=\"source\"/>").each(function(i, sourceEl) {
			$(sourceEl).html($(sourceEl).html().replace(/(See: ([a-zA-Z0-9_]+#[a-zA-Z0-9_]+))/g, "<a href=\"$2\">$1</a>"));
		});
	});
});
