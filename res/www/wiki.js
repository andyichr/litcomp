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
	var $buttonContainer = $("<div/>").attr("id", "buttons");
	var path = window.location.pathname;

	$("head").append($("<title/>").text(pageMeta.title));
	$("body").prepend($("<h1/>").text(pageMeta.title));

	// page editing functions
	$("h1").prepend($buttonContainer);
	$($buttonContainer).append($("<a>Edit</a>").click(function() {
		$buttonContainer.html("");
		var $loading = loading();
		$("body > article#wikidoc").remove();
		$("body").append($loading);
		$.get("/literal" + path, function(data) {
			showEditor(data);
		});
		function showEditor(src) {
			var editor;
			$buttonContainer.append($("<a>Save</a>").click(function() {
				var code = editor.getCode();
				var $loading = loading();
				$buttonContainer.html("");
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
			$buttonContainer.append(" | ");
			$buttonContainer.append($("<a>Cancel</a>").click(function() {
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
	}));

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
