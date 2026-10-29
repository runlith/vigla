<script>
	import { page } from '$app/state';
	let { children } = $props();
</script>

<h1>{decodeURIComponent(page.url.pathname.split('/').pop() ?? '')}</h1>
{@render children?.()}

<a href="/encoded/escape-sequences/:-)">:-)</a>
<a href="/encoded/escape-sequences/%23">#</a>
<a href="/encoded/escape-sequences/%2F">/</a>
<a href="/encoded/escape-sequences/%3f">?</a>
<a href="/encoded/escape-sequences/苗">苗</a>
<a href="/encoded/escape-sequences/<">&lt;</a>
<a href="/encoded/escape-sequences/1<2">1&lt;2</a>
<a href="/encoded/escape-sequences/🤪">🤪</a>
<a href="/encoded/escape-sequences/%25">%</a>
