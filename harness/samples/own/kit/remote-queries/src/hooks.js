export const reroute = ({ url }) => {
	if (url.pathname === '/reroute/original') return '/reroute/actual';
};
