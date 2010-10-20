function loading() {
	return $("<p>Working...</p>");
}

var uid = (function() {
	var curId = 1;
	return function() {
		return curId++;
	};
}())

$(function() {
	var run = (function() {
		var socket = new io.Socket("localhost");
		console.log("HERE");
		console.log(socket);
		socket.on("connect", function() {
			console.log("connected");
			socket.send("Hello World!");
		});
		socket.on("message", function(data) {
			console.log("message: " + data.toString());
		});
		socket.on("disconnect", function() {
			console.log("disconnected");
		});
		socket.connect();

		return function(runIndex) {
			socket.send(JSON.stringify({
				index: runIndex,
				pageHash: pageMeta.hash
			}));
		};
	}());

	var $buttonContainer = $("<div/>").attr("id", "buttons");
	var path = window.location.pathname;
	var presTitle = pageMeta.title.replace("_", " ");

	$("head").append($("<title/>").text(presTitle));
	$("body").prepend($("<h1/>").text(presTitle));

	// section behavior
	console.log(pageMeta.runIndexes);
	$("article").find("h1, h2, h3, h4, h5, h6").each(function(hIndex, el) {
		hIndex++;
		if ($.inArray(hIndex, pageMeta.runIndexes) != -1) {
			var $hButtonContainer = $buttonContainer.clone();
			$(el).prepend($hButtonContainer.append($("<a>Run</a>").click(function() {
				run(hIndex);
			})));
		}
	});

	// page editing functions
	(function() {
		var $titleButtonContainer = $buttonContainer.clone();
		$("h1").prepend($titleButtonContainer.append($("<a>Edit</a>").click(function() {
			$titleButtonContainer.html("");
			var $loading = loading();
			$("body > article#wikidoc").remove();
			$("body").append($loading);
			$.get("/literal" + path, function(data) {
				showEditor(data);
			});
			function showEditor(src) {
				var editor;
				$titleButtonContainer.append($("<a>Save</a>").click(function() {
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
				$titleButtonContainer.append(" | ");
				$titleButtonContainer.append($("<a>Cancel</a>").click(function() {
					window.location.href = path;
				}));
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

	// inline source editing
	//$("pre[lang]").each(function() {
	//	// turn "this" into inline editor
	//	//$(this).addClass("bespin");
	//	$textarea = $("<textarea/>")
	//			.val($(this).text());
	//	$(this).replaceWith($textarea);
	//	$textarea.each(function() {
	//		CodeMirror.fromTextArea(this, {
	//			parserfile: "parsejavascript.js",
	//			path: "/res/cm/js/",
	//			lineNumbers: true,
	//			height: "dynamic",
	//			stylesheet: "css/jscolors.css",
	//			tabMode: "shift",
	//			enterMode: "keep",
	//			electricChars: false
	//		});
	//	});
	//});
});
