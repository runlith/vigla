<script>
	import { echo } from './echo.remote';
</script>

<form {...echo}>
	<input id="x" {...echo.fields.x.as('text')} />
	<button>go</button>
</form>
<p id="result">{echo.result?.echoed ?? ''}</p>
<a id="away" href="/ephemeral/other">away</a>
