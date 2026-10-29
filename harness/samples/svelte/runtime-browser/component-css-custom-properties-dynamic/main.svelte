<script>
	import Slider from './Slider.svelte';
	let { railColor1, railColor2, trackColor1, trackColor2 } = $props();

	function identity(color) {
		return color;
	}
</script>

<Slider
	id="slider-1"
	--rail-color={railColor1}
	--track-color={trackColor1}
/>

<Slider
	id="slider-2"
	--rail-color={railColor2}
	--track-color={identity(trackColor2)}
/>