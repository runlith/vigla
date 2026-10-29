<script>
	let baz = "red"; // static value
	let bar = "32"; // static value interpolated
	let {
		foo = "font-size: 20px; color: blue;",
		bg = "gre", // dynamic value interpolated/cached
		borderColor = "green" // dynamic value non-cached
	} = $props();
</script>

<p
	style:font-size="{bar}px"
	style:color={baz}
	style="{foo}"
	style:background-color="{bg}en"
	style:border-color={borderColor}
></p>
