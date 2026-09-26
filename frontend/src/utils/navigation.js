const routerBase = String(process.env.REACT_APP_ROUTER_BASENAME || '')
    .trim()
    .replace(/\/$/, '');

export function appPath(path = '/') {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${routerBase}${normalized}` || '/';
}

export function currentAppPath() {
    const current = window.location.pathname;
    if (routerBase && current.startsWith(routerBase)) {
        return current.slice(routerBase.length) || '/';
    }
    return current;
}

export function goTo(path) {
    window.location.assign(appPath(path));
}
