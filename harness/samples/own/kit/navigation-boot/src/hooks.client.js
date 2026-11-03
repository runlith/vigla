export function init() {
	sessionStorage.setItem('boots', String(Number(sessionStorage.getItem('boots') ?? 0) + 1));
}
