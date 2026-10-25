/**
 * The desktop sidebar's collapsed state lives in a `data-sidebar` attribute on
 * <html>, not in React state: the shell is a synchronous server component, and
 * an inline script in the root layout's <head> can set the attribute from
 * localStorage before the first paint, so a collapsed sidebar never flashes
 * open on load. Tailwind reads it through the `collapsed:` variant declared in
 * globals.css.
 */
export const SIDEBAR_STORAGE_KEY = 'mysat:sidebar';

export const SIDEBAR_INIT_SCRIPT = `try{if(localStorage.getItem('${SIDEBAR_STORAGE_KEY}')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}`;
