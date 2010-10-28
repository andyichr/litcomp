function loading() {
	return $("<p>Working...</p>");
}

var uid = (function() {
	var curId = 1;
	return function() {
		return curId++;
	};
}());

$(function() {
	var run = (function() {
		var onData = {};
		var socket = new io.Socket("localhost");
		socket.on("connect", function() {

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
		});
		socket.on("message", function(data) {
			data = JSON.parse(data);

			if (onData[data.id]) {
				onData[data.id](data);
			} else {
				console.log("Response for unknown id: '" + data.id + "'");
			}

			//FIXME remove onData for id once response is finished according to server
		});
		socket.on("disconnect", function() {
			$(".exec-run, .exec").remove();
		});
		socket.connect();

		var RPC = function(argv) {
			var id = uid();
			onData[id] = argv.onData;
			socket.send(JSON.stringify({
				id: id,
				method: argv.method,
				params: argv.params
			}));
		};

		return function(runIndex) {
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
	}());

	var $buttonContainer = $("<div/>").attr("class", "buttons");
	var path = window.location.pathname;
	var presTitle = pageMeta.title.replace("_", " ");

	$("head").append($("<title/>").text(presTitle));
	$("body").prepend($("<h1/>").text(presTitle));
	$("pre.source").wrap("<div class=\"source\"/>");

	// page editing functions
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
				$ct.append($("<a>Cancel</a>").click(function() {
					window.location.href = path;
				}));
				$ct.append("");
				var $container = $("<div/>");
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
});
